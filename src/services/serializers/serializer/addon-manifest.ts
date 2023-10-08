import DiskCapacity from '../../disk-capacity.js';
import { Serializer } from '../../serializers.js';
import { Addon } from '../../../models/addons.js';
import { AddonManifest } from '../../schema/addon-manifest.js';
import ArchiveStore from '../../../models/archive-store.js';
import { ArchiveManifest, LocalArchiveManifest, RemoteArchiveManifest } from '../../schema/archive-manifest.js';
import { Archive, LocalArchive, RemoteArchive } from '../../../models/archives.js';

export default class AddonManifestSerializer implements Serializer<Addon,
AddonManifest> { disk_capacity: DiskCapacity; archive_store: ArchiveStore;

  constructor(params: {
    disk_capacity: DiskCapacity;
    archive_store: ArchiveStore;
  }) {
    this.disk_capacity = params.disk_capacity;
    this.archive_store = params.archive_store;
  }

  serialize(item: Addon) {
    const manifest: AddonManifest = {
      stvpkid: item.id,
      publishedfileid: item.steam_id || undefined,
      time_updated: (() => {
            const date = item.time_updated;
            if (date === null) return undefined;
            return Math.floor(date.getTime() / 1000);
          })(),
      title: item.title || undefined,
      description: item.description || undefined,
      tags: (() => {
            if (item.categories === null) return undefined;
            const tags: { tag: string }[] = [];
            item.categories.forEach(val => tags.push({ tag: val }));
            return tags;
          })(),
      creators: (() => {
            if (item.creators === null) return undefined;
            const arr: { creator?: string }[] = [];
            item.creators.forEach(val => arr.push({ creator: val }));
            return arr;
          })(),
      archives: (() => {
            if (!item.archives) return undefined;
            const arr: ArchiveManifest[] = [];
            item.archives.forEach(x => {
              const archive = this.archive_store.get(x);
              if (archive === undefined) return;
              const manifest = this._serialize_archive_each(archive);
              if (manifest === undefined) return;
              arr.push(manifest);
            });
            return arr;
          })(),
    };
    return manifest;
  }

  _serialize_archive_each(archive: Archive): ArchiveManifest | undefined {
    if (archive instanceof LocalArchive) {
      return this._serialize_local_archive(archive);
    } else if (archive instanceof RemoteArchive) {
      return this._serialize_remote_archive(archive);
    } else throw Error;
  }

  _serialize_local_archive(archive: LocalArchive): LocalArchiveManifest {
    const val: LocalArchiveManifest = {
      type: 'local',
      path: (() => {
        const path = archive.file.get_path();
        if (path === null) return undefined;
        return path;
      })(),
    };
    return val;
  }

  _serialize_remote_archive(archive: RemoteArchive): RemoteArchiveManifest {
    const val: RemoteArchiveManifest = {
      type: 'steam',
      url: (() => {
        const url = archive.url.get_path();
        if (url === null) return undefined;
        return url;
      })(),
      size: (() => {
        const size = archive.expected_size;
        if (size === undefined) return undefined;
        return size;
      })(),
      path: (() => {
        const path = archive.file.get_path();
        if (path === null) return undefined;
        return path;
      })(),
    };
    return val;
  }
}
