import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup';

import DiskCapacity from './services/disk-capacity.js';
import SteamworkServices from './services/steam-api.js';
import Archiver from './services/archiver.js';
import Injector from './services/injector.js';
import InjectionStore from './models/injection-store.js';
import Settings from './services/settings.js';
import {
  ADDON_DIR,
  ADDON_INDEX,
  BUILD_TYPE,
  DIR_NAME,
  DOWNLOAD_DIR,
  SERVER_ID,
  SERVER_PATH,
  USER_DATA_DIR,
  USER_STATE_DIR,
  VERSION,
} from './const.js';
import { create_json_async, make_dir_nonstrict } from './services/files.js';
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
import ProfilesService from './exports/profiles.js';
import ApiCache from './models/api-cache.js';
import ArchiveStore from './models/archive-store.js';
import { SerializerStore } from './models/serializer-store.js';
import IndexDirectory from './services/directory/index-dir.js';
import ManifestReader from './services/manifest-reader.js';
import AddonStore from './models/addon-store.js';
import DiskCapacityUpdater from './binders/disk-capacity.js';
import AddonManifestSerializer from './services/serializers/serializer/addon-manifest.js';
import AddonDeserializer from './services/serializers/deserializer/addon.js';
import ArchiveDeserializer from './services/serializers/deserializer/archive.js';
import AddonDirectoryBinder from './binders/addon-directory.js';
import GetAddonResponseSerializer from './services/serializers/serializer/get-addon-response.js';
import DefaultAddonBackend from './services/backends/addons.js';
import GPFD2Addon from './services/serializers/deserializer/gpfd-addon.js';
import GPFD2Archives from './services/serializers/deserializer/gpfd-archive.js';
import ApiCacheService from './exports/apicache.js';

