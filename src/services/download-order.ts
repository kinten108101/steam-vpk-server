import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Soup from 'gi://Soup';

import { IdentifiableObject } from '../models.js';

export default interface DownloadOrder {
  connect(signal: 'completed', callback: (obj: this) => void): number;
  emit(signal: 'completed'): void;

  // inherit
  connect(signal: 'notify', callback: (obj: this, pspec: GObject.ParamSpec) => void): number;
  emit(signal: 'notify'): void;
}

export default class DownloadOrder extends IdentifiableObject {
  static {
    GObject.registerClass({
      GTypeName: 'StvpkDownloadOrder',
      Signals: {
        'completed': {},
      }
    }, this);
  }

  msg: Soup.Message;
  bytesread: number;
  size?: number;
  input_stream: Gio.InputStream | undefined;
  cancellable: Gio.Cancellable;
  session: Soup.Session;
  gbytes: GLib.Bytes[];

  saved_location: Gio.File;
  output_stream: Gio.FileOutputStream | undefined;

  // this is temporary i swear
  monitor: Gio.FileMonitor | undefined;
  monitor_cancellable: Gio.Cancellable | undefined;

  constructor(
  { uri,
    size,
    saved_location,
    session,
  }:
  { uri: GLib.Uri;
    size?: number;
    saved_location: Gio.File;
    session: Soup.Session;
  }) {
    const key = String(uri.to_string()) + String(saved_location.get_path());
    super({
      id: key,
    });
    this.msg = new Soup.Message({ method: 'GET', uri });
    this.size = size;
    this.bytesread = 0;
    this.cancellable = new Gio.Cancellable();
    this.saved_location = saved_location;
    this.session = session;
    this.gbytes = [];
  }

  stop() {
    this.cancellable.cancel();
  }

  async continue() {
    this.cancellable = new Gio.Cancellable();
    return await this.run();
  }

  async request_download() {
    console.time('send-async');
    this.input_stream = await this.session.send_async(this.msg, GLib.PRIORITY_DEFAULT, this.cancellable);
    console.timeEnd('send-async');
    this.output_stream = await this.saved_location.replace_async(null, false, Gio.FileCreateFlags.NONE, GLib.PRIORITY_DEFAULT, this.cancellable);
    this.monitor_cancellable = new Gio.Cancellable;
    this.monitor = this.saved_location.monitor_file(Gio.FileMonitorFlags.NONE, this.monitor_cancellable);
    this.monitor.connect('changed', () => {
      (async () => {
        let info;
        try {
          info = await this.saved_location.query_info_async(Gio.FILE_ATTRIBUTE_STANDARD_SIZE, Gio.FileQueryInfoFlags.NONE, GLib.PRIORITY_DEFAULT, this.cancellable);
        } catch (error) {
          if (error instanceof GLib.Error) {
            if (error.matches(Gio.io_error_quark(), Gio.IOErrorEnum.CANCELLED)) { return; }
          } else throw error;
        }
        if (info) this.bytesread = info.get_size();
      })().catch(error => logError(error));
    });
  }

  async run() {
    if (this.input_stream === undefined) {
      console.warn('Have not established downstream connection. Download aborted.');
      return;
    }
    if (this.output_stream === undefined) {
      console.warn('Have not established disk outputstream. Download aborted.');
      return;
    }
    this.monitor_cancellable?.cancel();
    try {
      console.time('download');
      // FIXME(kinten):
      // This commented-out code section will lead to error for >300MB orders, sometimes less.
      // Error has to do with GC or something. A JS callback ran duing GC sweep, but which??
      // As a workaround, we can use splice but we don't control the retrieval of each chunk.
      // We monitor progress externally using a file monitor.
      // It's fucking bad.
      /*
      let size = 1;
      while (size !== 0) {
        const gbytes = await this.input_stream.read_bytes_async(4096, GLib.PRIORITY_DEFAULT, this.cancellable);
        size = await this.output_stream.write_bytes_async(gbytes, GLib.PRIORITY_DEFAULT, this.cancellable);
        this.bytesread += size;
      }
      */
      await this.output_stream.splice_async(this.input_stream, Gio.OutputStreamSpliceFlags.NONE, GLib.PRIORITY_DEFAULT, this.cancellable);
      console.timeEnd('download');

      await this.input_stream.close_async(GLib.PRIORITY_DEFAULT, this.cancellable);
      await this.output_stream.flush_async(GLib.PRIORITY_DEFAULT, null);
      await this.output_stream.close_async(GLib.PRIORITY_DEFAULT, this.cancellable);
    } catch (error) {
      logError(error);
      return;
    }
    console.debug('Download completed!');
    this.emit('completed');
  }

  async start() {
    await this.request_download();
    return this.run();
  }

  get_percentage() {
    if (!this.size) return -1;
    return this.bytesread / this.size;
  }

  is_running() {
    return !this.cancellable.is_cancelled();
  }
}
