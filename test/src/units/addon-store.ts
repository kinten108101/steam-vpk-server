import Gio from 'gi://Gio';
import AddonStore from '../../../src/models/addon-store.js';
import AddonDirectoryBinder from "../../../src/binders/addon-directory.js";
import ArchiveStore from '../../../src/models/archive-store.js';
import IndexDirectory from '../../../src/services/directory/index-dir.js';
import ManifestReader from '../../../src/services/manifest-reader.js';
import { SerializerStore } from '../../../src/models/serializer-store.js';

export default function AddonStoreTest(): number {
  const store = new AddonStore();
  const archive_store = new ArchiveStore();
  const index_file = Gio.File.new_for_path('../../sandbox/.config/addons.json');
  const location = Gio.File.new_for_path('../../sandbox/share/addons');
  const directory = new IndexDirectory({
    index_file,
    location,
  });
  const manifest_reader = new ManifestReader();
  const serializer_store = new SerializerStore();
  AddonDirectoryBinder({
    store,
    archive_store,
    directory,
    manifest_reader,
    serializer_store,
    manifest2addon: 'deserializer/addon',
    manifest2archives: 'deserializer/archive',
  });
  return 0;
}
