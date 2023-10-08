import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { SerializerStore } from "../../models/serializer-store.js";
import { Addon, AddonBackend } from "../../models/addons.js";
import DiskCapacity from "../disk-capacity.js";
import { DefaultEncoder } from "../files.js";
import { AddonManifest } from "../schema/addon-manifest.js";
import { Serializer } from "../serializers.js";
import { make_workshop_item_url } from '../steam-api.js';
import Archiver from '../archiver.js';
import { ADDON_INFO } from '../../const.js';

export default class DefaultAddonBackend implements AddonBackend {
  _disk_capacity: DiskCapacity;
  _serializer_store: SerializerStore;
  _addon_dir: Gio.File;
  _archiver: Archiver;
  _manifest_serializer!: Serializer<Addon, AddonManifest>;

  constructor(params: {
    disk_capacity: DiskCapacity;
    serializer_store: SerializerStore;
    addon_dir: Gio.File;
    archiver: Archiver;
  }) {
    this._disk_capacity = params.disk_capacity;
    this._serializer_store = params.serializer_store;
    this._addon_dir = params.addon_dir;
    this._archiver = params.archiver;
  }

  init(item: Addon): void {
    this._manifest_serializer = this._serializer_store.get('serializer/addon-manifest');

    item.connect('notify::steam-id', this._update_remote.bind(this));
    this._update_remote(item);

    item.connect('notify::steam-id', this._update_steam_url.bind(this));
    this._update_steam_url(item);

    item.connect('notify::subdir', this._update_subdir_content.bind(this));
    item._set_subdir(this._addon_dir.get_child(item.id));

    item.connect('notify::remote', this._update_can_install_missing_archives.bind(this));
    item.connect('notify::archives', this._update_can_install_missing_archives.bind(this));
    this._update_can_install_missing_archives(item);

    this._setup_disksize_sync(item);
  }

  _setup_disksize_sync(item: Addon) {
    this._disk_capacity.connect(`cache-changed::${item.id}`, (_obj, size) => {
      item._set_size(size);
    });
  }

  _update_can_install_missing_archives(item: Addon): void {
    const [val] = this._archiver.is_addon_viable_install_missing_archives(item);
    item._set_can_install_missing_archives(val);
  }

  _update_remote(item: Addon): void {
    if (item._steam_url !== null) item._set_remote(true);
    else item._set_remote(false);
  }

  _update_steam_url(item: Addon): void {
    if (item.steam_id === null) item._set_steam_url(null);
    else {
      const url = GLib.Uri.parse(make_workshop_item_url(item.steam_id), GLib.UriFlags.NONE);
      item._set_steam_url(url);
    }
  }
  _update_subdir_content(item: Addon): void {
    if (item.subdir === null) item._set_info(null);
    else item._set_info(item.subdir.get_child(ADDON_INFO));
  }

  jsonfy(item: Addon) {
    const obj = this._manifest_serializer.serialize(item);
    const str = JSON.stringify(obj);
    const bytes = DefaultEncoder.encode(str);
    return bytes;
  }
}
