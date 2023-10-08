import GObject from 'gi://GObject';
import { SignalStore } from '../models.js';
import { Archive } from './archives.js';

export default class ArchiveStore extends SignalStore<Archive> {
  static {
    GObject.registerClass({}, this);
  }

  constructor(params = {}) {
    super({
      item_type: Archive.$gtype,
      ...params,
    })
  }
}
