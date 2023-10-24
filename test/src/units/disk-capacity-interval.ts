import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import DiskCapacity from "../../../src/services/disk-capacity.js";
import DiskCapacityBinder from '../../../src/binders/disk-capacity.js';
import { IdentifiableObject, SignalStore } from '../../../src/models.js';
import {
  TestEnv,
  make_dir_nonstrict,
  random_name,
  recursiveDeleteCallback,
  replace_json,
  timeout_async,
} from '../utils.js';

class Addon extends IdentifiableObject {
  static {
    GObject.registerClass({
      GTypeName: 'TestAddon' + random_name(),
    }, this);
  }
}

export default interface AddonStore {
  connect(signal: 'request-fill', callback: (obj: this) => void): number;
  emit(signal: 'request-fill'): void;

  /** inherit */
  connect(signal: 'bind', callback: ($obj: this, item: Addon) => void): number;
  emit(signal: 'bind', item: Addon): void;
  connect(signal: 'unbind', callback: ($obj: this, item: Addon) => void): number;
  emit(signal: 'unbind', item: Addon): void;
  connect(signal: 'items-changed', callback: ($obj: this, pos: number, del: number, add: number) => void): number;
  emit(signal: 'items-changed', pos: number, del: number, add: number): void;
  connect(sigName: "notify::item-type", callback: (($obj: Gio.ListStore, pspec: GObject.ParamSpec) => void)): number
  connect_after(sigName: "notify::item-type", callback: (($obj: Gio.ListStore, pspec: GObject.ParamSpec) => void)): number
  emit(sigName: "notify::item-type", ...args: any[]): void
  connect(sigName: "notify::n-items", callback: (($obj: Gio.ListStore, pspec: GObject.ParamSpec) => void)): number
  connect_after(sigName: "notify::n-items", callback: (($obj: Gio.ListStore, pspec: GObject.ParamSpec) => void)): number
  emit(sigName: "notify::n-items", ...args: any[]): void
}

export default class AddonStore extends SignalStore<Addon> {
  static {
    GObject.registerClass({
      GTypeName: 'TestAddonStore' + random_name(),
      Signals: {
        'request-fill': {},
      },
    }, this);
  }

  constructor(params = {}) {
    super({
      item_type: Addon.$gtype,
      ...params,
    });
  }

  request_fill() {
    this.emit('request-fill');
  }
}

export async function DiskCapacityIntervalTest(env: TestEnv): Promise<number> {
  const addon_store = new AddonStore;
  const dir = env.addons_dir;
  const disk_capacity = new DiskCapacity({
    dir,
  });
  DiskCapacityBinder({
    disk_capacity,
    addons_dir: dir,
    addon_store,
  });
  const oldval = disk_capacity._fs_free;
  const examplemod_folder = env.addons_dir.get_child('example_mod')
  make_dir_nonstrict(examplemod_folder);
  const examplemod_file = examplemod_folder.get_child('info.txt');
  replace_json({ name: 'examplemod' }, examplemod_file);
  await timeout_async(5000);
  const newval = disk_capacity._fs_free;
  if (oldval === newval) return 1;
  recursiveDeleteCallback(dir, Gio.FileType.DIRECTORY, null).catch(logError);
  await timeout_async(5000);
  const newwval = disk_capacity._fs_free;
  if (newval !== newwval) return 1;
  return 0;
}
