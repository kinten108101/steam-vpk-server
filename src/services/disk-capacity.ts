import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import * as Files from '../file.js';
import * as Utils from '../steam-vpk-utils/utils.js';
import AddonStorage from '../models/addon-storage.js';

export default class DiskCapacity extends GObject.Object {
  static {
    Utils.registerClass({}, this);
  };

  used: number | undefined;
  cache: WeakMap<Gio.File, number> = new WeakMap;

  bind(
  {
    addon_storage,
  }:
  {
    addon_storage: AddonStorage;
  }) {
    const updateUsed = () => {
      this.eval_addon_dir(addon_storage.subdirFolder);
    };
    addon_storage.connect(AddonStorage.Signals.addons_changed, updateUsed);
    updateUsed();
  }

  async start() {

  }

  eval_addon_dir(dir: Gio.File) {
    // TODO(kinten): Memoize using last modified?
    this.cache = new WeakMap;
    const subdirs = Files.list_file(dir);
    this.used = subdirs.map(subdir => {
      return this.eval_size(subdir);
    }).reduce((acc, size) => acc + size, 0);
  }

  eval_size(subdir: Gio.File): number {
    const cache = this.cache.get(subdir);
    if (cache !== undefined) return cache;
    const files = Files.list_file(subdir);
    const size = files.map(file => {
      const info = file.query_info(Gio.FILE_ATTRIBUTE_STANDARD_SIZE, Gio.FileQueryInfoFlags.NONE, null);
      return info.get_size();
    }).reduce((acc, size) => {
      return acc + size;
    }, 0);
    return size;
  }
}
