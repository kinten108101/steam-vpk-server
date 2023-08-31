import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

import AddonStorage from '../addon-storage.js';
import { DBusService, ExportStoreService } from './dbus-service.js';
import { vardict_make_v2 } from '../steam-vpk-utils/utils.js';
import LoadorderResolver from '../loadorder-resolver.js';

export default function AddonsService(
{ interface_name,
  addon_storage,
  loadorder_resolver,
}:
{ interface_name: string;
  addon_storage: AddonStorage;
  loadorder_resolver: LoadorderResolver,
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
    <method name="GetLoadorder">
      <arg name="profile" type="s" direction="in" />
      <arg name="info" type="as" direction="out" />
    </method>
    <method name="GetConfigurations">
      <arg name="profile" type="s" direction="in" />
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
      addon_storage.force_update()
        .catch(error => logError(error));
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

    GetLoadorder(profile: string) {
      if (profile === '')
        return loadorder_resolver.default_profile.loadorder;
      else throw new Error('Non-default profile is not yet supported');
    }

    GetConfigurations(profile: string) {
      if (profile === '') {
        const arr: [string, GLib.Variant][] = [];
        loadorder_resolver.default_profile.configmap.forEach((val, key) => {
          arr.push([key, val.toGVariant()]);
        });
        return GLib.Variant.new_tuple([vardict_make_v2(arr)]);
      }
      else throw new Error('Non-default profile is not yet supported');
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
