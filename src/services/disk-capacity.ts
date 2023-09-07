import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import * as Files from '../file.js';
import AddonStorage from '../models/addon-storage.js';

export default class DiskCapacity extends GObject.Object {
  static {
    GObject.registerClass({
      Properties: {
        used: GObject.ParamSpec.uint64(
          'used', 'Used', 'Disk space used by add-on repository',
          GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT,
          0, Number.MAX_SAFE_INTEGER,
          0),
        fs_free: GObject.ParamSpec.uint64(
          'fs_free', 'Filesystem Free', 'Free disk space of filesystem of add-on repository',
          GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT,
          0, Number.MAX_SAFE_INTEGER,
          0),
        fs_size: GObject.ParamSpec.uint64(
          'fs_size', 'Filesystem Size', 'Total disk capacity of filesystem of add-on repository',
          GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT,
          0, Number.MAX_SAFE_INTEGER,
          0),
      },
    }, this);
  };

  used!: number;
  fs_free!: number;
  fs_size!: number;
  icon!: Gio.Icon;
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

    const info = addon_storage.subdirFolder.query_filesystem_info('*', null);
    this.fs_free = info.get_attribute_uint64(Gio.FILE_ATTRIBUTE_FILESYSTEM_FREE);
    this.fs_size = info.get_attribute_uint64(Gio.FILE_ATTRIBUTE_FILESYSTEM_SIZE);
    console.log('type', info.get_attribute_string(Gio.FILE_ATTRIBUTE_FILESYSTEM_TYPE));
    setInterval(() => {
      addon_storage.subdirFolder.query_filesystem_info_async('*', GLib.PRIORITY_DEFAULT, null)
        .then(info => {
          const free = info.get_attribute_uint64(Gio.FILE_ATTRIBUTE_FILESYSTEM_FREE);
          if (free !== this.fs_free) this.fs_free = free;

          const size = info.get_attribute_uint64(Gio.FILE_ATTRIBUTE_FILESYSTEM_SIZE);
          if (size !== this.fs_size) this.fs_size = size;
        })
        .catch(error => logError(error));
    }, 5000);


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
