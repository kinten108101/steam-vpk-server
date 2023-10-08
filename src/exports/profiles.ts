import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { SERVER_ID, SERVER_PATH } from '../const.js';
import ProfileStore from '../models/profile-store.js';
import Profile from '../models/profile.js';
import { g_model_foreach, vardict_make_v2 } from '../steam-vpk-utils/utils.js';

export default function ProfilesService(
{ connection,
  profile_store,
}:
{ connection: Gio.DBusConnection;
  profile_store: ProfileStore;
}) {
  const profile_interface =
`<node>
  <interface name="${SERVER_ID}.Profile">
    <property name="Id" type="t" access="read" />
    <property name="Loadorder" type="as" access="read" />
    <property name="Configurations" type="aa{sv}" access="read" />
  </interface>
</node>`;
  const session_map: WeakMap<Profile, {
    service: Gio.DBusExportedObject;
  }> = new WeakMap;

  profile_store.connect('bind', (_obj, item) => {
    const profile_impl = {
      get Id(): string {
        return item.id;
      },
      get Loadorder() {
        return item.loadorder;
      },
      get Configurations() {
        const arr: [string, GLib.Variant][] = [];
        item.configmap.forEach((val, key) => {
          arr.push([key, val.toGVariant()]);
        });
        return GLib.Variant.new_tuple([vardict_make_v2(arr)]);
      }
    };
    const service = Gio.DBusExportedObject.wrapJSObject(profile_interface, profile_impl);
    service.export(connection, `${SERVER_PATH}/profiles/${item.id}`);
    session_map.set(item, {
      service,
    });
  });

  profile_store.connect('unbind', (_obj, item) => {
    const session = session_map.get(item);
    if (session === undefined) return;
    session.service.unexport();
  });

  g_model_foreach(profile_store, item => {
    if (!(item instanceof Profile)) return;
    profile_store.emit('bind', item);
  })
}
