import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

import AddonStorage from '../addon-storage.js';
import { DBusService, ExportStoreService } from './dbus-service.js';
import { promise_wrap } from '../steam-vpk-utils/utils.js';

export default function AddonsService(
{ interface_name,
  addon_storage,
}:
{ interface_name: string;
  addon_storage: AddonStorage;
}): DBusService {
  const service = Gio.DBusExportedObject.wrapJSObject(
`<node>
  <interface name="${interface_name}">
    <signal name="AddonsChanged">
      <arg name="list" type="aa{sv}" />
    </signal>
    <signal name="AddonsChangedAfter">
      <arg name="list" type="aa{sv}" />
    </signal>
    <method name="ForceUpdate" />
    <method name="Get">
      <arg name="id" type="s" direction="in" />
      <arg name="info" type="a{sv}" direction="out" />
    </method>
    <method name="HasArchive">
      <arg name="id" type="s" direction="in" />
      <arg name="has_archive" type="b" direction="out" />
    </method>
  </interface>
</node>`,
    new class {
    constructor() {
      addon_storage.connect(AddonStorage.Signals.addons_changed, () => {
        const arg = GLib.Variant.new_tuple([addon_storage.idmap2gvariant()]);
        service.emit_signal('AddonsChanged',      arg);
        // is dbus signal emission blocking?
        service.emit_signal('AddonsChangedAfter', arg);
      });
    }

    ForceUpdate() {
      promise_wrap(addon_storage.force_update.bind(addon_storage));
    }

    Get(id: string) {
      const addon = addon_storage.get(id);
      if (addon === undefined) return {};
      return GLib.Variant.new_tuple([addon.toGVariant()]);
    }

    HasArchive(id: string) {
      const addon = addon_storage.get(id);
      if (addon === undefined) return false;
      return addon.has_archive_lite();
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
  }
  return methods;
}
