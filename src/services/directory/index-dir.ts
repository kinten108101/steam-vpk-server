import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { Directory } from '../directory.js';
import { create_json, read_json_async, replace_json } from '../files.js';
import { IndexFileManifest, SubdirManifest } from '../schema/index-dir.js';

export class Subdir extends GObject.Object {
  static $gtype: GObject.GType<Subdir>;

  static {
    GObject.registerClass({
      Properties: {
        id: GObject.ParamSpec.string(
          'id', '', '',
          GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT,
          null),
        file: GObject.ParamSpec.object(
          'file', '', '',
          GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT,
          Gio.File.$gtype),
      },
    }, this);
  }

  id!: string;
  file!: Gio.File;

  constructor(params: {
    id: string;
    file: Gio.File;
  }) {
    super(params);
  }
}

export default interface IndexDirectory {
  connect(signal: 'prepare-load', callback: (obj: this) => void): number;
  connect(signal: 'load', callback: (obj: this, item: Subdir) => void): number;
  connect(signal: 'cleanup-load', callback: (obj: this) => void): number;
  emit(signal: 'prepare-load'): void;
  emit(signal: 'load', item: Subdir): void;
  emit(signal: 'cleanup-load'): void;

  /* inherit */
  connect(signal: 'notify', callback: (obj: this, pspec: GObject.ParamSpec) => void): number;
  emit(signal: 'notify'): void;
}

export default class IndexDirectory extends Directory {
  static {
    GObject.registerClass({
      Properties: {
        index_file: GObject.ParamSpec.object(
          'index-file', '', '',
          GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT,
          Gio.File.$gtype),
      },
      Signals: {
        'prepare-load': {},
        'load': {
          param_types: [Subdir.$gtype],
        },
        'cleanup-load': {},
      },
    }, this);
  }

  _index_file!: Gio.File | null;
  get index_file() {
    if (this._index_file === null) throw new Error;
    return this._index_file;
  }
  set index_file(val: Gio.File) {
    this._index_file = val;
    this.notify('index-file');
  }

  _index_content_cache: IndexFileManifest | null = null;
  _monitor: Gio.FileMonitor;

  constructor(params: {
    index_file: Gio.File,
    location: Gio.File,
  }) {
    super(params);
    this._monitor = this.index_file.monitor_file(Gio.FileMonitorFlags.WATCH_MOVES, null);
  }

  async load_index_file_async(
    on_prepare: () => boolean,
    on_load: (subdir: Subdir) => void,
    on_cleanup: () => void,
  ) {
    on_prepare();

    let obj: IndexFileManifest;
    try {
      obj = await read_json_async(this.index_file);
    } catch (error) {
      if (error instanceof GLib.Error) {
        if (error.matches(error.domain, Gio.IOErrorEnum.NOT_FOUND)) {
          console.warn('Index file not found! Requested a reset.');
          this._create_index_file();
          return;
        } else {
          throw error;
        }
      } else if (error instanceof TypeError) {
        console.warn('Index file could not be decoded! Must be resolved manually.');
        return;
      } else if (error instanceof SyntaxError) {
        console.warn('Index file has JSON syntax error! Must be resolved manually.');
        return;
      } else {
        throw error;
      }
    }

    // validation
    const subdirs = obj.subdirs;
    if (subdirs === undefined) {
      console.warn('Index file lacks required fields! Must be resolved manually.')
      return;
    }
    if (!Array.isArray(subdirs)) {
      console.warn('Should be an array!')
      return;
    }

    this._index_content_cache = obj;

    subdirs.forEach(x => {
      const id = x.id;
      if (!id) return;

      const subdir = new Subdir({
        id,
        file: this.location.get_child(id),
      });

      on_load(subdir);
    });

    on_cleanup();

    return;
  }

  save_single_item(id: string, operation: (subdir: Omit<Gio.File, 'get_parent'>) => boolean) {
    const result = operation(this.location);
    if (!result) return;

    const prev_subdirs = this._index_content_cache?.subdirs || [];
    const current_entry: SubdirManifest = {
      id,
    };
    const index_content: IndexFileManifest = {
      subdirs: [
        current_entry,
        ...prev_subdirs,
      ],
    };
    this._index_content_cache = index_content;

    try {
      replace_json(index_content, this.index_file);
    } catch (error) {
      logError(error as Error, 'Quitting...');
      return;
    }
  }

  remove_single_item(id: string, operation: (subdir: Omit<Gio.File, 'get_parent'>) => boolean) {
    const result = operation(this.location);
    if (!result) return;

    const prev_subdirs = this._index_content_cache?.subdirs || [];
    const idx = prev_subdirs.findIndex(x => (x.id === id));
    if (idx === -1) {
      console.debug(`Could not find item \"${id}\" in index`);
      return;
    }
    prev_subdirs.splice(idx, 1);
    const index_content: IndexFileManifest = {
      subdirs: prev_subdirs,
    };
    this._index_content_cache = index_content;

    try {
      replace_json(index_content, this.index_file);
    } catch (error) {
      logError(error as Error, 'Quitting...');
      return;
    }
  }

  _create_index_file() {
    const content: IndexFileManifest = {
      subdirs: [],
    };

    try {
      create_json(content, this.index_file);
    } catch (error) {
      logError(error)
      console.error('Quitting...');
      return;
    }
  }
}
