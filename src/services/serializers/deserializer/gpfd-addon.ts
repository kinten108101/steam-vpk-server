import Gio from 'gi://Gio';
import { Addon, AddonBackend } from "../../../models/addons.js";
import { PublishedFileDetails } from "../../schema/steam-api.js";
import { Deserializer } from "../../serializers.js";
import DiskCapacity from '../../disk-capacity.js';
import { SerializerStore } from '../../../models/serializer-store.js';

export default class GPFD2Addon implements Deserializer<PublishedFileDetails, Addon> {
  _addon_dir: Gio.File;
  _disk_capacity: DiskCapacity;
  _serializer_store: SerializerStore;
  _addon_backend: AddonBackend;

  constructor(params: {
    addon_dir: Gio.File;
    disk_capacity: DiskCapacity;
    serializer_store: SerializerStore;
    addon_backend: AddonBackend;
  }) {
    this._addon_dir = params.addon_dir;
    this._disk_capacity = params.disk_capacity;
    this._serializer_store = params.serializer_store;
    this._addon_backend = params.addon_backend;
  }

  deserialize(response: PublishedFileDetails, overrides?: { id?: string }): Addon | undefined {
    if (overrides === undefined) return undefined;
    let id = overrides.id;
    if (id === undefined) return undefined;
    const item = new Addon({
      id,
      steam_id: String(response.publishedfileid),
      title: response.title || null,
      description: String(response.description),
      categories: (() => {
        const arr = response.tags;
        if (arr === undefined) {
          console.warn('GetPublishedFileDetails is missing the tags field.');
          return null;
        }
        if (!Array.isArray(arr)) {
          console.warn('GetPublishedFileDetails has incorrect tags field.');
          return null;
        }
        const set = new Set<string>;
        arr.forEach(x => {
          const tag = x.tag;
          if (typeof tag !== 'string') {
            console.warn('GetPublishedFileDetails has incorrect tag field.');
            return;
          }
          set.add(tag);
        });
        return set;
      })(),
      creators: (() => {
        // single creator for now
        const col = new Set<string>;
        const val = response.creator;
        if (val === undefined) return null;
        col.add(val);
        return col;
      })(),
      time_updated: (() => {
        if (response.time_updated)
          return new Date(response.time_updated);
        else return null;
      })(),
      addon_dir: this._addon_dir,
      archives: (() => {
        const file_name = (() => {
          if (response.file_name === undefined) return undefined;
          const file = Gio.File.new_for_path(response.file_name);
          const name = file.get_basename();
          if (name === null) return undefined;
          return name;
        })();
        if (file_name === undefined) return null;
        return [file_name];
      })(),
    }, this._addon_backend);
    return item;
  }
}
