import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import Downloader from './downloader.js';
import AddonStorage from './addon-storage.js';
import DiskCapacity from './disk-capacity.js';
import SteamworkServices from './steam-api.js';
import Archiver from './archiver.js';
import Injector, { InjectionStore } from './injector.js';
import Settings from './settings.js';
import LoadorderResolver from './loadorder-resolver.js';
import {
  ADDON_DIR,
  BUILD_TYPE,
  DIR_NAME,
  DOWNLOAD_DIR,
  SERVER_ID,
  SERVER_PATH,
  USER_DATA_DIR,
  USER_STATE_DIR,
  VERSION,
} from './const.js';
import { make_dir_nonstrict } from './file.js';
import { registerClass } from './utils.js';
import InjectorService from './services/injector.js';
import AddonsService from './services/addons.js';

export default class Server extends GObject.Object {
  static {
    registerClass({}, this);
  };

  pkg_user_data_dir: Gio.File;
  pkg_user_state_dir: Gio.File;
  addons_dir: Gio.File;
  download_dir: Gio.File;

  settings: Settings;
  downloader: Downloader;
  archiver: Archiver;
  steamapi: SteamworkServices;
  addon_storage: AddonStorage;
  loadorder_resolver: LoadorderResolver;
  disk_capacity: DiskCapacity;
  injector: Injector;
  injection_store: InjectionStore;

  constructor() {
    super({});
    this.pkg_user_data_dir = Gio.File.new_for_path(
      GLib.build_filenamev([USER_DATA_DIR, DIR_NAME]),
    );
    this.pkg_user_state_dir = Gio.File.new_for_path(
      GLib.build_filenamev([USER_STATE_DIR, DIR_NAME]),
    );
    this.addons_dir = this.pkg_user_data_dir.get_child(ADDON_DIR);
    this.download_dir = this.pkg_user_state_dir.get_child(DOWNLOAD_DIR);

    this.settings = new Settings();
    this.downloader = new Downloader({
      download_dir: this.download_dir,
    });
    this.archiver = new Archiver();
    this.steamapi = new SteamworkServices();
    this.addon_storage = new AddonStorage({
      subdir_folder: this.addons_dir,
      pkg_user_state_dir: this.pkg_user_state_dir,
    });
    this.loadorder_resolver = new LoadorderResolver();
    this.disk_capacity = new DiskCapacity();
    this.injector = new Injector();
    this.injection_store = new InjectionStore();
  }

  bind() {
    this.archiver.bind({
      downloader: this.downloader,
      steamapi: this.steamapi,
      addon_storage: this.addon_storage,
    });
    this.loadorder_resolver.bind();
    this.addon_storage.bind({
      archiver: this.archiver,
      loadorder_resolver: this.loadorder_resolver,
    });
    this.disk_capacity.bind({
      addon_storage: this.addon_storage,
      settings: this.settings.gio_settings,
    });
    this.injector.bind({
      addon_storage: this.addon_storage,
      settings: this.settings,
    });
    this.settings.bind();
  }

  async start(argv: string[] | null) {
    console.log(`build-type: ${BUILD_TYPE}`);
    console.log(`version: ${VERSION}`);
    argv;

    try {
      make_dir_nonstrict(this.pkg_user_data_dir);
      console.log('pkg-user-data-dir:', this.pkg_user_data_dir.get_path());
    } catch (error) {
      logError(error);
      console.error('Quitting...');
      return;
    }

    try {
      make_dir_nonstrict(this.pkg_user_state_dir);
      console.log(`pkg-user-state-dir: ${this.pkg_user_state_dir.get_path()}`);
    } catch (error) {
      logError(error)
      console.error('Quitting...');
      return;
    }

    [
      this.settings,
      this.downloader,
      this.addon_storage,
      this.disk_capacity,
      this.settings,
      this.injector,
    ].forEach(x => {
      x.start().catch(error => logError(error));
    });

    Gio.bus_own_name(Gio.BusType.SESSION, SERVER_ID, Gio.BusNameOwnerFlags.NONE, this.onBusAcquired, null, null);
  }

  onBusAcquired = (connection: Gio.DBusConnection, name: string) => {
    console.log('Acquired name', name);
    InjectorService({
      injector: this.injector,
      injection_store: this.injection_store,
    }).export2dbus(connection, SERVER_PATH);
    AddonsService({
      addon_storage: this.addon_storage,
    }).export2dbus(connection, SERVER_PATH);
  };
}


