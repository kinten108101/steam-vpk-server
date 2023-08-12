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
import InjectorService from './services/injector.js';
import AddonsService from './services/addons.js';
import { BackgroundPortal } from './steam-vpk-utils/portals.js';

export default function Server() {
  console.log(`build-type: ${BUILD_TYPE}`);
  console.log(`version: ${VERSION}`);

  const pkg_user_data_dir = Gio.File.new_for_path(
    GLib.build_filenamev([USER_DATA_DIR, DIR_NAME]),
  );
  make_dir_nonstrict(pkg_user_data_dir);
  console.log('pkg-user-data-dir:', pkg_user_data_dir.get_path());

  const pkg_user_state_dir = Gio.File.new_for_path(
    GLib.build_filenamev([USER_STATE_DIR, DIR_NAME]),
  );
  make_dir_nonstrict(pkg_user_state_dir);
  console.log(`pkg-user-state-dir: ${pkg_user_state_dir.get_path()}`);

  const addons_dir = pkg_user_data_dir.get_child(ADDON_DIR);
  make_dir_nonstrict(addons_dir);
  console.log('addons-dir:', addons_dir.get_path());

  const download_dir = pkg_user_state_dir.get_child(DOWNLOAD_DIR);
  make_dir_nonstrict(download_dir);
  console.log(`download-dir: ${download_dir.get_path()}`);

  const settings = new Settings();
  const downloader = new Downloader({
    download_dir,
  });
  const archiver = new Archiver();
  const steamapi = new SteamworkServices();
  const addon_storage = new AddonStorage({
    subdir_folder: addons_dir,
    pkg_user_state_dir: pkg_user_state_dir,
  });
  const loadorder_resolver = new LoadorderResolver();
  const disk_capacity = new DiskCapacity();
  const injector = new Injector();
  const injection_store = new InjectionStore();

  archiver.bind({
    downloader,
    steamapi,
    addon_storage: addon_storage,
  });
  loadorder_resolver.bind();
  addon_storage.bind({
    archiver: archiver,
    loadorder_resolver: loadorder_resolver,
  });
  disk_capacity.bind({
    addon_storage: addon_storage,
    settings: settings.gio_settings,
  });
  injector.bind({
    addon_storage: addon_storage,
    settings: settings,
  });
  settings.bind();

  [
    settings,
    downloader,
    addon_storage,
    disk_capacity,
    settings,
    injector,
  ].forEach(x => {
    x.start().catch(error => logError(error));
  });

  Gio.bus_own_name(
    Gio.BusType.SESSION,
    SERVER_ID,
    Gio.BusNameOwnerFlags.NONE,
    null,
    (connection: Gio.DBusConnection) => {
      InjectorService({
        injector: injector,
        injection_store: injection_store,
      }).export2dbus(connection, SERVER_PATH);
      AddonsService({
        addon_storage: addon_storage,
      }).export2dbus(connection, SERVER_PATH);
    },
    () => {
    console.log('name lost');
    },
  );

  function run(argv: string[] | null): number {
    console.log('args:', argv);
    const loop = new GLib.MainLoop(null, false);
    loop.run();
    return 0;
  }

  return {
    run,
  };
}
