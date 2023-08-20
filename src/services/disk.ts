import Gio from 'gi://Gio';
import { DBusService, ExportStoreService } from './dbus-service.js';
import DiskCapacity from '../disk-capacity.js';
import AddonStorage from '../addon-storage.js';
import { bytes2humanreadable } from '../file.js';

export default function DiskService(
{ interface_name,
  disk_capacity,
  addon_storage,
}:
{ interface_name: string;
  disk_capacity: DiskCapacity;
  addon_storage: AddonStorage;
}): DBusService {
  const service = Gio.DBusExportedObject.wrapJSObject(
`<node>
  <interface name="${interface_name}">
    <method name="GetAddonFolderSize">
      <arg name="id" type="s" direction="in" />
      <arg name="size" type="t" direction="out" />
      <arg name="human-readable-size" type="s" direction="out" />
    </method>
  </interface>
</node>`,
    new class {
      GetAddonFolderSize(id: string) {
        const addon = addon_storage.get(id);
        if (addon === undefined) return [0, ''];
        const size = disk_capacity.eval_size(addon.subdir);
        const text = bytes2humanreadable(size);
        return [size, text];
      }
    });

  function export2dbus(connection: Gio.DBusConnection, path: string) {
    service.export(connection, path);
    return methods;
  }

  function save(storage: ExportStoreService) {
    storage.store(service);
    return methods;
  }

  const methods = {
    export2dbus,
    save,
  };

  return methods;
}
