import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import DiskCapacity from "../services/disk-capacity.js";

export default function DiskCapacityBinder(
{ disk_capacity,
  addon_store,
  addons_dir,
}:
{ disk_capacity: DiskCapacity,
  addon_store: {
    connect(signal: 'items-changed', callback: (obj: typeof addon_store, ...args: any[]) => void): number;
  };
  addons_dir: Gio.File;
}) {
  addon_store.connect('items-changed', disk_capacity.eval_addon_dir.bind(disk_capacity));
  disk_capacity.eval_addon_dir();

  const info = addons_dir.query_filesystem_info('*', null);
  disk_capacity._set_fs_free(info.get_attribute_uint64(Gio.FILE_ATTRIBUTE_FILESYSTEM_FREE));
  disk_capacity._set_fs_size(info.get_attribute_uint64(Gio.FILE_ATTRIBUTE_FILESYSTEM_SIZE));
  setInterval(() => {
    addons_dir.query_filesystem_info_async('*', GLib.PRIORITY_DEFAULT, null)
      .then(info => {
        const free = info.get_attribute_uint64(Gio.FILE_ATTRIBUTE_FILESYSTEM_FREE);
        if (free !== disk_capacity.fs_free) disk_capacity._set_fs_free(free);

        const size = info.get_attribute_uint64(Gio.FILE_ATTRIBUTE_FILESYSTEM_SIZE);
        if (size !== disk_capacity.fs_size) disk_capacity._set_fs_size(size);
      })
      .catch(error => logError(error));
  }, 5000);
}
