import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';

import IndexDirectory from '../index-dir.js';
import {
  Addon,
  AddonFlags,
  AddonManifest,
} from './addons.js';
import Archiver from '../services/archiver.js';
import {
  make_dir_nonstrict,
  read_json,
  replace_json,
  replace_json_async,
} from '../file.js';
import {
  ADDON_INDEX,
  ADDON_INFO,
} from '../const.js';
import {
  registerClass,
} from '../steam-vpk-utils/utils.js';



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

export default class AddonStorage extends GObject.Object {
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

  archiver!: Archiver;

  constructor(params: { subdir_folder: Gio.File,
                        pkg_user_state_dir: Gio.File, }) {
    super({});
    this.subdirFolder = params.subdir_folder;
    this.idmap = new Map();
    this.index = params.pkg_user_state_dir.get_child(ADDON_INDEX);
    this.indexer = new IndexDirectory({ file: this.index, storage: params.subdir_folder });

    this.model = new Gio.ListStore({ item_type: Addon.$gtype });
  }


  bind(
  { archiver,
  }:
  { archiver: Archiver;
  }) {
    this.archiver = archiver;
  }

  async force_update() {
    return this.indexer.load_file();
  }

  async start() {
    console.info(`addon-dir-index: ${this.index.get_path()}`);
    this.indexer.connect('subdirs-changed', () => {
      this.updateIdMap().catch(error => logError(error));
    });

    try {
      make_dir_nonstrict(this.subdirFolder);
    } catch (error) {
      logError(error as Error, 'Quitting...');
      return;
    }

    this.indexer.start();
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

  async addon_trash(id: string): Promise<boolean> {
    const subdir = this.subdirFolder.get_child(id);
    try {
      // @ts-ignore
      await subdir.trash_async(GLib.PRIORITY_DEFAULT, null);
    } catch (error) {
      logError(error);
      console.error('Quitting...');
      return false;
    }
    return this.indexer.delete_entry(id);
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
      logError(error as Error, 'Quitting...');
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
    return addon;
  }

  make_dummy(id: string): Addon {
    const addon = this.addon_make({ stvpkid: id }, AddonFlags.DUMMY);
    if (addon === undefined) throw new Error('Couldn\'t create dummy. This should be impossible.');
    return addon;
  }
}


