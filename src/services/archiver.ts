import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';

import { Addon, AddonManifest } from '../models/addons.js';
import AddonStorage from '../models/addon-storage.js';
import SteamworkServices from './steam-api.js';
import {
  g_model_foreach,
  registerClass,
  vardict_make,
} from '../steam-vpk-utils/utils.js';
import { GVariantFormat } from '../gvariant.js';
import DownloadQueue from '../models/download-queue.js';

export interface ArchiveManifest {
  path?: string;
  type?: string;
  url?: string;
  size?: number;
}

enum ArchiveType {
  local = 'local',
  steam = 'steam',
}

function parse_archive_type(val: string): ArchiveType | null {
  let ret: string | null = null;
  Object.keys(ArchiveType).forEach(key => {
    if (val === key) {
      ret = key;
      return;
    }
  });
  return ret;
}

export class Archive extends GObject.Object implements GVariantFormat {
  static {
    registerClass({}, this);
  }

  static getGVariantType() {
    return GLib.VariantType.new_array(
      GLib.VariantType.new_dict_entry(
        GLib.VariantType.new('s'),
        GLib.VariantType.new('v')
      )
    );
  }

  static make(
  {
    file,
    url,
    expected_size,
  }:
  {
    file: Gio.File;
    url?: GLib.Uri;
    expected_size?: number;
  }) {
    const archive = (() => {
      if (url) {
        return new RemoteArchive({ url, file, expected_size });
      } else {
        return new LocalArchive({ file });
      }
    })();
    return archive;
  }

  static fromManifest({
    owner,
    manifest,
  }:{
    owner: string,
    manifest: ArchiveManifest,
    dir: Gio.File,
  }): Archive | undefined {
    if (manifest.type === undefined) {
      console.warn(`Required field \"type\" is missing for add-on \"${owner}\"`);
      return undefined;
    }
    const type = parse_archive_type(manifest.type);
    if (type === null) {
      console.warn(`Unrecognized archive type \"${manifest.type}\" for add-on \"${owner}\". Quitting...`);
      return undefined;
    }
    const path = manifest.path;
    if (path === undefined) {
      console.warn(`Required field \"path\" is missing for add-on \"${owner}\"`);
      return undefined;
    }
    const file = Gio.File.new_for_path(path);
    const url = (() => {
      let val;
      try {
        val = GLib.Uri.parse(manifest.url || null, GLib.UriFlags.NONE);
      } catch (error) {
        val = undefined;
      }
      return val;
    })();
    const expected_size = manifest.size;
    const archive = Archive.make({ file, url, expected_size });
    return archive;
  }

  type: ArchiveType;
  file: Gio.File;

  constructor(params: { type: ArchiveType; file: Gio.File }) {
    super({});
    this.type = params.type;
    this.file = params.file;
  }

  exists(): boolean {
    return this.file.query_exists(null);
  }

  toManifest() {
    return {};
  }

  toGVariant() {
    return vardict_make({});
  }
}

class LocalArchive extends Archive {
  static {
    registerClass({}, this);
  }

  constructor(params: { file: Gio.File }) {
    super({ type: ArchiveType.local, file: params.file })
  }

  toManifest() {
    const path = this.file.get_path() || undefined;
    const type = this.type;
    return <ArchiveManifest>{ path, type };
  }

  toGVariant() {
    return vardict_make({
      path: (() => {
        const path = this.file.get_path();
        if (path === null) return null;
        return GLib.Variant.new_string(path);
      })(),
      type: GLib.Variant.new_string(ArchiveType[this.type]),
    });
  }
}

class RemoteArchive extends Archive {
  static {
    registerClass({}, this);
  }

  url: GLib.Uri;
  expected_size?: number;

  constructor(params: { file: Gio.File; url: GLib.Uri; expected_size?: number }) {
    super({ type: ArchiveType.steam, file: params.file });
    this.url = params.url;
    this.expected_size = params.expected_size;
  }

  toManifest() {
    const path = this.file.get_path() || undefined;
    const type = this.type;
    const url = this.url.to_string() || undefined;
    const size = this.expected_size;
    return <ArchiveManifest>{ path, type, url, size };
  }

  toGVariant() {
    return vardict_make({
      path: (() => {
        const path = this.file.get_path();
        if (path === null) return null;
        return GLib.Variant.new_string(path);
      })(),
      type: GLib.Variant.new_string(ArchiveType[this.type]),
      url: (() => {
        const url = this.url.to_string();
        if (url === null) return null;
        return GLib.Variant.new_string(url);
      })(),
      size: (() => {
        const size = this.expected_size;
        if (size === undefined) return null;
        return GLib.Variant.new_uint64(size);
      })(),
    });
  }
}

