import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { RemoteArchive } from "../../../models/archives.js";
import { Archive } from "../../../models/archives.js";
import { PublishedFileDetails } from "../../schema/steam-api.js";
import { Deserializer } from "../../serializers.js";
import Archiver from '../../archiver.js';

export default class GPFD2Archives implements Deserializer<PublishedFileDetails, Archive[]> {
  _archiver: Archiver;

  constructor(params: {
    archiver: Archiver;
  }) {
    this._archiver = params.archiver;
  }

  deserialize(manifest: PublishedFileDetails, overrides: { addon_subdir: Gio.File }): Archive[] {
    const { file_name, file_size, file_url } = manifest;
    const { addon_subdir } = overrides;

    if (!file_name) return [];
    const file = addon_subdir.get_child(file_name);

    let url: GLib.Uri;
    try {
      url = GLib.Uri.parse(file_url || null, GLib.UriFlags.NONE);
    } catch (error) {
      logError(error);
      return [];
    }

    const archive = new RemoteArchive({
      file,
      url,
      expected_size: file_size,
      fetch_from_remote: this._archiver.install_remote_archive.bind(this._archiver),
    });

    return [archive];
  }
}
