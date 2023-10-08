import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import { IdentifiableObject } from '../models.js';

export class Archive extends IdentifiableObject {
  static {
    GObject.registerClass({
      Signals: {
        'removed': {},
      },
    }, this);
  }

  file: Gio.File;

  constructor(params: {
    file: Gio.File;
  }) {
    const id = params.file.get_path();
    if (id === null) throw new Error;
    super({
      id,
    });
    this.file = params.file;
  }

  exists(): boolean {
    return this.file.query_exists(null);
  }
}

export class LocalArchive extends Archive {
  static {
    GObject.registerClass({}, this);
  }

  constructor(params: ConstructorParameters<typeof Archive>[0]) {
    const { ...superparams } = params;
    super(superparams);
  }
}

export class RemoteArchive extends Archive {
  static {
    GObject.registerClass({}, this);
  }

  url: GLib.Uri;
  expected_size?: number;
  fetch_from_remote: () => void;

  constructor(params: {
    url: GLib.Uri;
    expected_size?: number;
    fetch_from_remote: (archive: RemoteArchive) => void;
  } & ConstructorParameters<typeof Archive>[0]) {
    const { url, expected_size, ...superparams } = params;
    super(superparams);
    this.url = url;
    this.expected_size = expected_size;
    this.fetch_from_remote = () => params.fetch_from_remote(this);
  }
}
