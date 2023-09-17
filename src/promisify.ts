import Gio from 'gi://Gio';
import Soup from 'gi://Soup';

const orders: {
  object: any,
  methods: string[],
}[] = [
  {
    object: Gio.File.prototype,
    methods: [
      'append_to',
      'copy',
      'create',
      'create_readwrite',
      'delete',
      'enumerate_children',
      'find_enclosing_mount',
      'load_bytes',
      'load_contents',
      'make_directory',
      'make_symbolic_link',
      'move',
      'open_readwrite',
      'query_default_handler',
      'query_filesystem_info',
      'query_info',
      'read',
      'replace',
      'replace_contents',
      'replace_readwrite',
      'set_attributes',
      'set_display_name',
      'trash',
      'replace_contents',
    ],
  },
  {
    object: Gio.FileOutputStream.prototype,
    methods: [
      'query_info',
    ],
  },
  {
    object: Soup.Session.prototype,
    methods: [
      'preconnect',
      'send_and_read',
      'send_and_splice',
      'send',
      'websocket_connect',
    ],
  },
  {
    object: Gio.InputStream.prototype,
    methods: [
      'close',
      'read_all',
      'read',
      'read_bytes',
      'skip',
    ],
  },
  {
    object: Gio.OutputStream.prototype,
    methods: [
      'close',
      'flush',
      'splice',
      'write_all',
      'write',
      'write_bytes',
      'writev_all',
      'writev',
    ],
  },
];

orders.forEach(({ object, methods }) => {
  methods.forEach(method => {
    Gio._promisify(object, `${method}_async`, `${method}_finish`);
  });
});
