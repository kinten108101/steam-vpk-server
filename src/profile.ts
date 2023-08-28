import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import { param_spec_object, param_spec_string, registerClass } from './steam-vpk-utils/utils.js';
import { create_json, read_json, replace_json } from './file.js';

export type LoadorderEntries = 'addon';

function make_configuration(manifest: any) {
  const type: string = (() => {
    if (typeof manifest.type !== 'string')
      return 'addon';
    return manifest.type;
  })();
  const id: string = (() => {
    if (typeof manifest.id !== 'string')
      return undefined;
    return manifest.id;
  })();
  const base = {
    id,
  };
  switch (type as LoadorderEntries) {
  case 'addon':
    return make_addon_configuration(base, manifest);
  default:
    return undefined;
  }
}

export class Configuration extends GObject.Object {
  static [GObject.properties] = {
    type: GObject.ParamSpec.string(
      'type', '', '',
      GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT,
      null),
    id: GObject.ParamSpec.string(
      'id', '', '',
      GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT,
      null),
  };

  static {
    registerClass({}, this);
  }

  id!: string;
  type!: LoadorderEntries;

  constructor(params: {
    id: string,
    type: LoadorderEntries,
  }) {
    super(params);
  }

  toSerializable() {
    return {
      type: this.type,
      id: this.id,
    }
  }

  toPreGVariant() {
    return {
      type: GLib.Variant.new_string(this.type),
      id: GLib.Variant.new_string(this.id),
    };
  }

  toGVariant() {
    return new GLib.Variant('a{sv}', this.toPreGVariant());
  }
}

function make_addon_configuration(base: { id: string }, manifest: any) {
  return new AddonConfiguration({
    ...base,
    active: (() => {
      if (typeof manifest.active !== 'boolean') return false;
      return manifest.active;
    })(),
  });
}

export class AddonConfiguration extends Configuration {
  static {
    registerClass({
      Properties: {
        active: GObject.ParamSpec.boolean(
          'active', '', '',
          GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT,
          false),
      },
    }, this);
  }

  active!: boolean;

  constructor(params: {
    id: string,
    active: boolean,
  }) {
    super({
      ...params,
      type: 'addon',
    });
  }

  toSerializable() {
    return {
      ...super.toSerializable(),
      active: this.active,
    }
  }

  toPreGVariant() {
    return {
      ...super.toPreGVariant(),
      active: GLib.Variant.new_boolean(this.active),
    };
  }

  toGVariant() {
    return new GLib.Variant('a{sv}', this.toPreGVariant());
  }
}

export type ProfileSignal = 'loadorder-changed' | 'order-changed' | 'entry-content-changed' | 'notify';

export default interface Profile {
  connect(signal: ProfileSignal, cb: (obj: this, ...args: any[]) => void): number;
  emit(signal: ProfileSignal): void;
}
export default class Profile extends GObject.Object {
  static [GObject.properties] = {
    id: param_spec_string({ name: 'id' }),
    name: param_spec_string({ name: 'name' }),
    file: param_spec_object({ name: 'file', objectType: Gio.File.$gtype }),
  };

  static [GObject.signals] = {
    'loadorder-changed': {},
    'order-changed': {},
    'entry-content-changed': {},
  }

  static {
    registerClass({}, this);
  }

  id!: string;
  name?: string;
  file!: Gio.File;

  loadorder: string[] = [];
  configmap: Map<string, Configuration> = new Map();

  constructor(params: {
    id: string,
    name?: string,
    file: Gio.File,
  }) {
    super(params);
    this.connect('loadorder-changed', this.save.bind(this)); // experimental
    this.connect('order-changed', this.save.bind(this)); // experimental
    this.connect('entry-content-changed', this.save.bind(this)); // experimental
  }

  toSerializable() {
    const addonlist: any[] = [];
    this.loadorder.forEach(x => {
      const config = this.configmap.get(x);
      if (config === undefined) {
        console.warn('Configuration for loadorder entry does not exist. Skipping...')
        return;
      }
      addonlist.push(config.toSerializable());
    });
    return {
      addonlist,
    };
  }

  async start() {
    try {
      create_json(this.toSerializable(), this.file);
      console.info(`Created ${this.file.get_path()} for the first time.`);
    } catch (error) {
      if (error instanceof GLib.Error) {
        if (error.matches(Gio.io_error_quark(), Gio.IOErrorEnum.EXISTS)) {}
      } else throw error;
    }
    this.load();
  }

