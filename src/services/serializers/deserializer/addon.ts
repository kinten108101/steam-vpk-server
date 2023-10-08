import Gio from 'gi://Gio';
import { Addon, AddonBackend } from "../../../models/addons.js";
import Archiver from "../../../services/archiver.js";
import DiskCapacity from "../../../services/disk-capacity.js";
import { Deserializer } from "../../serializers.js";
import { AddonManifest } from "../../schema/addon-manifest.js";
import { SerializerStore } from '../../../models/serializer-store.js';

export default class AddonDeserializer implements Deserializer<AddonManifest, Addon> {
  _archiver: Archiver;
  _addon_dir: Gio.File;
  _disk_capacity: DiskCapacity;
  _serializer_store: SerializerStore;
  _addon_backend: AddonBackend;

  constructor(params: {
    archiver: Archiver;
    addon_dir: Gio.File;
    disk_capacity: DiskCapacity;
    serializer_store: SerializerStore;
    addon_backend: AddonBackend;
  }) {
    this._archiver = params.archiver;
    this._addon_dir = params.addon_dir;
    this._disk_capacity = params.disk_capacity;
    this._serializer_store = params.serializer_store;
    this._addon_backend = params.addon_backend;
  }

  deserialize(manifest: AddonManifest): Addon | undefined {
    const id = manifest.stvpkid;
    if (id === undefined) {
      console.warn('Add-on manifest has no ID. Quitting...');
      return undefined;
    }
    const addon = new Addon({
      id,
      steam_id: manifest.publishedfileid || null,
      title: manifest.title || null,
      description: manifest.description || null,
      categories: (() => {
        if (manifest.tags === undefined) return new Set();
        const arr = manifest.tags?.map(({ tag }) => {
          return tag;
        });
        return new Set(arr);
      })(),
      creators: (() => {
        if (manifest.creators === undefined) return new Set();
        const arr: string[] = [];
        manifest.creators?.forEach(x => {
          if (x.creator === undefined) return;
          arr.push(x.creator);
        });
        return new Set(arr);
      })(),
      time_updated: (() => {
        if (manifest.time_updated === undefined) return null;
        const date = new Date(manifest.time_updated.valueOf() * 1000);
        return date;
      })(),
      addon_dir: this._addon_dir,
      archives: (() => {
        if (manifest.archives === undefined) return [];
        const ids: string[] = [];
        manifest.archives.forEach(x => {
          const { path } = x;
          if (path === undefined) return;
          ids.push(path);
        });
        return ids;
      })(),
    }, this._addon_backend);
    return addon;
  }
}

