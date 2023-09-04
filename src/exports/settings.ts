import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { DBusService, ExportStoreService } from './dbus-service.js';
import Settings from '../services/settings.js';

/**
 * Experimental writing service for this Gio.Setting namespace.
 *
 * This is ill-advised as write-access is now made public. Perhaps we need
 * an authentication method?
 */
export default function SettingsService(
{ interface_name,
  settings,
}:
{ interface_name: string;
  settings: Settings;
}): DBusService {
  const skeleton = Gio.DBusExportedObject.wrapJSObject(
`<node>
  <interface name="${interface_name}">
    <property name="GameDirectory" type="s" access="readwrite" />
  </interface>
</node>`,
    new class {
      set GameDirectory(val: string) {
        const path = Gio.File.new_for_path(val);
        settings.game_dir = path;
        skeleton.emit_property_changed('GameDirectory', GLib.Variant.new_string(settings.game_dir.get_path() || ''));
      }

      get GameDirectory() {
        return settings.game_dir?.get_path() || '';
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
