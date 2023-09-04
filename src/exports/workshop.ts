import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { DBusService, ExportStoreService } from './dbus-service.js';
import SteamworkServices, { make_workshop_item_url } from '../services/steam-api.js';
import { RequestApi } from './requestapi.js';

export default function WorkshopService(
{ interface_name,
  steamapi,
  requestapi,
}:
{ interface_name: string;
  steamapi: SteamworkServices;
  requestapi: RequestApi;
}): DBusService {
  const service = Gio.DBusExportedObject.wrapJSObject(
`<node>
  <interface name="${interface_name}">
    <method name="GetWorkshopUrl">
      <arg name="id" type="s" direction="in" />
      <arg name="url" type="s" direction="out" />
    </method>
    <method name="GetPublishedFileDetails">
      <arg name="client-name" type="s" direction="in" />
      <arg name="url" type="s" direction="in" />
    </method>
  </interface>
</node>`,
 new class {
    GetWorkshopUrl(publishedfileid: string): string {
      return make_workshop_item_url(publishedfileid);
    }

    GetPublishedFileDetails(client: string, url: string) {
      (async () => {
        const id = steamapi.getWorkshopItemId(url);
        const data = await steamapi.getPublishedFileDetails(id);
        requestapi.respond(client, 'GetPublishedFileDetails', {
          status: 0,
          data,
        });
      })().catch(error => {
        requestapi.respond(client, 'GetPublishedFileDetails', {
          status: 1,
          data: {
            code: error instanceof GLib.Error ? error.code : -1,
            msg: error.msg || '',
          },
        });
      });
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
