import Gio from 'gi://Gio';
import Soup from 'gi://Soup';

Gio._promisify(
  Gio.File.prototype,
  'query_info_async',
  'query_info_finish',
);

Gio._promisify(
  Gio.FileOutputStream.prototype,
  'query_info_async',
  'query_info_finish',
);
Gio._promisify(
  Gio.File.prototype,
  'trash_async',
  'trash_finish',
);

Gio._promisify(
  Soup.Session.prototype,
  'send_async',
  'send_finish',
);

Gio._promisify(
  Gio.File.prototype,
  'replace_async',
  'replace_finish',
);

Gio._promisify(
  Gio.InputStream.prototype,
  'read_all_async',
  'read_all_finish',
);

Gio._promisify(
  Gio.OutputStream.prototype,
  'write_async',
  'write_finish',
);

Gio._promisify(
  Gio.OutputStream.prototype,
  'write_bytes_async',
  'write_bytes_finish',
);

Gio._promisify(
  Soup.Session.prototype,
  'send_and_splice_async',
  'send_and_splice_finish',
);

Gio._promisify(
  Gio.OutputStream.prototype,
  'flush_async',
  'flush_finish',
);

Gio._promisify(
  Gio.InputStream.prototype,
  'close_async',
  'close_finish',
);

Gio._promisify(
  Gio.OutputStream.prototype,
  'close_async',
  'close_finish',
);

Gio._promisify(
  Gio.InputStream.prototype,
  'read_bytes_async',
  'read_bytes_finish',
);

Gio._promisify(
  Gio.InputStream.prototype,
  'read_all_async',
  'read_all_finish',
);

Gio._promisify(
  Gio.OutputStream.prototype,
  'splice_async',
  'splice_finish',
);

Gio._promisify(
  Gio.File.prototype,
  'move_async',
  'move_finish',
);

Gio._promisify(
  Gio.File.prototype,
  'query_filesystem_info_async',
  'query_filesystem_info_finish'
);
