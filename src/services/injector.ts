import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';

import Injector, { InjectionStore } from '../injector.js';
import { SERVER_ID } from '../const.js';
import { promise_wrap } from '../steam-vpk-utils/utils.js';

export default function InjectorService(
{ injector,
  injection_store,
}:
{ injector: Injector;
  injection_store: InjectionStore;
}) {
  const service = Gio.DBusExportedObject.wrapJSObject(InjectorInterface, {
    Run() {
      promise_wrap(async () => {
        const inj = injector.make_injection();
        injection_store.set(inj.id, inj);
        injector.run(inj);
      })
    },
    RunWithGame() {
      promise_wrap(async () => {
        const inj = injector.make_injection();
        const game_hook = injector.connect(Injector.Signals.session_end, (_obj, id) => {
          if (id !== inj.id) {
            return;
          }
          injector.disconnect(game_hook);
          inj.log('Starting Left 4 Dead 2...');
          // TODO(kinten): Injection cleanup method
          Gtk.show_uri(null, 'steam://rungameid/550', Gdk.CURRENT_TIME);
        });
      });
    },
    Cancel(id: string) {
      const inj = injection_store.get(id);
      if (inj === undefined) {
        console.warn('Could not find injection attempt. Quitting...');
        return;
      }
      inj.cancellable.cancel();
    },
    Done(id: string) {
      const inj = injection_store.get(id);
      if (inj === undefined) {
        console.warn('Could not find injection attempt. Quitting...');
        return;
      }
      injector.finish(inj);
      injection_store.delete(id);
    },
    Has(id: string) {
      const result = injection_store.get(id) !== undefined;
      console.log(result);
      return result;
    }
  });
  injector.connect(Injector.Signals.running_prepare, (_obj, id: string) => {
    console.log('server emits prepare');
    service.emit_signal('RunningPrepare', GLib.Variant.new_tuple([GLib.Variant.new_string(id)]));
  });
  injector.connect(Injector.Signals.session_start, (_obj, id: string) => {
    service.emit_signal('SessionStart', GLib.Variant.new_tuple([GLib.Variant.new_string(id)]));
  });
  injector.connect(Injector.Signals.session_finished, (_obj) => {
    service.emit_signal('SessionFinished', GLib.Variant.new_tuple([]));
  });
  injector.connect(Injector.Signals.session_end, (_obj, id: string) => {
    service.emit_signal('SessionEnd', GLib.Variant.new_tuple([GLib.Variant.new_string(id)]));
  });
  injector.connect(Injector.Signals.running_cleanup, (_obj, id: string) => {
    service.emit_signal('RunningCleanup', GLib.Variant.new_tuple([GLib.Variant.new_string(id)]));
  });
  injection_store.connect(InjectionStore.Signals.logs_changed, (_obj, id: string, msg: string) => {
    service.emit_signal('LogsChanged', GLib.Variant.new_tuple([GLib.Variant.new_string(id), GLib.Variant.new_string(msg)]));
  });
  injection_store.connect(InjectionStore.Signals.cancelled, (_obj, id: string) => {
    service.emit_signal('Cancelled', GLib.Variant.new_tuple([GLib.Variant.new_string(id)]));
  });

  function export2dbus(connection: Gio.DBusConnection, path: string) {
    service.export(connection, path);
  }
  return {
    export2dbus,
    service,
  };
}

export const InjectorInterface = `
<node>
  <interface name="${SERVER_ID}.Injector">
    <signal name="RunningPrepare">
      <arg name="injection-id" type="s"/>
    </signal>
    <signal name="SessionStart">
      <arg name="injection-id" type="s"/>
    </signal>
    <signal name="SessionFinished">
    </signal>
    <signal name="SessionEnd">
      <arg name="injection-id" type="s"/>
    </signal>
    <signal name="RunningCleanup">
      <arg name="injection-id" type="s"/>
    </signal>
    <signal name="LogsChanged">
      <arg name="injection-id" type="s"/>
      <arg name="message" type="s"/>
    </signal>
    <signal name="Cancelled">
      <arg name="injection-id" type="s"/>
    </signal>
    <method name="Run"/>
    <method name="RunWithGame"/>
    <method name="Cancel">
      <arg name="injection-id" type="s"/>
    </method>
    <method name="Done">
      <arg name="injection-id" type="s"/>
    </method>
    <method name="Has">
      <arg name="injection-id" type="s"/>
    </method>
  </interface>
</node>`;
