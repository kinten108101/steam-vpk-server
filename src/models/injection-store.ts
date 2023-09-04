import Gio from 'gi://Gio';
import type { SignalMethods } from '@girs/gjs';
import Profile from './profile.js';

export interface Injection extends SignalMethods {}
export class Injection {
  static Signals = {
    logs_changed: 'logs-changed',
    cancelled: 'cancelled',
  };

  static {
    imports.signals.addSignalMethods(this.prototype);
  }

  sources: Gio.File[] | undefined;
  logs: string[];
  creation: Date;
  id: string;
  cancellable: Gio.Cancellable = new Gio.Cancellable;
  target: Profile;

  constructor(id: string, target: Profile) {
    this.target = target;
    this.logs = [];
    this.creation = new Date();
    this.id = id;
    this.log(`Created at ${this.creation}`);
    this.cancellable.connect(() => {
      this.emit(Injection.Signals.cancelled);
    });
  }

  log(msg: string) {
    this.logs.push(msg);
    this.emit(Injection.Signals.logs_changed, msg);
  }

  error(msg: string) {
    this.logs.push(`<span font-weight=\\\'bold\\\'>${msg}</span>`)
    this.emit(Injection.Signals.logs_changed, msg);
  }
}

export default interface InjectionStore extends SignalMethods {}
export default class InjectionStore {
  static Signals = {
    logs_changed: 'logs-changed', // id
    cancelled: 'cancelled', // id
  };

  static {
    imports.signals.addSignalMethods(this.prototype);
  }
  injections: Map<string, Injection> = new Map();
  handlers: WeakMap<Injection, { logs_changed: number, cancelled: number }> = new WeakMap();

  set(id: string, inj: Injection) {
    if (this.injections.has(id)) {
      console.warn(`Injection \"${id}\" already exists. Quitting...`);
      return;
    }
    const logs_changed = inj.connect(Injection.Signals.logs_changed, (_obj, ...args) => {
      this.emit(InjectionStore.Signals.logs_changed, inj.id, ...args);
    });
    const cancelled = inj.connect(Injection.Signals.cancelled, () => {
      this.emit(InjectionStore.Signals.cancelled, inj.id);
    });
    this.handlers.set(inj, {
      logs_changed,
      cancelled,
    });
    return this.injections.set(id, inj);
  }

  get(id: string) {
    return this.injections.get(id);
  }

  delete(id: string) {
    const inj = this.injections.get(id);
    if (inj === undefined) {
      console.warn(`Injection \"${id}\" not found. Quitting`);
      return;
    }
    const handlers = this.handlers.get(inj);
    if (handlers === undefined) {
      console.warn(`Handlers for injection \"${id}\" not found. Quitting`);
      return;
    }
    const { logs_changed, cancelled } = handlers;
    inj.disconnect(logs_changed);
    inj.disconnect(cancelled);
    return this.injections.delete(id);
  }
}
