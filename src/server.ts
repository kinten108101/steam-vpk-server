import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import AddonStorage from './models/addon-storage.js';
import DiskCapacity from './services/disk-capacity.js';
import SteamworkServices from './services/steam-api.js';
import Archiver from './services/archiver.js';
import Injector from './services/injector.js';
import InjectionStore from './models/injection-store.js';
import Settings from './services/settings.js';
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
import InjectorService from './exports/injector.js';
import AddonsService from './exports/addons.js';
import { BackgroundPortal, ListenPortalResponses } from './steam-vpk-utils/portals.js';
import WorkshopService from './exports/workshop.js';
import DiskService from './exports/disk.js';
import { ExportStore } from './exports/dbus-service.js';
import SettingsService from './exports/settings.js';
import { RequestApiImplement } from './exports/requestapi.js';
import ProfileStore from './models/profile-store.js';
import DownloadQueue from './models/download-queue.js';

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

  const settings = new Settings({
    settings_location: pkg_user_state_dir.get_child('settings.json'),
  });
  const download_queue = new DownloadQueue({
    download_dir,
  });
  const archiver = new Archiver();
  const steamapi = new SteamworkServices();
  const addon_storage = new AddonStorage({
    subdir_folder: addons_dir,
    pkg_user_state_dir: pkg_user_state_dir,
  });
  const profile_store = new ProfileStore({
    default_profile_path: pkg_user_state_dir.get_child('config.metadata.json'),
  });
  const disk_capacity = new DiskCapacity();
  const injector = new Injector();
  const injection_store = new InjectionStore();

  archiver.bind({
    download_queue,
    steamapi,
    addon_storage,
  });
  addon_storage.bind({
    archiver,
  });
  disk_capacity.bind({
    addon_storage,
  });
  injector.bind({
    addon_storage,
    profile_store,
    settings: settings,
  });
  settings.bind();

  [
    settings,
    download_queue,
    addon_storage,
    disk_capacity,
    settings,
    profile_store,
  ].forEach(x => {
    x.start().catch(error => logError(error));
  });

  const loop = new GLib.MainLoop(null, false);
  Gio.bus_own_name(
    Gio.BusType.SESSION,
    SERVER_ID,
    Gio.BusNameOwnerFlags.NONE,
    (connection: Gio.DBusConnection) => {
      const requestapi = RequestApiImplement({ connection });
      const export_store = ExportStore();
      ListenPortalResponses({
        connection,
      }).start();
      (async () => {
        const background_service = BackgroundPortal();

        try {
          await background_service.request_background();
        } catch(error) {
          logError(error);
        }

        try {
          await background_service.set_status('Powering Steam VPK Applications');
        } catch (error) {
          if (error instanceof GLib.Error && error.matches(Gio.io_error_quark(), Gio.IOErrorEnum.DBUS_ERROR)) {
            console.debug(error.message);
          } else logError(error);
        }

      })().catch(error => logError(error));
      InjectorService({
        connection,
        injector,
        injection_store,
      })
        .save(export_store);
      AddonsService({
        interface_name: `${SERVER_ID}.Addons`,
        addon_storage,
        profile_store,
      }).export2dbus(connection, `${SERVER_PATH}/addons`)
        .save(export_store);
      WorkshopService({
        interface_name: `${SERVER_ID}.Workshop`,
        steamapi,
        requestapi,
      }).export2dbus(connection, `${SERVER_PATH}/workshop`)
        .save(export_store);
      DiskService({
        interface_name: `${SERVER_ID}.Disk`,
        disk_capacity,
        addon_storage,
      }).export2dbus(connection, `${SERVER_PATH}/disk`)
        .save(export_store);
      SettingsService({
        interface_name: `${SERVER_ID}.Settings`,
        settings,
      }).export2dbus(connection, `${SERVER_PATH}/settings`)
        .save(export_store);
    },
    null,
    () => {
    console.log('Name lost');
    loop.quit();
    },
  );

  function run(argv: string[] | null): number {
    console.log('program args:', argv?.shift());
    loop.run();
    return 0;
  }

  return {
    run,
  };
}
