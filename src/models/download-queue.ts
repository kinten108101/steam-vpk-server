import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Soup from 'gi://Soup';

import DownloadOrder from '../services/download-order.js';
import { make_dir_nonstrict } from '../services/files.js';
import { registerClass } from '../steam-vpk-utils/utils.js';
import { ADDON_ARCHIVE } from '../const.js';
import { SignalStore } from '../models.js';

export default class DownloadQueue extends SignalStore<DownloadOrder> {
  static {
    registerClass({}, this);
  }

  session: Soup.Session;
  download_dir: Gio.File;

  constructor(
  { session,
    download_dir,
  }:
  { session: Soup.Session;
    download_dir: Gio.File;
  }) {
    super({
      item_type: DownloadOrder.$gtype,
    });
    this.session = session;
    this.download_dir = download_dir;
  }

  register_order(params: {
    uri: GLib.Uri,
    size?: number,
    name: string,
  }) {
    const order = new DownloadOrder({
      uri: params.uri,
      size: params.size,
      saved_location: (() => {
        const subdir = this.download_dir.get_child(params.name);
        // NOTE(kinten): can't make placeholder path so we'll throw on the error
        make_dir_nonstrict(subdir);
        const archive = subdir.get_child(ADDON_ARCHIVE);
        return archive;
      })(),
      session: this.session,
    });
    this.append(order);
    return order;
  }
}
