import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import { registerClass } from './steam-vpk-utils/utils.js';
import { WeakRefMap } from './steam-vpk-utils/weakrefmap.js';
import Profile from './profile.js';

export default class LoadorderResolver extends GObject.Object {
  static {
    registerClass({}, this);
  }
  default_profile: Profile;
  custom_profiles: Set<Profile> = new Set;
  id_map: WeakRefMap<string, Profile> = new WeakRefMap();

  constructor(params: {
    default_profile_path: Gio.File,
  }) {
    super({});
    this.default_profile = new Profile({
      id: 'no id',
      file: params.default_profile_path,
    });
  }

  async start() {
    await this.default_profile.start();
  }

  bind() {}

  register_custom_profile(profile: Profile) {
    if (this.custom_profiles.has(profile)) {
      console.warn(`Registering profile \"${profile.id}\" which already exists. Quitting...`);
      return;
    }
    this.custom_profiles.add(profile);
    this.id_map.set(profile.id, profile);
  }
}
