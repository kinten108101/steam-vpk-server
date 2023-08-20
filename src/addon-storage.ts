import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';

import IndexDirectory from './index-dir.js';
import {
  Addon,
  AddonFlags,
  AddonManifest,
} from './addons.js';
import Archiver from './archiver.js';
import LoadorderResolver, { Profile } from './loadorder-resolver.js';
import {
  create_json,
  make_dir_nonstrict,
  read_json,
  replace_json,
  replace_json_async,
} from './file.js';
import {
  ADDON_INDEX,
  ADDON_INFO,
  PROFILE_DEFAULT_INFO,
} from './const.js';
import {
  array_insert,
  log_error,
  promise_wrap,
  registerClass,
} from './steam-vpk-utils/utils.js';

interface ConfigurationFile {
  addonlist?: ConfigurationFileEntry[];
}

interface ConfigurationFileEntry extends ConfigurationFileEntrySeparatorSection {
  id?: string;
  active?: boolean;
  type?: string;
}

export interface ConfigurationFileEntrySeparatorSection {
  name?: string;
}

export enum ItemType {
  addon = 'addon',
  separator = 'separator',
}

export class Configuration {
  type: ItemType;
  active: boolean;

  constructor(params: {
    type?: ItemType;
    active?: boolean;
  }) {
    this.type = params.type || ItemType.addon;
    this.active = params.active || false;
  }

  serialize() {
    return {
      type: this.type,
      active: this.active,
    }
  }
}

export interface Separator {
  id: string;
  name?: string;
}

function parse_item_type_enum(val: string | undefined): ItemType {
  switch (val) {
  case ItemType.addon: return ItemType.addon;
  case ItemType.separator: return ItemType.separator;
  default: return ItemType.addon;
  }
}

function make_configuration_from_manifest(manifest: ConfigurationFileEntry) {
  const obj = new Configuration({
    type: parse_item_type_enum(manifest.type),
    active: (() => {
      if (manifest.active !== undefined) {
        return manifest.active;
      }
      return false;
    })(),
  });
  return obj;
}

function make_separator_from_manifest(manifest: ConfigurationFileEntry): Separator | undefined {
  const id = manifest['id'];
  if (id === undefined) {
    console.warn('Separator entry lacks required field \"id\". Skipping...');
    return undefined;
  }
  const name = manifest['name'];
  return { id, name };
}

function make_configuration_file_from_storage(addonStorage: AddonStorage) {
  const addonlist: ConfigurationFileEntry[] = []
  addonStorage.loadorder.forEach(x => {
    const config = addonStorage.configmap.get(x);
    if (config === undefined) {
      console.warn('Configuration for loadorder entry does not exist. Quitting...')
      return;
    }
    const type = config.type;
    const active = config.active;
    let name: string | undefined;
    if (config.type === ItemType.separator) {
      const sep = addonStorage.sepmap.get(x);
      if (sep === undefined) return;
      name = sep.name;
    }
    addonlist.push({ id: x, active, type, name });
  });
  const content: ConfigurationFile = { addonlist };
  return content;
}

const _quark = GLib.quark_from_string('stvpk-addon-storage-error');
export function addon_storage_error_quark() {
  return _quark;
}
export enum AddonStorageError {
  TIMEOUT,
  ADDON_EXISTS,
  ADDON_NOT_EXISTS,
}

enum Signals {
  addons_enabled_changed = 'addons_enabled_changed',
  addons_changed = 'addons_changed',
  /** @deprecated */
  loadorder_changed = 'loadorder_changed',
  loadorder_order_changed = 'loadorder_order_changed',
  loadorder_config_changed = 'loadorder-config-changed',
  force_update = 'force-update',
}

export default class AddonStorage extends GObject.Object implements Profile {
  static Signals = Signals;

  static [GObject.signals] = {
    [Signals.addons_enabled_changed]: { param_types: [GObject.TYPE_BOOLEAN] },
    [Signals.addons_changed]: {},
    [Signals.loadorder_changed]: {},
    [Signals.loadorder_order_changed]: {},
    [Signals.loadorder_config_changed]: {},
    [Signals.force_update]: {},
  }

  static {
    registerClass({}, this);
  }

  index: Gio.File;
  indexer: IndexDirectory;
  subdirFolder: Gio.File;

  idmap: Readonly<Map<string, Addon>>;
  model: Gio.ListStore<Addon>;

  id: string = 'default';
  name?: string | undefined;
  configState: Gio.File;
  loadorder: string[];
  configmap: Map<string, Configuration>;
  private enabled: boolean;
  sepmap: Map<string, Separator>;

