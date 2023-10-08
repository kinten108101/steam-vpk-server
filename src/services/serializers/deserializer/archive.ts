import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { Archive, LocalArchive, RemoteArchive } from "../../../models/archives.js";
import { Deserializer } from "../../serializers.js";
import { AddonManifest } from "../../schema/addon-manifest.js";
import { ArchiveManifest, ArchiveType, LocalArchiveManifest, RemoteArchiveManifest } from "../../schema/archive-manifest.js";
import Archiver from '../../archiver.js';

export default class ArchiveDeserializer implements Deserializer<AddonManifest, Archive[]> {
  _archiver: Archiver;

  constructor(params: {
    archiver: Archiver;
  }) {
    this._archiver = params.archiver;
  }

  deserialize(manifest: AddonManifest): Archive[] {
    if (manifest.archives === undefined) return [];
    const arr: Archive[] = [];
    manifest.archives.forEach(x => {
      const item = this._deserialize_each(x);
      if (item === undefined) return;
      arr.push(item);
    });
    return arr;
  }

  _parse_for_deserialize_each_variant_fn(type: ArchiveManifest["type"]) {
    switch (type) {
    case 'local':
      return this._deserialize_local_archive.bind(this);
    case 'steam':
      return this._deserialize_remote_archive.bind(this);
    default:
      throw new Error;
    }
  }

  _deserialize_local_archive(manifest: LocalArchiveManifest): LocalArchive | undefined {
    const path = manifest.path;
    if (path === undefined) {
      console.warn(`Required field \"path\" is missing for archive`);
      return undefined;
    }
    const file = Gio.File.new_for_path(path);

    return new LocalArchive({
      file,
    });
  }

  _deserialize_remote_archive(manifest: RemoteArchiveManifest): RemoteArchive | undefined {
    const path = manifest.path;
    if (path === undefined) {
      console.warn(`Required field \"path\" is missing for archive`);
      return undefined;
    }
    const file = Gio.File.new_for_path(path);

    const url = (() => {
      let val;
      try {
        val = GLib.Uri.parse(manifest.url || null, GLib.UriFlags.NONE);
      } catch (error) {
        val = undefined;
      }
      return val;
    })();
    if (url === undefined) return undefined;

    const expected_size = manifest.size;

    return new RemoteArchive({
      url,
      expected_size,
      file,
      fetch_from_remote: this._archiver.install_remote_archive.bind(this._archiver),
    });
  }

  _deserialize_each(manifest: ArchiveManifest): Archive | undefined {
    if (manifest.type === undefined) {
      console.warn(`Required field \"type\" is missing`);
      return undefined;
    }
    const type = ArchiveType.parse(manifest.type);
    if (type === undefined) {
      console.warn(`Unrecognized archive type \"${manifest.type}\"`);
      return undefined;
    }

    const archive = this._parse_for_deserialize_each_variant_fn(type)(manifest as any);
    return archive;
  }
}
