import GLib from 'gi://GLib';
import { Serializer } from "../../serializers.js";
import { Addon } from '../../../models/addons.js';
import { vardict_make } from '../../../steam-vpk-utils/utils.js';
import ArchiveStore from '../../../models/archive-store.js';
import { Archive, LocalArchive, RemoteArchive } from '../../../models/archives.js';
import { ArchiveType } from '../../schema/archive-manifest.js';

export default class GetAddonResponseSerializer implements Serializer<Addon, GLib.Variant> {
  _archive_store: ArchiveStore;

  constructor(params: {
    archive_store: ArchiveStore;
  }) {
    this._archive_store = params.archive_store;
  }

  serialize(item: Addon): GLib.Variant {
    const gvariant = vardict_make({
      stvpkid: GLib.Variant.new_string(item.id),
      publishedfileid: (() => {
        if (item.steam_id === null) return null;
        return GLib.Variant.new_string(item.steam_id);
      })(),
      time_updated: (() => {
        if (item.time_updated === null) return null;
        return GLib.Variant.new_uint64(item.time_updated.getTime() / 1000);
      })(),
      title: (() => {
        if (item.title === null) return null;
        return GLib.Variant.new_string(item.title);
      })(),
      description: (() => {
        if (item.description === null) return null;
        return GLib.Variant.new_string(item.description);
      })(),
      creators: (() => {
        const arr: GLib.Variant[] = [];
        const creators = item.creators;
        if (creators === null) return null;
        creators.forEach((_x, key) => {
          const val = vardict_make({
            id: (() => {
              return GLib.Variant.new_string(key);
            })(),
          });
          arr.push(val);
        });
        return GLib.Variant.new_array(
          GLib.VariantType.new_array(
            GLib.VariantType.new_dict_entry(
              GLib.VariantType.new('s'),
              GLib.VariantType.new('v')
            )
          ),
          arr
        );
      })(),
      subdir: (() => {
        const subdir = item.subdir;
        if (subdir === null) return null;
        return GLib.Variant.new_string(subdir.get_path())
      })(),
      archive_group: (() => {
        if (!item.archives) return null;
        const arr: GLib.Variant[] = [];
        item.archives.forEach(x => {
          const archive = this._archive_store.get(x);
          if (archive === undefined) return;
          const gvariant = this._serialize_archive_each(archive);
          if (gvariant === undefined) return;
          arr.push(gvariant);
        });
        return GLib.Variant.new_array(
          GLib.VariantType.new_array(
            GLib.VariantType.new_dict_entry(
              GLib.VariantType.new('s'),
              GLib.VariantType.new('v')
            )
          ),
          arr
        );
      })(),
    });
    return gvariant;
  }

  _serialize_archive_each(archive: Archive): GLib.Variant | undefined {
    if (archive instanceof LocalArchive) {
      return this._serialize_local_archive(archive);
    } else if (archive instanceof RemoteArchive) {
      return this._serialize_remote_archive(archive);
    } else return undefined;
  }

  _serialize_local_archive(archive: LocalArchive): GLib.Variant | undefined {
    const type: ArchiveType = 'local';
    const val = vardict_make({
      type: GLib.Variant.new_string(type),
      path: (() => {
        const path = archive.file.get_path();
        if (path === null) return null;
        return GLib.Variant.new_string(path);
      })(),
    });
    return val;
  }

  _serialize_remote_archive(archive: RemoteArchive): GLib.Variant | undefined {
    const type: ArchiveType = 'steam';
    const val = vardict_make({
      type: GLib.Variant.new_string(type),
      url: (() => {
        const url = archive.url.to_string();
        if (url === null) return null;
        return GLib.Variant.new_string(url);
      })(),
      size: (() => {
        const size = archive.expected_size;
        if (size === undefined) return null;
        return GLib.Variant.new_uint64(size);
      })(),
      path: (() => {
        const path = archive.file.get_path();
        if (path === null) return null;
        return GLib.Variant.new_string(path);
      })(),
    });
    return val;
  }
}
