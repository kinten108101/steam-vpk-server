import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';

import { ExportStoreService } from './dbus-service.js';
import InjectionStore, { Injection } from '../models/injection-store.js';
import Injector from '../services/injector.js';
import { SERVER_ID, SERVER_PATH } from '../const.js';
import { get_formatted_unique_name_str } from '../steam-vpk-utils/portals.js';

export default function InjectorService(
{ connection,
  injector,
  injection_store,
}:
{ connection: Gio.DBusConnection;
  injector: Injector;
  injection_store: InjectionStore;
}) {
  const service = Gio.DBusExportedObject.wrapJSObject(
`<node>
  <interface name="${SERVER_ID}.Injector">
    <signal name="RunningPrepare">
      <arg name="injection-id" type="s"/>
    </signal>
    <property name="RunningPrepared" type="b" access="readwrite" />
    <signal name="SessionStart">
      <arg name="injection-id" type="s"/>
    </signal>
    <signal name="SessionFinished">
      <arg name="injection-id" type="s"/>
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
    <method name="EnableRunWithGame">
      <arg name="injection-id" type="s"/>
      <arg name="state" type="b"/>
    </method>
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
</node>`,
    {
    Run() {
      (async () => {
        const inj = injector.make_injection();
        injection_store.splice(injection_store.get_n_items(), 0, [inj]);
        injector.run(inj);
      })().catch(error => logError(error));
    },
    EnableRunWithGame(id: string, val: boolean) {
      const injection = injection_store.get(id);
      if (injection === undefined) return;
      if (val) {
        const game_hook = injector.connect('session-end', (_obj, id) => {
          injector.disconnect(game_hook);
          if (id !== injection.id) {
            return;
          }
          injection.log('Starting Left 4 Dead 2...');
          Gtk.show_uri(null, 'steam://rungameid/550', Gdk.CURRENT_TIME);
        });
        const prev_hook = injection.hooks.get('game-hook');
        if (prev_hook !== undefined) {
          console.warn('Game Hook has already been made');
          return;
        }
        injection.hooks.set('game-hook', game_hook);
      } else {
        const game_hook = injection.hooks.get('game-hook');
        if (game_hook === undefined) return;
        injection.disconnect(game_hook);
        injection.hooks.delete('game-hook');
      }
    },
    RunWithGame() {
      (async () => {
        const inj = injector.make_injection();
        const game_hook = injector.connect('session-end', (_obj, id) => {
          injector.disconnect(game_hook);
          if (id !== inj.id) {
            return;
          }
          inj.log('Starting Left 4 Dead 2...');
          Gtk.show_uri(null, 'steam://rungameid/550', Gdk.CURRENT_TIME);
        });
        injection_store.splice(injection_store.get_n_items(), 0, [inj]);
        injector.run(inj);
      })().catch(error => logError(error));
    },
    Cancel(id: string) {
      const inj = injection_store.get(id);
      if (inj === undefined) {
        console.warn('Could not find injection attempt. Quitting...');
        return;
      }
      inj.stop();
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
      return result;
    },
    set RunningPrepared(val: boolean) {
      injector.running_prepared = val;
    },
    get RunningPrepared() {
      return injector.running_prepared;
    },
  });
  injector.connect('running-prepare', (_obj, id: string) => {
    service.emit_signal('RunningPrepare', GLib.Variant.new_tuple([GLib.Variant.new_string(id)]));
  });
  injector.connect('session-start', (_obj, id: string) => {
    service.emit_signal('SessionStart', GLib.Variant.new_tuple([GLib.Variant.new_string(id)]));
  });
  injector.connect('session-finished', (_obj, id: string) => {
    service.emit_signal('SessionFinished', GLib.Variant.new_tuple([GLib.Variant.new_string(id)]));
  });
  injector.connect('session-end', (_obj, id: string) => {
    service.emit_signal('SessionEnd', GLib.Variant.new_tuple([GLib.Variant.new_string(id)]));
  });
  injector.connect('running-cleanup', (_obj, id: string) => {
    service.emit_signal('RunningCleanup', GLib.Variant.new_tuple([GLib.Variant.new_string(id)]));
  });
  service.export(connection, `${SERVER_PATH}/injector`);

  const handler_map: WeakMap<Injection, {
    service: Gio.DBusExportedObject | undefined;
    injection_signals: number[];
    injection_log_signals: number[];
  }> = new WeakMap;
  injection_store.connect('bind', (_obj, injection) => {
    const injection_signals: number[] = [];
    const injection_log_signals: number[] = [];
    const service = Gio.DBusExportedObject.wrapJSObject(
`<node>
  <interface name="${SERVER_ID}.Injection">
    <property name="Elapsed" type="t" access="read" />
    <signal name="LogsChanged">
      <arg name="message" type="s"/>
    </signal>
    <signal name="Cancelled" />
    <method name="GetLatestLine">
      <arg name="line" type="s" direction="out" />
    </method>
  </interface>
</node>`, {
      get Elapsed() {
        return injection.elapsed;
      },
      GetLatestLine() {
        return injection.logs.get_string(injection.logs.get_n_items() - 1) || '';
      }
    });

    const using_logs_changed = injection.logs.connect('items-changed', (_obj, pos: number, removed: number, added: number) => {
      if (removed > 0) {
        console.error('InjectorService:', 'Line removal is not supported');
        return;
      }
      for (let i = 0; i < added; i++) {
        const idx = pos + i;
        const val = injection.logs.get_string(idx) || '';
        service.emit_signal('LogsChanged',
          GLib.Variant.new_tuple([
            GLib.Variant.new_string(val)
          ])
        );
      }
    });
    injection_log_signals.push(using_logs_changed);

    const using_cancelled = injection.connect('cancelled', () => {
      service.emit_signal('Cancelled', GLib.Variant.new_tuple([]));
    });
    injection_signals.push(using_cancelled);

    const using_elapsed = injection.connect('notify::elapsed', () => {
      service.emit_property_changed('Elapsed', GLib.Variant.new_uint64(injection.elapsed));
    });
    injection_signals.push(using_elapsed);

    service.export(connection, `${SERVER_PATH}/injections/${get_formatted_unique_name_str(injection.id)}`);

    handler_map.set(injection, {
      service,
      injection_signals,
      injection_log_signals,
    });
  });
  injection_store.connect('unbind', (_obj, injection) => {
    const handlers = handler_map.get(injection);
    if (handlers === undefined) {
      console.warn('InjectorService:', `Handlers not found for injection \"${injection.id}\"`);
      return;
    }
    const { injection_signals, injection_log_signals, service } = handlers;
    service?.unexport();
    injection_signals.forEach(x => {
      injection.disconnect(x);
    });
    injection_log_signals.forEach(x => {
      injection.logs.disconnect(x);
    });
  });

  function save(storage: ExportStoreService) {
    storage.store(service);
    return methods;
  }
  const methods = {
    save,
  }
  return methods;
}
