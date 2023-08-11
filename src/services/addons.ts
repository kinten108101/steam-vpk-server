import Gio from 'gi://Gio';

import AddonStorage from '../addon-storage.js';
import { DBusService } from './service.js';

export default function AddonsService(
{ addon_storage

}:
{ addon_storage: AddonStorage

}): DBusService {
  addon_storage
  function export2dbus(connection: Gio.DBusConnection, path: string) {
    connection;
    path;
  };
  return {
    export2dbus,
  }
}
