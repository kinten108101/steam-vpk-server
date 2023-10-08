import Gio from 'gi://Gio';
import { read_json, read_json_async } from './files.js';

export default class ManifestReader {
  _cache: Map<Gio.File, any> = new Map;

  async read_async(file: Gio.File) {
    let content = this._cache.get(file);
    if (content === undefined) {
      content = await read_json_async(file);
      this._cache.set(file, content);
    }
    return content;
  }

  read(file: Gio.File) {
    let content = this._cache.get(file);
    if (content === undefined) {
      content = read_json(file);
      this._cache.set(file, content);
    }
    return content;
  }

  clear() {
    this._cache.clear();
  }
}