  loadorder_resolver!: LoadorderResolver
  archiver!: Archiver;

  constructor(params: { subdir_folder: Gio.File,
                        pkg_user_state_dir: Gio.File, }) {
    super({});
    this.subdirFolder = params.subdir_folder;
    this.idmap = new Map();
    this.index = params.pkg_user_state_dir.get_child(ADDON_INDEX);
    this.indexer = new IndexDirectory({ file: this.index, storage: params.subdir_folder });

    this.model = new Gio.ListStore({ item_type: Addon.$gtype });
    this.enabled = true;
    this.configState = params.pkg_user_state_dir.get_child(PROFILE_DEFAULT_INFO);
    // NOTE(kinten):
    // Separated config details from the config array (loadorder).
    // So that we can do loadorder.includes (deep equality is not implemented in JS).
    // Consequence is that we must manually keep loadorder and configmap in sync.
    // TODO(kinten):
    // loadorder should be a tree-based array implementation, one that supports random insertion.
    this.loadorder = [];
    this.configmap = new Map();

    this.sepmap = new Map();
  }


  bind(
  { archiver,
    loadorder_resolver,
  }:
  { archiver: Archiver;
    loadorder_resolver: LoadorderResolver;
  }) {
    this.loadorder_resolver = loadorder_resolver;
    this.archiver = archiver;
  }

  async force_update() {
    return this.indexer.load_file();
  }

  async start() {
    console.info(`addon-dir-index: ${this.index.get_path()}`);
    this.indexer.connect('subdirs-changed', () => promise_wrap(this.updateIdMap));

    try {
      make_dir_nonstrict(this.subdirFolder);
    } catch (error) {
      logError(error);
      console.error('Quitting...');
      return;
    }

    try {
      const content = make_configuration_file_from_storage(this);
      create_json(content, this.configState);
      console.info(`Created ${this.configState.get_path()} for the first time.`);
    } catch (error) {
      if (error instanceof GLib.Error) {
        if (error.matches(Gio.io_error_quark(), Gio.IOErrorEnum.EXISTS)) {}
      } else throw error;
    }

    this.connect(AddonStorage.Signals.loadorder_changed, this.loadorder_save); // experimental
    this.connect(AddonStorage.Signals.loadorder_order_changed, this.loadorder_save); // experimental
    this.connect(AddonStorage.Signals.loadorder_config_changed, this.loadorder_save); // experimental

    this.indexer.start();
    this.loadorder_load(this)();
  }

  idmap2gvariant() {
    const arr: GLib.Variant[] = [];
    this.idmap.forEach(x => {
      arr.push(x.toGVariant());
    });
    return GLib.Variant.new_array(
      Addon.getGVariantType(),
      arr
    );
  }

  set_addons_enabled(val: boolean) {
    if (val === this.enabled) return;
    this.enabled = val;
    this.emit(AddonStorage.Signals.addons_enabled_changed, val);
  }

  get_addons_enabled() {
    return this.enabled;
  }

  get(vanityId: string): Addon | undefined {
    return this.idmap.get(vanityId);
  }

  getAll() {
    return this.idmap;
  }

  updateIdMap = async () => {
    const subdirs = this.indexer.subdirs;
    const draftMap = new Map<string, Addon>();
    this.model.remove_all();
    subdirs.forEach(x => {
      const subdir = this.subdirFolder.get_child(x.id);
      const info = subdir.get_child(ADDON_INFO);

      let jsobject;
      try {
        jsobject = read_json(info);
      } catch (error) {
        if (error instanceof GLib.Error && error.matches(Gio.io_error_quark(), Gio.IOErrorEnum.NOT_FOUND)) {
          console.warn(`Caught a file handler error in add-on ${x.id}. Add-on possibly does not exist. Must be manually resolved. Skipping...`)
          return;
        } else {
          logError(error);
          return;
        }
      }

      let manifest = (() => {
        if (typeof jsobject.stvpkid === 'string')
          return jsobject as AddonManifest;
        else return undefined;
      })();

      if (manifest === undefined) {
        console.warn(`Add-on manifest lacks required fields! Must be manually resolved. Skipping...`);
        return;
      }

      const addon = this.addon_make(manifest);
      addon?.creators?.forEach((_x, key) => {
        console.log(key);
      });
      if (addon === undefined) {
        console.warn('Could not register add-on. Skipping...');
        return;
      }
      if (addon.vanityId !== x.id) {
        console.warn('Add-on ID and subdirectory name are different! Must be manually resolved. Skipping...');
        return;
      }

      draftMap.set(addon.vanityId, addon);
      this.model.append(addon);
    });
    this.idmap = draftMap;
    this.emit(AddonStorage.Signals.addons_changed);
  }

