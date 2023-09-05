import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import AddonStorage from '../models/addon-storage.js';
import {
  g_model_foreach,
  param_spec_boolean,
  param_spec_object,
} from '../steam-vpk-utils/utils.js';
import { Archive } from './archiver.js';
import { list_file_async } from '../file.js';
import Settings from './settings.js';
import { AddonConfiguration } from '../models/profile.js';
import ProfileStore from '../models/profile-store.js';
import { Injection } from '../models/injection-store.js';

Gio._promisify(Gio.File.prototype, 'make_symbolic_link_async', 'make_symbolic_link_finish');
Gio._promisify(Gio.File.prototype, 'delete_async', 'delete_finish');

function throw_cancelled(): never {
  throw new GLib.Error(Gio.io_error_quark(), Gio.IOErrorEnum.CANCELLED, 'Cancelled');
}

abstract class InjectionError extends Error {}

export class DuplicatedInjectionError extends InjectionError {
  constructor() {
    super('Injection already exists');
  }
}

export class InjectionNotFoundError extends InjectionError {
  constructor() {
    super('Injection is not in record');
  }
}

export default interface Injector extends GObject.Object {
  connect(signal: 'running-prepare', callback: ($obj: this, id: string) => void): number;
  emit(signal: 'running-prepare', id: string): void;
  connect(signal: 'running-cleanup', callback: ($obj: this, id: string) => void): number;
  emit(signal: 'running-cleanup', id: string): void;
  connect(signal: 'session-start', callback: ($obj: this, id: string) => void): number;
  emit(signal: 'session-start', id: string): void;
  connect(signal: 'session-end', callback: ($obj: this, id: string) => void): number;
  emit(signal: 'session-end', id: string): void;
  connect(signal: 'session-finished', callback: ($obj: this, id: string) => void): number;
  emit(signal: 'session-finished', id: string): void;
  connect(signal: 'error', callback: ($obj: this) => void): number;
  emit(signal: 'error'): void;
  connect(signal: string, callback: ($obj: this, ...args: any[]) => void): number;
  emit(signal: string, ...args: any[]): void;
}
export default class Injector extends GObject.Object {
  static {
    GObject.registerClass(
    { Signals: {
        'running-prepare': { param_types: [GObject.TYPE_STRING] },
        'running-cleanup': { param_types: [GObject.TYPE_STRING] },
        'session-start': { param_types: [GObject.TYPE_STRING] },
        'session-end': { param_types: [GObject.TYPE_STRING] },
        'session-finished': { param_types: [GObject.TYPE_STRING] },
        'error': { param_types: [] },
      },
      Properties: {
        running: param_spec_boolean({ name: 'running', default_value: false }),
        linkdir: param_spec_object({ name: 'linkdir', objectType: Gio.File.$gtype }),
      },
    }, this);
  }

  linkdir: Gio.File | undefined;
  running!: boolean;
  has_error = false;

  addon_storage!: AddonStorage;
  profile_store!: ProfileStore;
  injections: WeakSet<Injection> = new WeakSet;

  bind(
  { addon_storage,
    profile_store,
    settings
  }:
  { addon_storage: AddonStorage;
    profile_store: ProfileStore;
    settings: Settings;
  }) {
    this.addon_storage = addon_storage;
    this.profile_store = profile_store;
    settings.bind_property_full('game-dir', this, 'linkdir', GObject.BindingFlags.SYNC_CREATE,
      (_binding, from: Gio.File | null) => {
        if (from === null) return [false, null];
        const newval = from.get_child('left4dead2').get_child('addons');
        return [true, newval];
      },
      () => {});
    this.connect('notify::linkdir', () => {
      console.debug('linkdir changed:', this.linkdir?.get_path());
    });
  }

  finish(injection: Injection) {
    if (!this.injections.has(injection)) throw new InjectionNotFoundError();
    this.has_error = false;
    this.emit('session-finished', injection.id);
  }

