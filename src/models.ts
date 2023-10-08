import GLib from '@girs/glib-2.0';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';

export class IdentifiableObject extends GObject.Object {
  static {
    GObject.registerClass({
      GTypeName: 'StvpkIdentificableObject',
      Properties: {
        id: GObject.ParamSpec.string(
          'id', 'Identifier', 'An application-scoped unique key for the object',
          GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT,
          null),
      },
    }, this);
  }

  id!: string;

  constructor(params: { id: string }) {
    super(params);
  }
}

export class MappedStore<T extends IdentifiableObject> extends Gio.ListStore<T> {
  static {
    GObject.registerClass({
      GTypeName: 'StvpkMappedStore',
    }, this);
  }

  _id_map: Map<string, T> = new Map;

  constructor(params: {
    item_type: GObject.GType<GObject.Object>,
  }) {
    super(params);
  }

  append(item: T): void {
    this._id_map.set(item.id, item);
    super.append(item);
  }

  insert(position: number, item: T): void {
    if (position > this.get_n_items() || position < 0) throw new Error;
    this._id_map.set(item.id, item);
    super.insert(position, item);
  }

  remove(position: number): void {
    if (position >= this.get_n_items() || position < 0) throw new Error;
    const item = this.get_item(position);
    if (item === null) throw new Error;
    this._id_map.delete(item.id);
    super.remove(position);
  }

  remove_all(): void {
    this._id_map.clear();
    super.remove_all();
  }

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

  insert_sorted(item: T, compare_func: GLib.CompareDataFunc): number {
    this._id_map.set(item.id, item);
    return this.insert_sorted(item, compare_func);
  }

  get(id: string) {
    return this._id_map.get(id);
  }

  get_item(idx: number) {
    return super.get_item(idx) as T | null;
  }

  delete(id: string): boolean {
    const item = this._id_map.get(id);
    if (item === undefined) return false;
    const [result, idx] = this.find(item);
    if (result === false) {
      console.error(`Item \"${id}\" has map entry but no store ref?`);
      return false;
    }
    this.remove(idx);
    return true;
  }

  forEach(predicate: (item: T, i: number, arr: this) => void) {
    let i = 0;
    let item_iter = this.get_item(i);
    while (item_iter !== null) {
      predicate(item_iter as T, i, this);
      i++;
      item_iter = this.get_item(i);
    }
  }
}

export interface SignalStore<T extends IdentifiableObject> extends MappedStore<T> {
  connect(signal: 'bind', callback: ($obj: this, item: T) => void): number;
  emit(signal: 'bind', item: T): void;
  connect(signal: 'unbind', callback: ($obj: this, item: T) => void): number;
  emit(signal: 'unbind', item: T): void;
  // inherit
  connect(signal: string, callback: ($obj: this, ...args: any[]) => void): number;
  emit(signal: string, ...args: any[]): void;
}

export class SignalStore<T extends IdentifiableObject> extends MappedStore<T> {
  static {
    GObject.registerClass({
      GTypeName: 'StvpkSignalStore',
      Signals: {
        'bind': {
          param_types: [GObject.TYPE_OBJECT],
        },
        'unbind': {
          param_types: [GObject.TYPE_OBJECT],
        },
      },
    }, this);
  }

  append(item: T): void {
    this.emit('bind', item);
    super.append(item);
  }

  insert(position: number, item: T): void {
    this.emit('bind', item);
    super.insert(position, item);
  }

  remove(position: number): void {
    const item = this.get_item(position);
    if (item === null) throw new Error;
    this.emit('unbind', item);
    super.remove(position);
  }

  remove_all(): void {
    super.splice(0, this.get_n_items(), []);
  }

  splice(position: number, n_removals: number, additions: T[]): void {
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

  insert_sorted(item: T, compare_func: GLib.CompareDataFunc): number {
    this.emit('bind', item);
    return super.insert_sorted(item, compare_func);
  }
}
