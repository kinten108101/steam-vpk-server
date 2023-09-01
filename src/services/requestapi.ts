import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { SERVER_ID, SERVER_PATH } from '../const.js';
import { dbus_vardict } from '../steam-vpk-utils/dbus-utils.js';

export type RequestApi = ReturnType<typeof RequestApiImplement>;

export function RequestApiImplement(
{ connection,
}:
{ connection: Gio.DBusConnection;
}) {


  function respond(
    client: string,
    method_name: string,
    response:
  { status: number;
    data?: any;
  }) {
    const skeleton = Gio.DBusExportedObject.wrapJSObject(
    `<node>
      <interface name="${SERVER_ID}.Request">
        <signal name="Response">
          <arg name="status" type="i" />
          <arg name="data" type="a{sv}" />
        </signal>
      </interface>
    </node>`, {});
    try {
      skeleton.export(connection, `${SERVER_PATH}/request/${client}/${method_name}`);
    } catch (error) {
      if (error instanceof GLib.Error && error.matches(Gio.io_error_quark(), Gio.IOErrorEnum.EXISTS)) {}
      else {
        console.log((error as GLib.Error).domain);
        throw error;
      }
    }
    skeleton.emit_signal('Response', GLib.Variant.new_tuple([GLib.Variant.new_int32(response.status), dbus_vardict(response.data || {})]));
    setTimeout(() => {
      skeleton.unexport();
    }, 10000);
  }

  const services = {
    respond,
  };

  return services;
}
