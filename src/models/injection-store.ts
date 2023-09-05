import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Profile from './profile.js';
import { registerClass } from '../steam-vpk-utils/utils.js';

export interface Injection {
  connect(signal: 'cancelled', callback: ($obj: this) => void): number;
  connect(signal: 'notify::logs', callback: ($obj: this, pspec: GObject.ParamSpec) => void): number;
  connect(signal: 'notify::elapsed', callback: ($obj: this, pspec: GObject.ParamSpec) => void): number;
  connect(signal: 'notify', callback: ($obj: this, pspec: GObject.ParamSpec) => void): number;
  emit(signal: 'cancelled'): void;
  emit(signal: 'notify'): void;
}
export class Injection extends GObject.Object {
  static [GObject.signals] = {
    'cancelled': {},
  };

  static [GObject.properties] = {
    id: GObject.ParamSpec.string('id', '', '',
      GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT,
      null),
    target: GObject.ParamSpec.jsobject('target', '', '',
      GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT),
    creation: GObject.ParamSpec.jsobject('creation', '', '',
      GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT),
    elapsed: GObject.ParamSpec.uint64('elapsed', '', '',
      GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT,
      0, Number.MAX_SAFE_INTEGER, 0),
    logs: GObject.ParamSpec.object('logs', '', '',
      GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT,
      Gtk.StringList.$gtype),
    sources: GObject.ParamSpec.object('sources', '', '',
      GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT,
      Gio.ListStore.$gtype),
    cancellable: GObject.ParamSpec.object('cancellable', '', '',
      GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT,
      Gio.Cancellable.$gtype),
  }

  static {
    registerClass({}, this);
  }

  id: string;
  target: Profile;
  creation: Date = new Date();
  elapsed!: number;
  logs: Gtk.StringList = new Gtk.StringList;
  sources: Gio.ListStore<Gio.File> = new Gio.ListStore({ item_type: Gio.File.$gtype });
  cancellable: Gio.Cancellable = new Gio.Cancellable;
  _using_set_interval: GLib.Source | undefined;

  constructor(params: {
    target: Profile;
  }) {
    super(params);
    this.target = params.target;
    this.id = InjectionStore.generate_id();
    this.log(`Created at ${this.creation}`);
    this.cancellable.connect(() => {
      this.emit('cancelled');
    });
  }

  time(): boolean {
    if (this._using_set_interval !== undefined) {
      console.warn('Injection::time:', 'Timing has already begun');
      return false;
    }
    this._using_set_interval = setInterval(() => {
      this.elapsed++;
    }, 1);
    return true;
  }

  timeEnd(): boolean {
    if (this._using_set_interval === undefined) {
      console.warn('Injection::timeEnd', 'No timing is taking place!');
      return false;
    }
    this._using_set_interval.destroy();
    this._using_set_interval = undefined;
    return true;
  }

  log(msg: string) {
    this.logs.append(msg);
  }

  error(msg: string) {
    this.logs.append(`<span font-weight=\\\'bold\\\'>${msg}</span>`);
  }

  stop() {
    this.cancellable.cancel();
  }
}

export interface IdentifiableObject extends GObject.Object {
  id: string;
}

export class MappedStore<T extends IdentifiableObject> extends Gio.ListStore<T> {
  static {
    registerClass({}, this);
  }

  _id_map: Map<string, T> = new Map;

  splice(position: number, n_removals: number, additions: T[]): void {
    for (let i = 0; i < n_removals; i++) {
      const item = this.get_item(position + i);
      if (item === null) continue;
      this._id_map.delete(item.id);
    }
    for (const item of additions) {
      this._id_map.set(item.id, item);
    }
    super.splice(position, n_removals, additions);
  }

  get(id: string) {
    return this._id_map.get(id);
  }

  get_item(idx: number) {
    return super.get_item(idx) as T | null;
  }

  delete(id: string) {
    return this._id_map.delete(id);
  }
}

export default interface InjectionStore extends MappedStore<Injection> {
  connect(signal: 'bind', callback: ($obj: this, injection: Injection) => void): number;
  emit(signal: 'bind', injection: Injection): void;
  connect(signal: 'unbind', callback: ($obj: this, injection: Injection) => void): number;
  emit(signal: 'unbind', injection: Injection): void;

  /* default */
  connect(sigName: "notify::item-type", callback: (($obj: Gio.ListStore, pspec: GObject.ParamSpec) => void)): number
  connect_after(sigName: "notify::item-type", callback: (($obj: Gio.ListStore, pspec: GObject.ParamSpec) => void)): number
  emit(sigName: "notify::item-type", ...args: any[]): void
  connect(sigName: "notify::n-items", callback: (($obj: Gio.ListStore, pspec: GObject.ParamSpec) => void)): number
  connect_after(sigName: "notify::n-items", callback: (($obj: Gio.ListStore, pspec: GObject.ParamSpec) => void)): number
  emit(sigName: "notify::n-items", ...args: any[]): void
}
export default class InjectionStore extends MappedStore<Injection> {
  static last_id = 0;

  static generate_id(): string {
    this.last_id++;
    return String(new Date().getTime()) + '-' + String(this.last_id);
  }

  static [GObject.signals] = {
    'bind': {
      param_types: [Injection.$gtype],
    },
    'unbind': {
      param_types: [Injection.$gtype],
    },
  };

  static {
    registerClass({}, this);
  }

  splice(position: number, n_removals: number, additions: Injection[]): void {
    for (let i = 0; i < n_removals; i++) {
      const item = this.get_item(position + i);
      if (item === null) continue;
      this.emit('unbind', item);
    }
    for (const item of additions) {
      this.emit('bind', item);
    }
    super.splice(position, n_removals, additions);
  }
}
