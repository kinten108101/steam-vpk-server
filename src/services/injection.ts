import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Profile from '../models/profile.js';
import { IdentifiableObject } from '../models.js';
import InjectionStore from '../models/injection-store.js';

export interface Injection {
  connect(signal: 'cancelled', callback: ($obj: this) => void): number;
  connect(signal: 'notify::logs', callback: ($obj: this, pspec: GObject.ParamSpec) => void): number;
  connect(signal: 'notify::elapsed', callback: ($obj: this, pspec: GObject.ParamSpec) => void): number;
  connect(signal: 'notify', callback: ($obj: this, pspec: GObject.ParamSpec) => void): number;
  emit(signal: 'cancelled'): void;
  emit(signal: 'notify'): void;
}
export class Injection extends IdentifiableObject {
  static [GObject.signals] = {
    'cancelled': {},
  };

  static [GObject.properties] = {
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
    GObject.registerClass({}, this);
  }

  target: Profile;
  creation: Date = new Date();
  elapsed!: number;
  logs: Gtk.StringList = new Gtk.StringList;
  sources: Gio.ListStore<Gio.File> = new Gio.ListStore({ item_type: Gio.File.$gtype });
  cancellable: Gio.Cancellable = new Gio.Cancellable;

  hooks: Map<string, number> = new Map;
  _using_set_interval: GLib.Source | undefined;

  constructor(params: {
    target: Profile;
  }) {
    super({
      id: InjectionStore.generate_id(),
      ...params
    });
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
    this.logs.append(msg);
  }

  stop() {
    this.cancellable.cancel();
  }
}
