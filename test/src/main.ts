import 'gi://Gdk?version=4.0';
import 'gi://Gtk?version=4.0';
import 'gi://Soup?version=3.0';
import GLib from 'gi://GLib';

import '../../src/promisify.js';
import { parse_argv, run, summarize } from './utils.js';
import { DiskCapacityTest } from './units/disk-capacity.js';
import { DiskCapacityIntervalTest } from './units/disk-capacity-interval.js';

export function main(argv: string[]) {
  parse_argv(argv);
  GLib.log_set_debug_enabled(true);
  const loop = new GLib.MainLoop(null, false);
  (async () => {
    Promise.all([
      run("disk-capacity", DiskCapacityTest),
      run("disk-capacity-interval", DiskCapacityIntervalTest),
    ]).finally(() => {
      summarize();
      loop.quit();
    });
  })().catch(logError);
  loop.run();
  return 0;
}
