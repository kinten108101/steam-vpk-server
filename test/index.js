import GLib from 'gi://GLib';

imports.package.init({
  name: 'test',
  prefix: '/usr',
  libdir: '/usr/lib',
});

const getMain = new GLib.MainLoop(null, false);
import(`${import.meta.url}/../tsc_out/test/src/main.js`)
  .then(mod => {
    GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
      getMain.quit();
      imports.package.run(mod);
      return GLib.SOURCE_REMOVE;
    });
  }).catch(logError);
getMain.run();
