import Gio from 'gi://Gio';
import { DBusService, ExportStoreService } from './dbus-service.js';
import { make_workshop_item_url } from '../steam-api.js';

export default function WorkshopService(
{ interface_name,
}:
{ interface_name: string;
}): DBusService {
  const service = Gio.DBusExportedObject.wrapJSObject(
`<node>
  <interface name="${interface_name}">
    <method name="GetWorkshopUrl">
      <arg name="id" type="s" direction="in" />
      <arg name="url" type="s" direction="out" />
    </method>
  </interface>
</node>`,
 new class {
    GetWorkshopUrl(publishedfileid: string): string {
      return make_workshop_item_url(publishedfileid);
    }
  });

  function export2dbus(connection: Gio.DBusConnection, path: string) {
    service.export(connection, path);
    return itf;
  }

  function save(storage: ExportStoreService) {
    storage.store(service);
    return itf;
  }

  const itf = {
    export2dbus,
    save,
  }

  return itf;
}
