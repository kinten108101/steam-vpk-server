import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

import { Addon } from '../models/addons.js';
import SteamworkServices from './steam-api.js';
import DownloadQueue from '../models/download-queue.js';
import ArchiveStore from '../models/archive-store.js';
import { Archive, RemoteArchive } from '../models/archives.js';
import { Deserializer } from './serializers.js';
import { PublishedFileDetails } from './schema/steam-api.js';
import { ArchiverErrorEnum, archiver_error_quark } from './errors/archiver.js';

export default class Archiver {
  download_queue: DownloadQueue;
  steamapi: SteamworkServices;
  archive_store: ArchiveStore;
  get_gpfd2archives: () => Deserializer<PublishedFileDetails, Archive[]>;

  constructor( params: {
    download_queue: DownloadQueue;
    steamapi: SteamworkServices;
    archive_store: ArchiveStore;
    get_gpfd2archives: () => Deserializer<PublishedFileDetails, Archive[]>;
  }) {
    this.download_queue = params.download_queue;
    this.steamapi = params.steamapi;
    this.archive_store = params.archive_store;
    this.get_gpfd2archives = params.get_gpfd2archives;
  }

  async register_missing_archive_async(addon: Addon): Promise<boolean> {
    if (!addon.remote) return false;
    if (addon.steam_id === null) return false;
    let response;
    try {
      response = await this.steamapi.getPublishedFileDetails(addon.steam_id);
    } catch (error) {
      logError(error);
      return false;
    }

    const archives = this.get_gpfd2archives().deserialize(response, { id: addon.id });
    if (archives === undefined) return false;

    if (addon.archives)
      addon.archives = [...addon.archives, ...(archives.map(x => x.id))];
    else
      addon.archives = archives.map(x => x.id);

    this.archive_store.splice(this.archive_store.get_n_items(), 0, archives);

    return true;
  }

  is_addon_viable_install_missing_archives(addon: Addon): [false, GLib.Error] | [true, undefined] {
    const { archives } = addon;
    if (archives === null) {
      return [false, new GLib.Error(
        archiver_error_quark(),
        ArchiverErrorEnum.ARCHIVE_NOT_AVAILABLE,
        `Archival is not supported for addon \"${addon.id}\". Quitting...`)];
    }
    const count = archives.length;
    if (count === 0) {
      console.warn(`No archive to install for addon \"${addon.id}\". Quitting...`);
      return [false, new GLib.Error(
        archiver_error_quark(),
        ArchiverErrorEnum.NO_ARCHIVE,
        `No archive to install for addon \"${addon.id}\". Quitting...`)];
    }
    return [true, undefined];
  }

  async install_missing_archives_for_addon_async(addon: Addon) {
    const [result] = this.is_addon_viable_install_missing_archives(addon);
    if (!result) return;
    const { archives } = addon;
    if (archives === null) throw new Error;
    const count = archives.length;
    if (count === 0) throw new Error;
    archives.forEach(x => {
      const archive = this.archive_store.get(x);
      if (!(archive instanceof RemoteArchive)) return;
      this.install_remote_archive(archive);
    });
  }

  install_remote_archive(archive: RemoteArchive) {
    const { url: uri, expected_size: size, file: dest } = archive;
    const order = this.download_queue.register_order({
      uri,
      size,
      name: dest.get_basename() || '',
    });
    const announcer = setInterval(() => {
      console.debug('Progress:', order.get_percentage());
    }, 1000);
    order.connect('completed', () => {
      (async () => {
        announcer.destroy();
        console.debug('Download completed');
        await order.saved_location.move_async(dest, Gio.FileCopyFlags.NONE, GLib.PRIORITY_DEFAULT, null, null);
      })().catch(logError);
    });
    order.start();
    console.debug('Download started');
  }
}

