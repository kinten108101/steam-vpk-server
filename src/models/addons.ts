import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';

export interface AddonBackend {
  init(item: Addon): void;
  jsonfy(item: Addon): Uint8Array;
}

export class Addon extends GObject.Object {
  static {
    GObject.registerClass({
      Properties: {
        id: GObject.ParamSpec.string(
          'id', 'ID', 'In-app ID of add-on item with the format {ascii-title}@{utf8-creator[0]}',
          GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT,
          null),
        remote: GObject.ParamSpec.boolean(
          'remote', 'Remote', 'Whether or not the add-on item is pulled from an upstream counterpart',
          GObject.ParamFlags.READABLE,
          false),
        steam_id: GObject.ParamSpec.string(
          'steam-id', 'Steam ID', 'Published File ID of upstream (Steam Workshop) add-on item',
          GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT,
          null),
        steam_url: GObject.ParamSpec.jsobject(
          'steam-url', 'Steam URL', 'URL to upstream (Steam Workshop) add-on item',
          GObject.ParamFlags.READABLE),
        title: GObject.ParamSpec.string(
          'title', 'Title', 'Name of the add-on in UTF8',
          GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT,
          null),
        description: GObject.ParamSpec.string(
          'description', 'Description', 'Description of the add-on',
          GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT,
          null),
        categories: GObject.ParamSpec.jsobject(
          'categories', 'Categories', '',
          GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT),
        creators: GObject.ParamSpec.jsobject(
          'creators', 'Creators', '',
          GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT),
        time_updated: GObject.ParamSpec.jsobject(
          'time-updated', 'Time Updated', '',
          GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT),
        subdir: GObject.ParamSpec.object(
          'subdir', 'Subdirectory', 'Path to add-on item folder',
          GObject.ParamFlags.READABLE,
          Gio.File.$gtype),
        info: GObject.ParamSpec.object(
          'info', 'Info', 'Path to the manifest file in add-on item folder',
          GObject.ParamFlags.READABLE,
          Gio.File.$gtype),
        size: GObject.ParamSpec.uint64(
          'size', '', '',
          GObject.ParamFlags.READABLE,
          0, Number.MAX_SAFE_INTEGER,
          0),
        archives: GObject.ParamSpec.jsobject(
          'archives', '', '',
          GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT),
        can_install_missing_archives: GObject.ParamSpec.boolean(
          'can-install-missing-archives', '', '',
          GObject.ParamFlags.READABLE,
          false),
      },
    }, this);
  };

  static getGVariantType() {
    return GLib.VariantType.new_array(
      GLib.VariantType.new_dict_entry(
        GLib.VariantType.new('s'),
        GLib.VariantType.new('v')
      )
    );
  }

  id!: string;

  _remote!: boolean;
  get remote() {
    return this._remote;
  }
  _set_remote(val: boolean) {
    if (this._remote === val) return;
    this._remote = val;
    this.notify('remote');
  }

  steam_id!: string | null;

  _steam_url!: GLib.Uri | null;
  get steam_url() {
    return this._steam_url;
  }
  _set_steam_url(val: GLib.Uri | null) {
    if (this._steam_url?.get_path() === val?.get_path()) return;
    this._steam_url = val;
    this.notify('steam-url');
  }

  title!: string | null;
  description!: string | null;
  categories!: Set<string> | null;
  creators!: Set<string> | null;
  time_updated!: Date | null;

  _subdir!: Gio.File | null;
  get subdir() {
    return this._subdir;
  }
  _set_subdir(val: Gio.File) {
    this._subdir = val;
    this.notify('subdir');
  }

  _info!: Gio.File | null;
  get info() {
    return this._info;
  }
  _set_info(val: Gio.File | null) {
    if (this._info === val) return;
    this._info = val;
    this.notify('info');
  }

  _size!: number;
  get size() {
    return this._size;
  }
  _set_size(val: number) {
    this._size = val;
    this.notify('size');
  }

  archives!: string[] | null;

  _can_install_missing_archives!: boolean;
  get can_install_missing_archives() {
    return this._can_install_missing_archives;
  }
  _set_can_install_missing_archives(val: boolean) {
    if (this._can_install_missing_archives === val) return;
    this._can_install_missing_archives = val;
    this.notify('can-install-missing-archives');
  }

  jsonfy() {
    return this._backend.jsonfy(this);
  };

  _backend: AddonBackend;

  constructor(params: {
    id: string;
    steam_id: string | null;
    title: string | null;
    description: string | null | null;
    categories: Set<string> | null;
    creators: Set<string> | null;
    time_updated: Date | null;
    addon_dir: Gio.File;
    archives: string[] | null;
  }, backend: AddonBackend) {
    const {
      addon_dir,
      ...gparams } = params;
    super(gparams);
    this._backend = backend;
    this._backend.init(this);
  }
}