export class ArchiveGroup extends GObject.Object {
  static {
    registerClass({}, this);
  }

  owner: string;
  archives: Gio.ListStore<Archive>;

  constructor(owner: string) {
    super({});
    this.owner = owner;
    this.archives = new Gio.ListStore({ item_type: Archive.$gtype });
  }

  toManifest(): ArchiveManifest[] {
    const arr: ArchiveManifest[] = [];
    g_model_foreach(this.archives, (item: Archive) => {
      const manifest = item.toManifest();
      arr.push(manifest);
    });
    return arr;
  }

  toGVariant(): GLib.Variant {
    const arr: GLib.Variant[] = [];
    g_model_foreach(this.archives, (item: Archive) => {
      const gvariant = item.toGVariant();
      arr.push(gvariant);
    });
    return GLib.Variant.new_array(
      /* child type */ Archive.getGVariantType(),
      /* children */ arr
      );
  }
}

export default class Archiver {
  download_queue!: DownloadQueue;
  steamapi!: SteamworkServices;
  addon_storage!: AddonStorage;

  constructor() {
    //this.groups = new Gio.ListStore({ item_type: ArchiveGroup.$gtype });
  }

  bind(
  {
    download_queue,
    steamapi,
    addon_storage,
  }:
  {
    download_queue: DownloadQueue;
    steamapi: SteamworkServices;
    addon_storage: AddonStorage;
  }) {
    this.download_queue = download_queue;
    this.steamapi = steamapi;
    this.addon_storage = addon_storage;
  }

  async start() {

  }

  load_archive_group(
  {
    owner,
    addon_manifest,
    subdir,
  }:
  {
    owner: string,
    addon_manifest: AddonManifest,
    subdir: Gio.File,
  }) {
    const group = new ArchiveGroup(owner);
    addon_manifest.archives?.forEach(x => {
      const archive = Archive.fromManifest({
        manifest: x,
        owner,
        dir: subdir,
      });
      if (archive) group.archives.append(archive);
    });
    return group;
  }

  register_archive_group_from_manifest(
  {
    addon,
    subdir,
    addon_manifest,
  }:
  {
    addon: Addon;
    subdir: Gio.File;
    addon_manifest: AddonManifest,
  }) {
    const owner = addon.id;
    const group = this.load_archive_group({ owner, addon_manifest, subdir });
    addon.set_archive_group(group);
  }

  async remote_archive_register(addon: Addon): Promise<boolean> {
    const steamId = addon.steamId || 'not available';
    let response;
    try {
      response = await this.steamapi.getPublishedFileDetails(steamId);
    } catch (error) {
      logError(error as Error, 'Quitting...');
      return false;
    }
    const url = GLib.Uri.parse(response?.file_url || null, GLib.UriFlags.NONE);
    const size = response?.file_size;
    const file = addon.subdir.get_child(`${addon.id}.vpk`);
    const archive = Archive.make({ file, url, expected_size: size });
    const group = new ArchiveGroup(addon.id);
    group.archives.append(archive);
    addon.set_archive_group(group);
    return true;
  }

  async retrieve_steam_archive(addon: Addon) {
    await this.remote_archive_register(addon);
    await this.install_archive_steamitem(addon);
  }

  async install_archive_steamitem(addon: Addon) {
    const { archive_group } = addon;
    if (archive_group === undefined) {
      console.warn(`Archival is not supported for addon \"${addon.id}\". Quitting...`);
      return;
    }
    const { archives } = archive_group;
    const count = archives.get_n_items();
    if (count === 0) {
      console.warn(`No archive to install for addon \"${addon.id}\". Quitting...`);
      return;
    } else if (count > 1) {
      console.warn (`Addon \"${addon.id}\" has more than one archive. Multiple archives is not supported yet. Quitting...`);
      return;
    }
    const archive = archives.get_item(0);
    if (archive === null) {
      console.warn('Could not retrieve first archive for addon \"', addon.id, '\". Quitting...');
      return;
    }
    if (!(archive instanceof RemoteArchive)) {
      console.warn(`Archive for addon \"${addon.id}\" is not of remote origin. Quitting...`);
      return;
    }
    const { url: uri, expected_size: size, file: dest } = archive;
    const order = this.download_queue.register_order({
      uri,
      size,
      name: addon.id,
    });
    order.start();
    console.debug('Download started');
    const announcer = setInterval(() => {
      console.debug('Progress:', order.get_percentage());
    }, 1000);
    order.connect('completed', () => {
      (async () => {
        announcer.destroy();
        console.debug('Download completed');
        await order.saved_location.move_async(dest, Gio.FileCopyFlags.NONE, GLib.PRIORITY_DEFAULT, null, null);
      })().catch(error => logError(error));
    });
  }

}

