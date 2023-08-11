import Gio from 'gi://Gio';

export type DBusService = {
  export2dbus: (connection: Gio.DBusConnection, path: string) => void;
}