  get_loadorder = (profile: Profile) => () => {
    return profile.loadorder;
  }

  loadorder_load = (profile: Profile) => () => {
    const obj: ConfigurationFile = read_json(profile.configState);

    const addonlist: ConfigurationFileEntry[] | undefined = obj['addonlist'];
    if (!Array.isArray(addonlist) || addonlist === undefined) {
      console.warn('Empty add-on collection in configuration state. Must be resolved manually. Quitting...');
      return;
    }
    const draft_loadorder: string[] = [];
    const draft_configmap: Map<string, Configuration> = new Map();
    const draft_sepmap: Map<string, Separator> = new Map();
    addonlist.forEach(x => {
      const id = x['id'];
      if (id === undefined) {
        console.warn('Load-order entry lacks required field \"id\". Skipping...');
        return;
      }
      if (draft_loadorder.includes(id)) {
        console.warn('Duplicated load-order entry! Continue anyway...');
      }
      draft_loadorder.push(id);

      const config = make_configuration_from_manifest(x);
      if (draft_configmap.has(id)) {
        console.warn('Duplicated config-map entry! Continue anyway...');
      }
      draft_configmap.set(id, config);

      const sep = make_separator_from_manifest(x);
      if (sep === undefined) {
        return;
      }
      draft_sepmap.set(id, sep);
    });
    profile.loadorder = draft_loadorder;
    profile.configmap = draft_configmap;
    profile.sepmap = draft_sepmap;

    this.emit(AddonStorage.Signals.loadorder_changed);
  }

  loadorder_remove = (profile: Profile) => (id: string) => {
    const idx = profile.loadorder.indexOf(id);
    if (idx === -1) {
      console.warn(`Tried to remove the add-on \"${id}\" from a loadorder it does not belong. Quitting...`);
      return;
    }
    // this is slow, ik. Should use a GModel which implements a binary tree
    const draft_loadorder = profile.loadorder.filter((_, i) => i !== idx);
    const draft_configmap = new Map(profile.configmap);
    draft_configmap.delete(id);
    profile.loadorder = draft_loadorder;
    profile.configmap = draft_configmap;
    this.emit(AddonStorage.Signals.loadorder_changed);
  }

  /** @note Assuming that the add-on `id` exists in AddonStorage#idmap */
  loadorder_push = (profile: Profile) => (id: string) => {
    if (profile.loadorder.includes(id)) {
      console.warn('Add-on that is already included. Quitting...');
      return;
    }
    profile.loadorder.push(id);
    const config = make_configuration_from_manifest({});
    profile.configmap.set(id, config);
    this.emit(AddonStorage.Signals.loadorder_changed);
  }

  loadorder_swap = (profile: Profile) => (source: number, target: number) => {
    const tmp = profile.loadorder[source];
    if (tmp === undefined) {
      console.warn(`Swap index of tmp out-of-bound. Got ${source}. Quitting...`);
      return;
    }
    const tgt = profile.loadorder[target];
    if (tgt === undefined) {
      console.warn(`Swap index of tgt out-of-bound. Got ${tgt}. Quitting...`);
      return;
    }
    profile.loadorder[source] = tgt;
    profile.loadorder[target] = tmp;
    this.emit(AddonStorage.Signals.loadorder_order_changed);
  }

  loadorder_swap_silent = (profile: Profile) => (source: number, target: number): boolean => {
    const tmp = profile.loadorder[source];
    if (tmp === undefined) {
      console.warn(`Swap index of tmp out-of-bound. Got ${source}. Quitting...`);
      return false;
    }
    const tgt = profile.loadorder[target];
    if (tgt === undefined) {
      console.warn(`Swap index of tgt out-of-bound. Got ${tgt}. Quitting...`);
      return false;
    }
    profile.loadorder[source] = tgt;
    profile.loadorder[target] = tmp;
    return true;
  }

  loadorder_move_up_silent = (profile: Profile) => (source: number): number => {
    const stat = this.loadorder_swap_silent(profile)(source, source - 1);
    if (stat) return source - 1;
    return NaN;
  }

  loadorder_move_down_silent = (profile: Profile) => (source: number): number => {
    const stat = this.loadorder_swap_silent(profile)(source, source + 1);
    if (stat) return source + 1;
    return NaN;
  }

  loadorder_insert_silent = (profile: Profile) => (source: number, target: number) => {
    const stepper = source > target ? this.loadorder_move_up_silent : this.loadorder_move_down_silent;
    let last_step = source;
    const count = Math.abs(source - target);
    for (let i = 0; i < count; i++) {
      try {
        last_step = stepper(profile)(last_step);
      } catch (error) {
        log_error(error, 'Skipping...');
      }
    }
  }

