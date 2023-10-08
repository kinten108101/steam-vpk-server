import Gio from 'gi://Gio';
import ApiCache from "../models/api-cache.js";
import { SERVER_ID, SERVER_PATH } from '../const.js';
import { ExportStoreService } from './dbus-service.js';

export default function ApiCacheService(
{ connection,
  apicache,
}:
{ connection: Gio.DBusConnection;
  apicache: ApiCache;
}) {
  const service = Gio.DBusExportedObject.wrapJSObject(
`<node>
  <interface name="${SERVER_ID}.ApiCache">
    <method name="Delete">
      <arg name="response_handler" type="s" direction="in" />
      <arg name="result" type="b" direction="out" />
    </method>
  </interface>
</node>`,
  {
    Delete(id: string) {
      return apicache.delete(id);
    }
  });

  function export2dbus() {
    service.export(connection, `${SERVER_PATH}/apicache`);
    return services;
  }

  function save(storage: ExportStoreService) {
    storage.store(service);
    return services;
  }

  const services = {
    export2dbus,
    save,
  };

  return services;
}