  make_injection() {
    return new Injection({
      target: this.profile_store.default_profile,
    });
  }

  async run(injection: Injection) {
    if (this.injections.has(injection)) throw new DuplicatedInjectionError();
    this.injections.add(injection);
    this.has_error = false;
    this.emit('running-prepare', injection.id);
    this.running = true;
    this.emit('session-start', injection.id);
    try {
      injection.time();
      await this.cleanup(injection);
      await this.load(injection);
      await new Promise((resolve) => {
        setTimeout(() => {
          resolve(null);
        }, 3000);
      });
      await this.link(injection);
      injection.timeEnd();
      injection.log(`Done in ${injection.elapsed}ms.`);
    } catch (error) {
      this.has_error = true;
      logError(error);
      if (error instanceof GLib.Error) {
        if (error.matches(Gio.io_error_quark(), Gio.IOErrorEnum.CANCELLED)) {
          injection.error('Aborted.');
        } else {
          injection.error(error.message || 'Unknown error');
        }
      } else if (error instanceof Error) {
        injection.error(error.message || 'Unknown error');
      } else {
        injection.error('Unknown untyped error');
      }
    }
    this.emit('session-end', injection.id);
    this.running = false;
    this.emit('running-cleanup', injection.id);
  }

  async cleanup(injection: Injection) {
    if (injection.cancellable.is_cancelled()) throw_cancelled();
    injection.log('Cleaning addons dir from last run...');
    if (!this.linkdir) throw new Error('linkdir has not been defined');
    const files = await list_file_async(this.linkdir);
    for (const x of files) {
      if (injection.cancellable.is_cancelled()) throw_cancelled();
      const name = x.get_basename();
      if (name === null) {
        console.warn('Path is invalid. Skipping...');
        continue;
      }
      if (!name.includes('@stvpk.vpk')) continue;
      await x.delete_async(GLib.PRIORITY_DEFAULT, injection.cancellable);
    }
  }

  async load(injection: Injection) {
    if (injection.cancellable.is_cancelled()) throw_cancelled();
    injection.log('Reading loadorder...');
    injection.target.loadorder.forEach(x => {
      if (injection.cancellable.is_cancelled()) throw_cancelled();
      const addon = this.addon_storage.idmap.get(x);
      if (addon === undefined) {
        return;
      }
      const config = injection.target.configmap.get(x);
      if (config === undefined) {
        return;
      }
      if (config.type !== 'addon' || !(config instanceof AddonConfiguration)) {
        return;
      }
      if (!config.active) {
        return;
      }
      const archive_group = addon.archive_group;
      if (!archive_group) {
        return;
      }
      g_model_foreach(archive_group.archives, (item: Archive) => {
        injection.sources.append(item.file);
      });
    });
  }

  async link(injection: Injection) {
    if (injection.cancellable.is_cancelled()) throw_cancelled();
    injection.log('Installing add-ons...');
    if (!this.linkdir) throw new Error('linkdir has not been defined');
    const id = injection.creation;
    if (!injection.sources) {
      console.warn(`Sources of injection \"${id}\" have not been prepared. Quitting...`);
      return;
    }
    let i = 0;
    let x: Gio.File | null = injection.sources.get_item(i) as Gio.File | null;
    while (x !== null) {
      if (injection.cancellable.is_cancelled()) throw_cancelled();
      const dest = Gio.File.new_for_path(GLib.build_filenamev([this.linkdir.get_path() || '', `${i}@stvpk.vpk`]));
      const symlink_value = x.get_path();
      if (symlink_value === null) {
        console.warn(`A source path is invalid. Skipping...`);
        continue;
      }
      try {
        await dest.make_symbolic_link_async(symlink_value, GLib.PRIORITY_DEFAULT, null);
      } catch (error) {
        logError(error as Error, 'Skipping...');
        continue;
      }
      i++;
      x = injection.sources.get_item(i) as Gio.File | null;
    }
  }
}
