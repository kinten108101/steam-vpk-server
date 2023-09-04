import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Soup from 'gi://Soup';

import DownloadOrder from '../services/download-order.js';
import { make_dir_nonstrict } from '../file.js';
import { registerClass } from '../steam-vpk-utils/utils.js';
import { ADDON_ARCHIVE } from '../const.js';

export default class DownloadQueue extends Gio.ListStore {
  static {
    registerClass({}, this);
  }

  session: Soup.Session;
  download_dir: Gio.File;

  constructor(param: { session?: Soup.Session; download_dir: Gio.File }) {
    super({
      item_type: DownloadOrder.$gtype,
    });
    this.session = param.session || new Soup.Session();
    this.download_dir = param.download_dir;
  }

  async start() {
    try {
      make_dir_nonstrict(this.download_dir);
    } catch(error) {
      logError(error as Error, 'Quitting...');
      return;
    }
  }

  register_order(params: { uri: GLib.Uri, size?: number, name: string }) {
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