export default function Server() {
  console.debug(`build-type: ${BUILD_TYPE}`);
  console.debug(`version: ${VERSION}`);

  const pkg_user_data_dir = Gio.File.new_for_path(
    GLib.build_filenamev([USER_DATA_DIR, DIR_NAME]),
  );
  make_dir_nonstrict(pkg_user_data_dir);
  console.debug('pkg-user-data-dir:', pkg_user_data_dir.get_path());

  const pkg_user_state_dir = Gio.File.new_for_path(
    GLib.build_filenamev([USER_STATE_DIR, DIR_NAME]),
  );
  make_dir_nonstrict(pkg_user_state_dir);
  console.debug(`pkg-user-state-dir: ${pkg_user_state_dir.get_path()}`);

  const addons_dir = pkg_user_data_dir.get_child(ADDON_DIR);
  make_dir_nonstrict(addons_dir);
  console.debug('addons-dir:', addons_dir.get_path());

  const download_dir = pkg_user_state_dir.get_child(DOWNLOAD_DIR);
  make_dir_nonstrict(download_dir);
  console.debug(`download-dir: ${download_dir.get_path()}`);

  const settings_location = pkg_user_state_dir.get_child('settings.json');
  create_json_async({}, settings_location).catch(error => {
    if (error instanceof GLib.Error && error.matches(Gio.io_error_quark(), Gio.IOErrorEnum.EXISTS)) {}
    else throw error;
  });

  const session = new Soup.Session;
  const serializer_store = new SerializerStore;
  const addon_store = new AddonStore();
  const archive_store = new ArchiveStore();
  const download_queue = new DownloadQueue({
    download_dir,
    session,
  });
  const profile_store = new ProfileStore({
    default_profile_path: pkg_user_state_dir.get_child('config.metadata.json'),
  });
  const injection_store = new InjectionStore();
  const apicache = new ApiCache();

  const settings = new Settings({
    settings_location: pkg_user_state_dir.get_child('settings.json'),
  });
  const disk_capacity = new DiskCapacity({
    dir: addons_dir,
  });
  const steamapi = new SteamworkServices({
    session,
  });
  const addons_dir_manager = new IndexDirectory({
    index_file: pkg_user_state_dir.get_child(ADDON_INDEX),
    location: pkg_user_data_dir.get_child(ADDON_DIR),
  })
  const addons_dir_manifest_reader = new ManifestReader();

  const archiver = new Archiver({
    download_queue,
    steamapi,
    archive_store,
    get_gpfd2archives: () => {
      return serializer_store.get('deserializer/gpfd-archive');
    },
  });
  const addon_backend = new DefaultAddonBackend({
    disk_capacity,
    serializer_store,
    addon_dir: addons_dir,
    archiver,
  });

  AddonDirectoryBinder({
    store: addon_store,
    archive_store,
    directory: addons_dir_manager,
    manifest_reader: addons_dir_manifest_reader,
    serializer_store,
    manifest2addon: 'deserializer/addon',
    manifest2archives: 'deserializer/archive',
  });

  DiskCapacityUpdater({
    disk_capacity,
    addon_store,
    addons_dir,
  });
  const injector = new Injector({
    addon_store,
    archive_store,
    profile_store,
    settings,
  });


  serializer_store.set(
    'deserializer/addon',
    new AddonDeserializer({
      archiver,
      addon_dir: addons_dir,
      disk_capacity,
      serializer_store,
      addon_backend,
    }));
  serializer_store.set(
    'deserializer/archive',
    new ArchiveDeserializer({
      archiver,
    }));
  serializer_store.set(
    'deserializer/gpfd-addon',
    new GPFD2Addon({
      addon_dir: addons_dir,
      disk_capacity,
      serializer_store,
      addon_backend,
    }));
  serializer_store.set(
    'deserializer/gpfd-archive',
    new GPFD2Archives({
      archiver,
    }));
  serializer_store.set(
    'serializer/addon-manifest',
    new AddonManifestSerializer({
      archive_store,
      disk_capacity,
    }));
  serializer_store.set(
    'serializer/get-addon-response',
    new GetAddonResponseSerializer({
      archive_store,
    }));

  [
    settings,
  ].forEach(x => {
    try {
      x.start();
    } catch (error) {
      logError(error);
    }
  });

  [
    profile_store,
  ].forEach(x => {
    x.start_async().catch(error => logError(error));
  });
  addon_store.request_fill();

  function on_bus_acquired(connection: Gio.DBusConnection) {
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
    ApiCacheService({
      connection,
      apicache,
    }).export2dbus()
      .save(export_store);
    InjectorService({
      connection,
      injector,
      injection_store,
    })
      .save(export_store);
    AddonsService({
      interface_name: `${SERVER_ID}.Addons`,
      addon_store,
      archive_store,
      profile_store,
      requestapi,
      addon2getaddonresponse: () => serializer_store.get('serializer/get-addon-response'),
      gpfd2addon: () => serializer_store.get('deserializer/gpfd-addon'),
      gpfd2archives: () => serializer_store.get('deserializer/gpfd-archive'),
      apicache,
    }).export2dbus(connection, `${SERVER_PATH}/addons`)
      .save(export_store);
    WorkshopService({
      interface_name: `${SERVER_ID}.Workshop`,
      steamapi,
      requestapi,
      apicache,
    }).export2dbus(connection, `${SERVER_PATH}/workshop`)
      .save(export_store);
    DiskService({
      interface_name: `${SERVER_ID}.Disk`,
      disk_capacity,
      addon_store,
    }).export2dbus(connection, `${SERVER_PATH}/disk`)
      .save(export_store);
    SettingsService({
      interface_name: `${SERVER_ID}.Settings`,
      settings,
    }).export2dbus(connection, `${SERVER_PATH}/settings`)
      .save(export_store);
    ProfilesService({
      connection,
      profile_store,
    });
  }

  const loop = new GLib.MainLoop(null, false);
  Gio.bus_own_name(
    Gio.BusType.SESSION,
    SERVER_ID,
    Gio.BusNameOwnerFlags.NONE,
    on_bus_acquired,
    null,
    () => {
      console.debug('Name lost');
      loop.quit();
    },
  );

  function run(argv: string[] | null): number {
    console.debug('program args:', argv?.shift());
    loop.run();
    return 0;
  }

  return {
    run,
  };
}
