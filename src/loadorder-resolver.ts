import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import { Configuration, Separator } from './addon-storage.js';
import { registerClass } from './utils.js';

export class Profile {
  id: string;
  name?: string;
  configState!: Gio.File;
  loadorder: string[] = [];
  configmap: Map<string, Configuration> = new Map();
  sepmap: Map<string, Separator> = new Map();

  constructor(
  { id,
    name,
  }:
  { id: string;
    name?: string;
  }) {
    this.id = id;
    this.name = name;
  }
}

export class WeakRefMap<T, V extends object> extends Map {
  forEach(callbackfn: (value: V | undefined, key: T, map: Map<T, WeakRef<V>>) => void, thisArg?: any): void {
    super.forEach((value: WeakRef<V>, key: T, map: Map<T, WeakRef<V>>) => {
      return callbackfn(value.deref(), key, map);
    }, thisArg);
  }

  get(key: T): V | undefined {
    const ref = super.get(key);
    return ref?.deref();
  }

  set(key: T, value: V): this {
    return super.set(key, new WeakRef(value));
  }

  entries(): IterableIterator<[T, WeakRef<V>]> {
    throw new Error('Method not implemented.');
  }

  keys(): IterableIterator<T> {
    throw new Error('Method not implemented.');
  }

  values(): IterableIterator<WeakRef<V>> {
    throw new Error('Method not implemented.');
  }

  [Symbol.iterator](): IterableIterator<[T, WeakRef<V>]> {
      throw new Error('Method not implemented.');
  }
}

export class Session {

}

export default class LoadorderResolver {
  static default_profile = new Profile({ id: 'default' });

  application!: Gtk.Application;
  profiles: Set<Profile> = new Set;
  id_map: WeakRefMap<string, Profile> = new Map();
  session_map: WeakMap<Gtk.WindowGroup, Profile> = new WeakMap();

  bind() {}

  register_session(session: Gtk.WindowGroup, profile: Profile = LoadorderResolver.default_profile) {
    this.session_map.set(session, profile);
  }

  register_profile(profile: Profile) {
    if (this.profiles.has(profile)) {
      console.warn(`Registering profile \"${profile.id}\" which already exists. Quitting...`);
      return;
    }
    this.profiles.add(profile);
    this.id_map.set(profile.id, profile);
  }

  get_loadorder(): string[] {
    return [];
  }

  get_configmap(): Map<string, Configuration> {
    return new Map;
  }
}

// this.addon_storage.loadorder_push('9234');

/*

a      get_idmap
a      get_idmap
a      get_idmap



*/



export function UseLoadorderResolver(klass: { new(...args: any[]): any }) {
  const newklass = class extends klass {
    loadorder_resolver!: LoadorderResolver;

    get_loadorder = (): string[] => {
      return [];
    }

    bind(
    { loadorder_resolver,
      ...params
    }:
    { loadorder_resolver: LoadorderResolver;

    } & object) {
      super.bind(params);
      this.loadorder_resolver = loadorder_resolver;
    }

    resolve_session<T extends typeof newklass>(klass: T) {
      return class extends klass {

      }
    }
  };
  registerClass({}, newklass);
  return newklass;
}



// const new_addon_storage = addon_storage.session();

export function profileThunker(originalMethod: (profile: Profile, ...args: any[]) => any, _context: ClassMethodDecoratorContext) {
  return function replacementMethod(this: any, ...args: any[]) {
    return (profile: Profile) => {
      return originalMethod.call(this, profile, args);
    }
  }
}
