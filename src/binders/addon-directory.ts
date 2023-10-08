import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { Addon } from '../models/addons.js';
import IndexDirectory from '../services/directory/index-dir.js';
import ManifestReader from '../services/manifest-reader.js';
import { AddonManifest } from '../services/schema/addon-manifest.js';
import { ADDON_INFO } from '../const.js';
import { make_dir_nonstrict } from '../services/files.js';
import AddonStore from '../models/addon-store.js';
import { SerializerStore } from '../models/serializer-store.js';
import { Deserializer, DeserializerTypes } from '../services/serializers.js';
import { Archive } from '../models/archives.js';
import ArchiveStore from '../models/archive-store.js';

export default function AddonDirectoryBinder(
{ store,
  archive_store,
  directory,
  manifest_reader,
  serializer_store,
  manifest2addon,
  manifest2archives,
}:
{ store: AddonStore;
  archive_store: ArchiveStore;
  directory: IndexDirectory;
  manifest_reader: ManifestReader;
  serializer_store: SerializerStore;
  manifest2addon: DeserializerTypes;
  manifest2archives: DeserializerTypes;
}) {
  let bind_signals_disable_requests = 0;

  store.connect('request-fill', () => {
    directory.load_index_file_async(
      () => {
        return true;
      },
      (subdir) => {
        (async () => {

          const info = subdir.file.get_child(ADDON_INFO);

          let jsobject;
          try {
            jsobject = await manifest_reader.read_async(info);
          } catch (error) {
            if (error instanceof GLib.Error && error.matches(Gio.io_error_quark(), Gio.IOErrorEnum.NOT_FOUND)) {
              console.warn(`Caught a file handler error in add-on folder \"${subdir.id}\". Add-on possibly does not exist. Must be manually resolved. Skipping...`)
              return;
            } else {
              logError(error);
              return;
            }
          }

          let manifest = (() => {
            if (typeof jsobject.stvpkid === 'string')
              return jsobject as AddonManifest;
            else return undefined;
          })();

          if (manifest === undefined) {
            console.warn(`Add-on manifest lacks required fields! Must be manually resolved. Skipping...`);
            return;
          }

          const _manifest2addon: Deserializer<AddonManifest, Addon> = serializer_store.get(manifest2addon);
          const addon = _manifest2addon.deserialize(manifest, {});
          if (addon === undefined) {
            console.warn('Could not register add-on. Continue anyway...');
          } else {
            bind_signals_disable_requests++;
            store.append(addon);
            bind_signals_disable_requests--;
          }

          const _manifest2archives: Deserializer<AddonManifest, Archive[]> = serializer_store.get(manifest2archives);
          const archives = _manifest2archives.deserialize(manifest, {});
          if (archives === undefined) {
            console.warn('Could not register archives. Skipping...');
          } else {
            archive_store.splice(archive_store.get_n_items(), 0, archives);
          }
        })().catch(logError);
      },
      () => {
        manifest_reader.clear();
      }
    ).catch(logError);
  });

  store.connect('bind', (_obj, item) => {
    if (bind_signals_disable_requests > 0) return;
    console.log('save item');

    directory.save_single_item(
      item.id,
      (_subdir) => {
        if (!item.subdir || !item.info) return false;
        try {
          make_dir_nonstrict(item.subdir);
        } catch (error) {
          logError(error);
          return false;
        }

        try {
          const destination = item.info;
          const content = item.jsonfy();
          destination.replace_contents(content, null, false, Gio.FileCreateFlags.NONE, null);
        } catch (error) {
          logError(error);
          return false;
        }
        return true;
      });
  });

  store.connect('unbind', (_obj, item) => {
    if (bind_signals_disable_requests > 0) return;
    console.log('remove item');

    directory.remove_single_item(
      item.id,
      (_subdir) => {
        try {
          if (!item.subdir) return false;
          item.subdir.trash(null);
        } catch (error) {
          logError(error);
          return false;
        }
        return true;
      });
  });
}
