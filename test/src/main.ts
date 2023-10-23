import 'gi://Gdk?version=4.0';
import 'gi://Gtk?version=4.0';
import 'gi://Soup?version=3.0';
import GLib from 'gi://GLib';

import '../../src/promisify.js';
import { run } from './utils.js';
import { DiskCapacityTest } from './units/disk-capacity.js';
import { DiskCapacityIntervalTest } from './units/disk-capacity-interval.js';

export function main(argv: string[]) {
  GLib.log_set_debug_enabled(true);
  const loop = new GLib.MainLoop(null, false);
  (async () => {
    await run("Disk Capacity", DiskCapacityTest);
    await run("Disk Capacity Interval", DiskCapacityIntervalTest);
    loop.quit();
  })().catch(logError);
  loop.run();
  argv;
  return 0;
}
