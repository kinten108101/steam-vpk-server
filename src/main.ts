import 'gi://Gdk?version=4.0';
import 'gi://Gtk?version=4.0';
import 'gi://Soup?version=3.0';
import GLib from 'gi://GLib';

import './promisify.js';
import Server from './server.js';

export function main(argv: string[] | null): number {
  GLib.log_set_debug_enabled(true);
  return Server().run(argv);
}
