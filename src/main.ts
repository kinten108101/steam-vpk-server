import 'gi://Gdk?version=4.0';
import 'gi://Gtk?version=4.0';
import 'gi://Soup?version=3.0';

import Server from './server.js';

export function main(argv: string[] | null): number {
  return Server().run(argv);
}
