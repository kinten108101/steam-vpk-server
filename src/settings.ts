import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import { GSETTINGS_ID } from './const.js';
import { g_param_default, registerClass } from './steam-vpk-utils/utils.js';

Gio._promisify(Gtk.FileDialog.prototype, 'select_folder', 'select_folder_finish');

export default class Settings extends GObject.Object {
  static [GObject.properties] = {
    'game-dir': GObject.ParamSpec.object('game-dir', 'game-dir', 'game-dir', g_param_default, Gio.File.$gtype),
    'game-dir-raw': GObject.ParamSpec.string('game-dir-raw', 'game-dir-raw', 'game-dir-raw', g_param_default, null),
  };

  static {
    registerClass({}, this);
  }
  gio_settings: Gio.Settings;

  game_dir!: Gio.File;
  game_dir_raw!: string;

  constructor() {
    super({});
    this.gio_settings = new Gio.Settings({ schema_id: GSETTINGS_ID });
  }

  bind() {
    this.connect('notify::game-dir-raw', this.updateGameDir);
    this.gio_settings.bind('game-dir', this, 'game-dir-raw', Gio.SettingsBindFlags.DEFAULT);
  }

  async start() {
    this.updateGameDir();
    console.info('game-dir:', this.game_dir.get_path());
  }

  updateGameDir = () => {
    this.game_dir = Gio.File.new_for_path(this.game_dir_raw);
  }

  set_game_dir(val: string) {
    this.gio_settings.set_string('game-dir', val);
  }
}
