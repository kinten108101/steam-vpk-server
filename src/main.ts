import GLib from 'gi://GLib';
import 'gi://Gdk?version=4.0';
import 'gi://Gtk?version=4.0';
import 'gi://Soup?version=3.0';

import Server from './server.js';

export function main(argv: string[] | null): number {
  const server = new Server();
  server.bind();
  server.start(argv);
  const loop = new GLib.MainLoop(null, false);
  loop.run();
  return 0;
}
