import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import * as Files from './file.js';
import * as Utils from './steam-vpk-utils/utils.js';
import AddonStorage from './addon-storage.js';

export enum signals_disk_capacity {
}

export default class DiskCapacity extends GObject.Object {
  static [GObject.signals] = {
  };

  static [GObject.properties] = {
    allocated: GObject.ParamSpec.uint64('allocated', 'allocated', 'allocated', Utils.g_param_default, 0, Number.MAX_SAFE_INTEGER, 0),
  };

  static {
    Utils.registerClass({}, this);
  };

  used: number | undefined;
  allocated!: number;
  settings!: Gio.Settings;
  cache: WeakMap<Gio.File, number> = new WeakMap;

  bind(
  {
    addon_storage,
    settings,
  }:
  {
    addon_storage: AddonStorage;
    settings: Gio.Settings;
  }) {
    this.settings = settings;

    const updateUsed = () => {
      this.eval_addon_dir(addon_storage.subdirFolder);
    };
    addon_storage.connect(AddonStorage.Signals.addons_changed, updateUsed);
    updateUsed();
    settings.bind('allocated', this, 'allocated', Gio.SettingsBindFlags.DEFAULT);
  }

  async start() {

  }

  connect_after_new_allocation = (cb: ($obj: this) => void) => {
    return this.settings.connect_after('changed', <Gio.Settings.ChangedSignalCallback>((_settings, key) => {
      if (key !== 'allocated') return;
      cb(this);
    }));
  }

  allocate(val: number) {
    this.allocated = val;
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
