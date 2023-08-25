import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import { g_param_default, param_spec_object, promise_wrap, registerClass } from './steam-vpk-utils/utils.js';
import { create_json_async, read_json_async, replace_json_async } from './file.js';

export default class Settings extends GObject.Object {
  static [GObject.properties] = {
    'game-dir': GObject.ParamSpec.object('game-dir', 'game-dir', 'game-dir', g_param_default, Gio.File.$gtype),
    settings_location: param_spec_object({ name: 'settings-location', objectType: Gio.File.$gtype }),
  };

  static {
    registerClass({}, this);
  }
  game_dir!: Gio.File | null;
  settings_location!: Gio.File;

  constructor(params: {
    settings_location: Gio.File;
  }) {
    super(params);
  }

  bind() {
    this.connect('notify::game-dir', this._save);
  }

  _load = () => {
    promise_wrap(async () => {
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
    });
  }

  _save = () => {
    promise_wrap(async () => {
      const content = {
        game_dir: this.game_dir?.get_path() || '',
      };

      try {
        await replace_json_async(content, this.settings_location);
      } catch (error) {
        logError(error);
        return;
      }
    });
  }

  async start() {
    try {
      await create_json_async({}, this.settings_location);
    } catch (error) {
      if (error instanceof GLib.Error && error.matches(Gio.io_error_quark(), Gio.IOErrorEnum.EXISTS)) {}
      else throw error;
    }
    this._load();
    console.info('game-dir:', this.game_dir?.get_path());
  }
}
