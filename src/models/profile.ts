import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import { TYPE_JSOBJECT, param_spec_object, param_spec_string, registerClass } from '../steam-vpk-utils/utils.js';
import { create_json_async, read_json_async, replace_json_async } from '../services/files.js';
import { IdentifiableObject } from '../models.js';

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

type ChangeDescription = {
  type: 'move',
  source: number,
  target: number,
} |
{
  type: 'swap',
  source: number,
  target: number,
} |
{
  type: 'append',
} |
{
  type: 'remove',
  target: number,
} |
{
  type: 'unknown',
};

export type ProfileSignal = 'loadorder-changed' | 'order-changed' | 'entry-content-changed';

export default interface Profile {
  connect(signal: 'order-changed', callback: ($obj: this, list: string[], change: ChangeDescription) => void): number;
  connect(signal: 'notify', callback: ($obj: this, pspec: GObject.ParamSpec) => void): number;
  emit(signal: 'order-changed', list: string[], change: ChangeDescription): void;
  emit(signal: 'notify', pspec: GObject.ParamSpec): void;
}
export default class Profile extends IdentifiableObject {
  static [GObject.properties] = {
    name: param_spec_string({ name: 'name' }),
    file: param_spec_object({ name: 'file', objectType: Gio.File.$gtype }),
  };

  static [GObject.signals] = {
    'loadorder-changed': {},
    'order-changed': {
      param_types: [TYPE_JSOBJECT, TYPE_JSOBJECT],
    },
    'entry-content-changed': {},
  }

  static {
    registerClass({}, this);
  }

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
    this.connect('order-changed', () => {
      (async () => {
        await this.save_async();
      })().catch(logError);
    }); // experimental
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

  async start_async() {
    try {
      await create_json_async(this.toSerializable(), this.file);
      console.info(`Created ${this.file.get_path()} for the first time.`);
    } catch (error) {
      if (error instanceof GLib.Error) {
        if (error.matches(Gio.io_error_quark(), Gio.IOErrorEnum.EXISTS)) {}
      } else throw error;
    }
    await this.load_async();
  }

  async load_async() {
    let obj;
    try {
      obj = await read_json_async(this.file);
    } catch (error) {
      logError(error);
      return;
    }
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
    this.configmap = draft_configmap;

    this.emit('order-changed', this.loadorder, { type: 'unknown' });
  }

  remove(id: string): boolean {
    const idx = this.loadorder.indexOf(id);
    if (idx === -1) {
      console.warn(`Removing loadorder-entry \"${this.id}\":`, `Tried to remove from a loadorder it does not belong. Quitting...`);
      return false;
    }
    this.loadorder.splice(idx, 1);
    this.configmap.delete(id);
    this.emit('order-changed', this.loadorder, {
      type: 'remove',
      target: idx,
    });
    return true;
  }

  new_addon_configuration(id: string): boolean {
    if (this.loadorder.includes(id)) {
      console.warn(`Appending loadorder-entry \"${this.id}\":`, 'Add-on is already included. Quitting...');
      return false;
    }
    this.loadorder.push(id);
    const config = new AddonConfiguration({
      id,
      active: false,
    });
    this.configmap.set(id, config);
    this.emit('order-changed', this.loadorder, { type: 'append' });
    return true;
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
    this.emit('order-changed', this.loadorder, {
      type: 'swap',
      source,
      target,
    });
  }

  move(source: number, target: number): boolean {
    const item = this.loadorder[source];
    if (item === undefined) return false;
    this.loadorder.splice(target, 0, item);
    const source_re = this.loadorder.indexOf(item);
    if (source_re === -1) {
      console.warn('Item disappeared during move');
      return false;
    }
    this.loadorder.splice(source_re, 1);
    this.emit('order-changed', this.loadorder, {
      type: 'move',
      source,
      target,
    });
    return true;
  }

  async save_async() {
    try {
      await replace_json_async(this.toSerializable(), this.file);
    } catch (error) {
      logError(error);
      return;
    }
  }
}
