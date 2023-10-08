import GObject from 'gi://GObject';
import { IdentifiableObject, SignalStore } from '../models.js';

export class ApiCacheItem extends IdentifiableObject {
  static {
    GObject.registerClass({
      Properties: {
        content: GObject.ParamSpec.jsobject(
          'content', '', '',
          GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT),
      },
    }, this);
  }

  content!: any;

  constructor(params: {
    content: any;
  }) {
    super({
      id: ApiCache.generate_id(),
      ...params,
    });
  }
}

export default class ApiCache extends SignalStore<ApiCacheItem> {
  static prev_id = 0;
  static generate_id(): string {
    return String(++this.prev_id);
  }

  static {
    GObject.registerClass({}, this);
  }

  constructor(params = {}) {
    super({
      item_type: ApiCacheItem.$gtype,
      ...params,
    });
  }

  add(content: any) {
    const item = new ApiCacheItem({
      content
    });
    this.append(item);
    return item.id;
  }
}
