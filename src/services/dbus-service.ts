import Gio from 'gi://Gio';

export type DBusService = {
  export2dbus(connection: Gio.DBusConnection, path: string): DBusService;
  save(store: ExportStoreService): DBusService;
}

export interface ExportStoreService {
  store(impl: Gio.DBusExportedObject): void;
}

/**
 * By default, GioDBusSkeleton objects will be GC'ed after export, and this will
 * take down the whole exported service.
 *
 * The recommended pattern is to store these skeletons inside the business models.
 * However, I want to keep all D-Bus code away from these models.
 *
 * The workaround is to keep these skeletons alive here. `impls` store
 * all skeletons and the closure in setInterval keeps it's environment alive, which
 * includes `impls`.
 */
export function ExportStore(): ExportStoreService {
  let impls: Gio.DBusExportedObject[] = [];
  function store(impl: Gio.DBusExportedObject) {
    impls.push(impl);
  }
  setInterval(() => {}, 1000);
  return {
    store,
  }
}
