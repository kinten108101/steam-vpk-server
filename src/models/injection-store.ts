import GObject from 'gi://GObject';
import { SignalStore } from '../models.js';
import { Injection } from '../services/injection.js';

export default class InjectionStore extends SignalStore<Injection> {
  static last_id = 0;

  static generate_id(): string {
    this.last_id++;
    return String(new Date().getTime()) + '-' + String(this.last_id);
  }

  static {
    GObject.registerClass({}, this);
  }

  constructor(params = {}) {
    super({
      item_type: Injection.$gtype,
      ...params,
    });
  }
}
