import GLib from 'gi://GLib';

imports.package.init({
  name: 'com.github.kinten108101.SteamVPK.Server',
  version: '0.1',
  prefix: '/usr',
  libdir: '/usr/lib',
});

const getMain = new GLib.MainLoop(null, false);
// @ts-ignore
import('file:///home/kinten/Projects/steam-vpk-server/test/tsc_out/test/src/main.js')
  .then(mod => {
    GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
      getMain.quit();
      imports.package.run(mod);
      return GLib.SOURCE_REMOVE;
    });
  }).catch(logError);
getMain.run();
