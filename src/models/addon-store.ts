import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import { SignalStore } from '../models.js';
import { Addon } from './addons.js';

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