  load() {
    const obj = read_json(this.file);
    const addonlist = obj['addonlist'];
    if (!Array.isArray(addonlist) || addonlist === undefined) {
      console.warn(`Loading loadorder-entry \"${this.id}\":`, 'Empty add-on collection in file. Must be resolved manually. Quitting...');
      return;
    }
    const draft_loadorder: string[] = [];
    const draft_configmap: Map<string, Configuration> = new Map();
    addonlist.forEach(x => {
      const id = x['id'];
      if (id === undefined) {
        console.warn(`Loading loadorder-entry \"${this.id}\":`, 'Load-order entry lacks required field \"id\". Skipping...');
        return;
      }
      if (draft_loadorder.includes(id)) {
        console.warn(`Loading loadorder-entry \"${this.id}\":`, 'Duplicated load-order entry! Continue anyway...');
      }
      draft_loadorder.push(id);

      const config = make_configuration(x);
      if (config === undefined) {
        console.warn(`Loading loadorder-entry \"${this.id}\":`, 'Bad file syntax. Skipping...');
        return;
      }
      if (draft_configmap.has(id)) {
        console.warn(`Loading loadorder-entry \"${this.id}\":`, 'Duplicated config-map entry! Continue anyway...');
      }
      draft_configmap.set(id, config);
    });
    this.loadorder = draft_loadorder;
    console.log(this.loadorder);
    this.configmap = draft_configmap;

    this.emit('loadorder-changed');
  }

  remove(id: string) {
    const idx = this.loadorder.indexOf(id);
    if (idx === -1) {
      console.warn(`Removing loadorder-entry \"${this.id}\":`, `Tried to remove from a loadorder it does not belong. Quitting...`);
      return;
    }
    // this is slow, ik. Should use a GModel which implements a binary tree
    const draft_loadorder = this.loadorder.filter((_, i) => i !== idx);
    const draft_configmap = new Map(this.configmap);
    draft_configmap.delete(id);
    this.loadorder = draft_loadorder;
    this.configmap = draft_configmap;
    this.emit('loadorder-changed');
  }

  new_addon_configuration(id: string) {
    if (this.loadorder.includes(id)) {
      console.warn(`Appending loadorder-entry \"${this.id}\":`, 'Add-on is already included. Quitting...');
      return;
    }
    this.loadorder.push(id);
    const config = new AddonConfiguration({
      id,
      active: false,
    });
    this.configmap.set(id, config);
    this.emit('loadorder-changed');
  }

  swap(source: number, target: number) {
    const tmp = this.loadorder[source];
    if (tmp === undefined) {
      console.warn(`Swap index of tmp out-of-bound. Got ${source}. Quitting...`);
      return;
    }
    const tgt = this.loadorder[target];
    if (tgt === undefined) {
      console.warn(`Swap index of tgt out-of-bound. Got ${tgt}. Quitting...`);
      return;
    }
    this.loadorder[source] = tgt;
    this.loadorder[target] = tmp;
    this.emit('order-changed');
  }

  swap_silent(source: number, target: number): boolean {
    const tmp = this.loadorder[source];
    if (tmp === undefined) {
      console.warn(`Swap index of tmp out-of-bound. Got ${source}. Quitting...`);
      return false;
    }
    const tgt = this.loadorder[target];
    if (tgt === undefined) {
      console.warn(`Swap index of tgt out-of-bound. Got ${tgt}. Quitting...`);
      return false;
    }
    this.loadorder[source] = tgt;
    this.loadorder[target] = tmp;
    return true;
  }

  move_up_silent(source: number): number {
    const stat = this.swap_silent(source, source - 1);
    if (stat) return source - 1;
    return NaN;
  }

  move_down_silent(source: number): number {
    const stat = this.swap_silent(source, source + 1);
    if (stat) return source + 1;
    return NaN;
  }

  insert_silent(source: number, target: number) {
    const stepper = source > target ? this.move_up_silent : this.move_down_silent;
    let last_step = source;
    const count = Math.abs(source - target);
    for (let i = 0; i < count; i++) {
      try {
        last_step = stepper(last_step);
      } catch (error) {
        logError(error as Error, 'Skipping...');
      }
    }
  }

  insert(source: number, target: number) {
    this.insert_silent(source, target);
    this.emit('order-changed');
  }

  save() {
    try {
      replace_json(this.toSerializable(), this.file);
    } catch (error) {
      logError(error);
      return;
    }
  }
}
