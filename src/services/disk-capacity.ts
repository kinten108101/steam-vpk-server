import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import * as Files from './files.js';

export default interface DiskCapacity {
  connect(signal: `cache-changed::${string}`, callback: (obj: this, size: number) => void): number;
  emit(signal: `cache-changed::${string}`, size: number): void;
  /** inherit */
  connect(signal: 'notify', callback: (obj: this, pspec: GObject.ParamSpec) => void): number;
  emit(signal: 'notify'): void;
}

export default class DiskCapacity extends GObject.Object {
  static {
    GObject.registerClass({
      Properties: {
        used: GObject.ParamSpec.uint64(
          'used', 'Used', 'Disk space used by add-on repository',
          GObject.ParamFlags.READABLE,
          0, Number.MAX_SAFE_INTEGER,
          0),
        fs_free: GObject.ParamSpec.uint64(
          'fs-free', 'Filesystem Free', 'Free disk space of filesystem of add-on repository',
          GObject.ParamFlags.READABLE,
          0, Number.MAX_SAFE_INTEGER,
          0),
        fs_size: GObject.ParamSpec.uint64(
          'fs-size', 'Filesystem Size', 'Total disk capacity of filesystem of add-on repository',
          GObject.ParamFlags.READABLE,
          0, Number.MAX_SAFE_INTEGER,
          0),
      },
      Signals: {
        'cache-changed': {
          param_types: [GObject.TYPE_UINT64],
          flags: GObject.SignalFlags.DETAILED,
        },
      },
    }, this);
  };

  _used!: number;
  get used() {
    return this._used;
  }
  _set_used(val: number) {
    this._used = val;
    this.notify('used');
  }
  _fs_free!: number;
  get fs_free() {
    return this._fs_free;
  }
  _set_fs_free(val: number) {
    this._fs_free = val;
    this.notify('fs-free');
  }
  _fs_size!: number;
  get fs_size() {
    return this._fs_size;
  }
  _set_fs_size(val: number) {
    this._fs_size = val;
    this.notify('fs-size');
  }

  cache: WeakMap<Gio.File, number> = new WeakMap;
  _dir!: Gio.File;

  constructor(params: {
    dir: Gio.File;
  }) {
    super({});
    this._dir = params.dir;
  }

  eval_addon_dir() {
    // TODO(kinten): Memoize using last modified?
    this.cache = new WeakMap;
    const subdirs = Files.list_file(this._dir);
    const used = subdirs.map(subdir => {
      const subdirsize = this.eval_size(subdir);
      this.cache.set(subdir, subdirsize);
      this.emit(`cache-changed::${subdir.get_relative_path(this._dir)}`, subdirsize);
      return subdirsize;
    }).reduce((acc, size) => acc + size, 0);
    this._set_used(used);
  }

  eval_size(subdir: Gio.File): number {
    const cache = this.cache.get(subdir);
    if (cache !== undefined) return cache;
    let files: Gio.File[] = [];
    try {
      files = Files.list_file(subdir);
    } catch (error) {
      logError(error);
      return 0;
    }
    const size = files.map(file => {
      const info = file.query_info(Gio.FILE_ATTRIBUTE_STANDARD_SIZE, Gio.FileQueryInfoFlags.NONE, null);
      return info.get_size();
    }).reduce((acc, size) => {
      return acc + size;
    }, 0);
    return size;
  }
}
