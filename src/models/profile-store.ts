import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Profile from './profile.js';
import { registerClass } from '../steam-vpk-utils/utils.js';
import { SignalStore } from '../models.js';

export default class ProfileStore extends SignalStore<Profile> {
  static {
    registerClass({}, this);
  }

  custom_profiles!: Gio.ListModel;
  default_profile_path: Gio.File;

  constructor(params: {
    default_profile_path: Gio.File,
  }) {
    super({ item_type: Profile.$gtype });
    this.connect('notify::n-items', this._update_custom_profiles_model.bind(this));
    this._update_custom_profiles_model();
    this.default_profile_path = params.default_profile_path;
    const default_profile = new Profile({
      id: 'default',
      file: this.default_profile_path,
    });
    this.append(default_profile);
  }

  get default_profile() {
    return this.get_item(0) as Profile;
  }

  _update_custom_profiles_model() {
    this.custom_profiles = new Gtk.SliceListModel({
      model: this,
      offset: 1,
      size: this.get_n_items() - 1,
    });

  }

  async start_async() {
    await this.default_profile?.start_async();
  }
}