  loadorder_insert = (profile: Profile) => (source: number, target: number) => {
    this.loadorder_insert_silent(profile)(source, target);
    this.emit(AddonStorage.Signals.loadorder_order_changed);
  }

  loadorder_save = (profile: Profile) => () => {
    const content = make_configuration_file_from_storage(this);
    try {
      replace_json(content, profile.configState);
    } catch (error) {
      logError(error);
      return;
    }
  }

  loadorder_separator = (profile: Profile) => (id: string, name: string, pos: number) => {
    if (profile.loadorder.includes(id)) {
      console.warn('Separator already included. Quitting...');
      return;
    }
    if (pos < 0 || pos >= profile.loadorder.length) {
      console.warn('Separator placement out of bound. Quitting...');
      return;
    }
    array_insert(profile.loadorder, id, pos);
    const config = make_configuration_from_manifest({
      type: ItemType.separator,
    });
    profile.configmap.set(id, config);
    const sep: Separator = {
      id,
      name,
    };
    profile.sepmap.set(id, sep);
    this.emit(AddonStorage.Signals.loadorder_changed);
  }

  async addon_trash(id: string) {
    const subdir = this.subdirFolder.get_child(id);
    try {
      // @ts-ignore
      await subdir.trash_async(GLib.PRIORITY_DEFAULT, null);
    } catch (error) {
      logError(error);
      console.error('Quitting...');
      return;
    }
    this.indexer.delete_entry(id);
  }

  async addon_create(addon: AddonManifest) {
    if (!addon.stvpkid) {
      console.warn('Add-on id was not provided. Quitting...');
      return;
    }

    if (this.indexer.subdirs.has(addon.stvpkid)) {
      console.warn('Add-on already exists. Quitting...');
      return;
    }

    const subdir = this.subdirFolder.get_child(addon.stvpkid);
    try {
      subdir.make_directory(null);
    } catch (error) {
      if (error instanceof GLib.Error && error.matches(Gio.io_error_quark(), Gio.IOErrorEnum.EXISTS)) {}
      else throw error;
    }

    const info_location = subdir.get_child(ADDON_INFO);
    try {
      replace_json(addon, info_location);
    } catch (error) {
      log_error(error, 'Quitting...');
      return;
    }

    this.indexer.add_entry(addon.stvpkid);
    this.emit(Signals.addons_changed);
  }

  async addon_save(id: string) {
    const addon = this.idmap.get(id);
    if (addon === undefined) {
      console.warn('Add-on could not be found, so could not save. Quitting...');
      return;
    }
    const manifest = addon.toManifest();
    await replace_json_async(manifest, addon.info);
    this.emit(Signals.addons_changed);
  }

  addon_make(manifest: AddonManifest, flags: AddonFlags = AddonFlags.NONE): Addon | undefined {
    const id = manifest.stvpkid;
    if (id === undefined) {
      console.warn('Add-on manifest has no ID. Quitting...');
      return undefined;
    }
    const subdir = this.subdirFolder.get_child(id);
    const addon = new Addon({
      vanityId: id,
      steamId: manifest.publishedfileid,
      title: manifest.title,
      description: manifest.description,
      categories: (() => {
              if (manifest.tags === undefined) return new Map();
              const arr = manifest.tags?.map(({ tag }) => {
                return tag;
              });
              const map = new Map<string, {}>();
              arr.forEach(x => {
                map.set(x, {});
              });
              return map;
            })(),
      timeUpdated: (() => {
              if (manifest.time_updated === undefined) return undefined;
              const date = new Date(manifest.time_updated.valueOf() * 1000);
              return date;
            })(),
      comment: manifest.comment,
      creators: (() => {
              if (manifest.creators === undefined) return new Map();
              const arr: string[] = [];
              manifest.creators?.forEach(x => {
                if (x.creator === undefined) return;
                arr.push(x.creator);
              });
              const map = new Map<string, {}>();
              arr.forEach(x => {
                map.set(x, {})
              });
              return map;
            })(),
      flags,
      subdir,
    });
    this.archiver.register_archive_group_from_manifest({ addon, subdir, addon_manifest: manifest });
    addon.connect('modified', this.addon_save.bind(this, addon.id));
    // dummy
    // upgrade-missing-archive
    return addon;
  }

  make_dummy(id: string): Addon {
    const addon = this.addon_make({ stvpkid: id }, AddonFlags.DUMMY);
    if (addon === undefined) throw new Error('Couldn\'t create dummy. This should be impossible.');
    return addon;
  }
}


