import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

import { DBusService, ExportStoreService } from './dbus-service.js';
import { vardict_make_v2 } from '../steam-vpk-utils/utils.js';
import ProfileStore from '../models/profile-store.js';
import { RequestApi } from './requestapi.js';
import { Addon } from '../models/addons.js';
import { Deserializer, Serializer } from '../services/serializers.js';
import ApiCache from '../models/api-cache.js';
import AddonStore from '../models/addon-store.js';
import { PublishedFileDetails } from '../services/schema/steam-api.js';
import ArchiveStore from '../models/archive-store.js';
import { Archive } from '../models/archives.js';
import { SERVER_ID } from '../const.js';
import { AddonStoreErrorEnum, addon_store_error_quark } from '../services/errors/addon-store.js';
import { create_id_from_workshop } from '../services/id/workshop.js';
import { IdErrorEnum, id_error_quark } from '../services/errors/id.js';

export default function AddonsService(
{ interface_name,
  addon_store,
  archive_store,
  profile_store,
  requestapi,
  addon2getaddonresponse,
  gpfd2addon,
  gpfd2archives,
  apicache,
}:
{ interface_name: string;
  addon_store: AddonStore;
  archive_store: ArchiveStore;
  profile_store: ProfileStore,
  requestapi: RequestApi;
  addon2getaddonresponse: () => Serializer<Addon, GLib.Variant>;
  gpfd2addon: () => Deserializer<PublishedFileDetails, Addon>;
  gpfd2archives: () => Deserializer<PublishedFileDetails, Archive[]>;
  apicache: ApiCache;
}): DBusService {
  interface_name;
  const service = Gio.DBusExportedObject.wrapJSObject(`<node>
  <interface name="${SERVER_ID}.Addons">
    <signal name="LoadOrderChanged">
      <arg name="list" type="as" />
      <arg name="ChangeDescription" type="a{sv}" />
    </signal>
    <signal name="AddonsChanged">
      <arg name="list" type="aa{sv}" />
    </signal>
    <signal name="AddonsStateChanged">
      <arg name="id" type="s" />
      <arg name="states" type="a{sv}" />
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
    <method name="CreateFromWorkshop">
      <arg name="client" type="s" direction="in" />
      <arg name="workshop-response-handle" type="s" direction="in" />
      <arg name="workshop-response-handle_2" type="s" direction="in" />
      <arg name="overrides" type="a{sv}" direction="in" />
    </method>
    <method name="Delete">
      <arg name="client" type="s" direction="in" />
      <arg name="id" type="s" direction="in" />
    </method>
    <method name="GetLoadorder">
      <arg name="profile" type="s" direction="in" />
      <arg name="info" type="as" direction="out" />
    </method>
    <method name="GetConfigurations">
      <arg name="profile" type="s" direction="in" />
      <arg name="info" type="a{sv}" direction="out" />
    </method>
  </interface>
</node>`,
  {
    ForceUpdate() {
      addon_store.request_fill();
    },
    Get(id: string): GLib.Variant | {} {
      const addon = addon_store.get(id);
      if (addon === undefined) return {};
      const gvariant = addon2getaddonresponse().serialize(addon);
      if (gvariant === undefined) return {};
      return GLib.Variant.new_tuple([gvariant]);
    },
    HasArchive(id: string): boolean {
      const addon = addon_store.get(id);
      if (addon === undefined) return false;
      const archives = addon.archives;
      if (archives === null) return false;
      if (archives.length <= 0) return false;
      return true;
    },
    CreateFromWorkshop(client: string, gpfd_handle: string, gps_handle: string, _overrides: any) {
      (async () => {
        const gpfd_response = apicache.get(gpfd_handle);
        if (gpfd_response === undefined) {
          throw new Error;
        }
        const gps_response = apicache.get(gps_handle);
        if (gps_response === undefined) {
          throw new Error;
        }
        const id = create_id_from_workshop(gpfd_response.content, gps_response.content);
        if (id === undefined) {
          throw new GLib.Error(
            id_error_quark(),
            IdErrorEnum.FAILED,
            `Cannot extract id for addon`);
        }
        console.log('id:', id);
        if (addon_store._id_map.has(id)) throw new Error("wtf");
        const addon = gpfd2addon().deserialize(gpfd_response.content, { id });
        if (addon === undefined) throw new Error;

        const stat_append = addon_store.append(addon);
        if (!stat_append) {
          throw new GLib.Error(
            addon_store_error_quark(),
            AddonStoreErrorEnum.EXISTS,
            `ID \"${addon.id}\" already exists`);
        }
        const archives = gpfd2archives().deserialize(gpfd_response.content, { id: addon.id });
        if (archives === undefined) throw new Error;
        archive_store.splice(archive_store.get_n_items(), 0, archives);
        requestapi.respond(client, 'CreateFromWorkshop', {
          status: 0,
        });
      })().catch(error => {
        logError(error);
        const domain: string | undefined = (() => {
          if (error instanceof GLib.Error) return GLib.quark_to_string(error.domain) || undefined;
          return undefined;
        })();
        const code: number | undefined = (() => {
          if (error instanceof GLib.Error) return error.code;
          return undefined;
        })();
        requestapi.respond(client, 'CreateFromWorkshop', {
          status: 1,
          data: {
            domain,
            code,
          },
        });
      });
    },
    Delete(client: string, id: string) {
      (async () => {
        const result = addon_store.delete(id);
        requestapi.respond(client, 'Delete', {
          status: result ? 0 : 1,
        });
      })().catch(error => {
        requestapi.respond(client, 'Delete', {
          status: 1,
          data: error,
        });
      });
    },
    GetLoadorder(profile: string) {
      if (profile === '')
        return profile_store.default_profile.loadorder;
      else throw new Error('Non-default profile is not yet supported');
    },
    GetConfigurations(profile: string) {
      if (profile === '') {
        const arr: [string, GLib.Variant][] = [];
        profile_store.default_profile.configmap.forEach((val, key) => {
          arr.push([key, val.toGVariant()]);
        });
        return GLib.Variant.new_tuple([vardict_make_v2(arr)]);
      }
      else throw new Error('Non-default profile is not yet supported');
    },
  });

  addon_store.connect('bind', (_obj, item: Addon) => {
    item.connect('notify::size', () => {
      const states: [string, GLib.Variant][] = [];
      states.push(['size', GLib.Variant.new_uint64(item.size)]);
      service.emit_signal('AddonsStateChanged',
        GLib.Variant.new_tuple([
          GLib.Variant.new_string(item.id),
          vardict_make_v2(states),
        ]));
    });
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
