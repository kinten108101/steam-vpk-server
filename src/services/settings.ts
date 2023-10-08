import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import { create_json, read_json_async, replace_json_async } from './files.js';

export default class Settings extends GObject.Object {
  static [GObject.properties] = {
    game_dir: GObject.ParamSpec.object(
      'game-dir', '', '',
      GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT,
      Gio.File.$gtype),
    settings_location: GObject.ParamSpec.object(
      'settings-location', '', '',
      GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT,
      Gio.File.$gtype),
  };

  static {
    GObject.registerClass({}, this);
  }
  game_dir!: Gio.File | null;
  settings_location!: Gio.File;

  constructor(params: {
    settings_location: Gio.File;
  }) {
    super(params);
    this.connect('notify::game-dir', () => {
      (async () => {
        await this.save_async();
      })().catch(logError);
    });
  }

  start() {
    try {
      create_json({}, this.settings_location);
    } catch (error) {
      if (error instanceof GLib.Error && error.matches(Gio.io_error_quark(), Gio.IOErrorEnum.EXISTS)) {}
      else throw error;
    }
    this.load_async().catch(logError);
  }

  async load_async() {
    let settings: unknown;
    try {
      settings = await read_json_async(this.settings_location);
    } catch (error) {
      logError(error);
      return;
    }
    if (typeof settings !== 'object') {
      console.warn('Settings file: not object');
      return;
    }
    if (settings === null) {
      console.warn('Settings file: is null');
      return;
    }
    if ('game_dir' in settings && typeof settings.game_dir === 'string') {
      this.game_dir = Gio.File.new_for_path(settings.game_dir);
    }
  }

  async save_async() {
    const content = {
      game_dir: this.game_dir?.get_path() || undefined,
    };

    try {
      await replace_json_async(content, this.settings_location);
    } catch (error) {
      logError(error);
      return;
    }
  }
}
