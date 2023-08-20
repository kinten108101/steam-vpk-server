import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { DBusService, ExportStoreService } from './dbus-service.js';
import Settings from '../settings.js';

/**
 * Experimental writing service for this Gio.Setting namespace.
 *
 * This is ill-advised as write-access is now made public. Perhaps we need
 * an authentication method?
 */
export default function SettingsWriter(
{ interface_name,
  settings,
}:
{ interface_name: string;
  settings: Settings;
}): DBusService {
  const skeleton = Gio.DBusExportedObject.wrapJSObject(
`<node>
  <interface name="${interface_name}">
    <method name="Write">
      <arg name="key" type="" />
    </method>
  </interface>
</node>`,
    new class {
      Write(key: string, value: GLib.Variant): boolean {
        if (key === 'game-dir') {
          if (!value.is_of_type(GLib.VariantType.new('s'))) return false;
          settings.set_game_dir(value.deepUnpack());
          return true;
        }
        return false;
      }
    });

  function export2dbus(connection: Gio.DBusConnection, path: string) {
    skeleton.export(connection, path);
    return methods;
  }

  function save(storage: ExportStoreService) {
    storage.store(skeleton);
    return methods;
  }

  const methods = {
    export2dbus,
    save,
  }
  return methods;
}
