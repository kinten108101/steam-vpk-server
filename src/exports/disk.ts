import Gio from 'gi://Gio';
import { DBusService, ExportStoreService } from './dbus-service.js';
import DiskCapacity from '../services/disk-capacity.js';
import { bytes2humanreadable } from '../steam-vpk-utils/files.js';
import { MappedStore } from '../models.js';
import { Addon } from '../models/addons.js';

export default function DiskService(
{ interface_name,
  disk_capacity,
  addon_store,
}:
{ interface_name: string;
  disk_capacity: DiskCapacity;
  addon_store: MappedStore<Addon>;
}): DBusService {
  const service = Gio.DBusExportedObject.wrapJSObject(
`<node>
  <interface name="${interface_name}">
    <property name="TotalUsage" type="t" access="read" />
    <property name="FreeSpace" type="t" access="read" />
    <property name="TotalSpace" type="t" access="read" />
    <method name="GetAddonFolderSize">
      <arg name="id" type="s" direction="in" />
      <arg name="size" type="t" direction="out" />
      <arg name="human-readable-size" type="s" direction="out" />
    </method>
  </interface>
</node>`,
    {
      get TotalUsage() {
        return disk_capacity.used;
      },
      get FreeSpace() {
        return disk_capacity.fs_free;
      },
      get TotalSpace() {
        return disk_capacity.fs_size;
      },
      GetAddonFolderSize(id: string) {
        const addon = addon_store.get(id);
        if (addon === undefined) return [0, ''];
        const size = addon.size;
        const text = bytes2humanreadable(size);
        return [size, text];
      },
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
