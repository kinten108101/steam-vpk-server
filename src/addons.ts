import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';

import { ArchiveGroup, ArchiveManifest } from './archiver.js';
import { ADDON_INFO } from './const.js';
import { registerClass, vardict_make } from './steam-vpk-utils/utils.js';
import { GVariantFormat } from './gvariant.js';

export interface StorageExport {
  addondetails: {
    stvpkid?: string,
    publishedfileid?: string,
    time_updated?: Number,
    title?: string,
    description?: string,
    tags?: { tag: string }[],
  }
}

export interface AddonManifest {
  stvpkid?: string,
  publishedfileid?: string,
  time_updated?: number,
  title?: string,
  description?: string,
  tags?: { tag: string }[],
  comment?: string,
  creators?: { creator?: string }[],
  archives?: ArchiveManifest[],
}

export const AddonManifest = {
  new_from_published_file_details(response: any, stvpkid: string) {
    const manifest: AddonManifest = {
      stvpkid,
      publishedfileid: String(response.publishedfileid),
      time_updated: Number(response.time_updated),
      title: response.title,
      description: String(response.description),
      tags: (() => {
            const arr = response.tags;
            if (arr === undefined) {
              console.warn('GetPublishedFileDetails is missing the tags field.');
              return arr;
            }
            if (!Array.isArray(arr)) {
              console.warn('GetPublishedFileDetails has incorrect tags field.');
              return undefined;
            }
            const newArr: { tag: string }[] = [];
            arr.forEach(x => {
              const tag = x.tag;
              if (typeof tag !== 'string') {
                console.warn('GetPublishedFileDetails has incorrect tag field.');
                return undefined;
              }
              newArr.push(x);
            });
            return newArr;
          })(),
      creators: (() => {
            return [{ creator: String(response.creator) }];
          })(),
    };
    return manifest;
  },
}

/**
 * @bitfield
 */
export enum AddonFlags {
  NONE     = 1<<0,
  DUMMY    = 1<<1,
}

export namespace AddonFlags {
  export const count = Object.keys(AddonFlags).length;
  export const max = Math.pow(2, count) - 1;
  export function includes(ref: number, val: number) {
    if ((ref & val) > 0) {
      return true;
    }
    return false;
  }
  export const valid = (val: number) => includes(max, val);
}


export class Addon extends GObject.Object implements GVariantFormat {
  static [GObject.signals] = {
    'modified': {},
  };

  static {
    registerClass({}, this);
  };

  static getGVariantType() {
    return GLib.VariantType.new_array(
      GLib.VariantType.new_dict_entry(
        GLib.VariantType.new('s'),
        GLib.VariantType.new('v')
      )
    );
  }

  id: string;
  /** @deprecated */
  vanityId: string;
  steamId?: string;
  title?: string;
  description?: string;
  categories?: Map<string, {}>;
  timeUpdated?: Date;
  comment?: string;
  creators?: Map<string, {}>;
  flags: AddonFlags;
  subdir: Gio.File;
  info: Gio.File;
  archive_group?: ArchiveGroup;

  constructor(param: {
    id?: string;
    /** @deprecated */
    vanityId: string;
    steamId?: string;
    title?: string;
    description?: string;
    categories?: Map<string, {}>;
    timeUpdated?: Date;
    comment?: string;
    creators?: Map<string, {}>;
    flags: AddonFlags;
    subdir: Gio.File;
    archive_group?: ArchiveGroup;
  }) {
    super({});
    this.id = param.vanityId;
    this.vanityId = param.vanityId;
    this.steamId = param.steamId;
    this.title = param.title;
    this.description = param.description;
    this.categories = param.categories;
    this.timeUpdated = param.timeUpdated;
    this.comment = param.comment;
    this.creators = param.creators;
    this.flags = param.flags;
    this.subdir = param.subdir;
    this.info = this.subdir.get_child(ADDON_INFO);
    this.archive_group = param.archive_group;
  }

  set_archive_group(group: ArchiveGroup | undefined) {
    this.archive_group = group;
    this.emit('modified');
  }

  has_archive_lite(): boolean {
    const archive_group = this.archive_group;
    if (!archive_group) return false;
    const count = archive_group.archives.get_n_items();
    if (!count) return false;
    return true;
  }

  is_viable_remote_archive_registration() {
    const steamId = this.steamId;
    if (!steamId) {
      return false;
    }
    let group = this.archive_group;
    if (group !== undefined) {
      if (group.archives.get_n_items() !== 0) {
        return false;
      }
    }
    return true;
  }

  toManifest() {
    const manifest: AddonManifest = {
      stvpkid: this.vanityId,
      publishedfileid: this.steamId,
      time_updated: (() => {
            const date = this.timeUpdated;
            if (date === undefined) return date;
            return Math.floor(date.getTime() / 1000);
          })(),
      title: this.title,
      description: this.description,
      tags: (() => {
            const categories = new Map(this.categories);
            const tags: { tag: string }[] = [];
            categories.forEach((_, key) => tags.push({ tag: key }));
            return tags;
          })(),
      comment: this.comment,
      creators: (() => {
            const creators = new Map(this.creators);
            const _creators: { creator?: string }[] = [];
            creators.forEach((_, key) => _creators.push({ creator: key }));
            return _creators;
          })(),
      archives: (() => {
            return this.archive_group?.toManifest();
          })(),
    };
    return manifest;
  }

  toGVariant() {
    return vardict_make({
      stvpkid: GLib.Variant.new_string(this.id),
      publishedfileid: (() => {
        if (this.steamId === undefined) return null;
        return GLib.Variant.new_string(this.steamId);
      })(),
      time_updated: (() => {
        if (this.timeUpdated === undefined) return null;
        return GLib.Variant.new_uint64(this.timeUpdated.getTime() / 1000);
      })(),
      title: (() => {
        if (this.title === undefined) return null;
        return GLib.Variant.new_string(this.title);
      })(),
      description: (() => {
        if (this.description === undefined) return null;
        return GLib.Variant.new_string(this.description);
      })(),
      creators: (() => {
        const arr: GLib.Variant[] = [];
        const creators = this.creators;
        if (creators === undefined) return null;
        creators.forEach((_x, key) => {
          const val = vardict_make({
            id: (() => {
              return GLib.Variant.new_string(key);
            })(),
          });
          arr.push(val);
        });
        return GLib.Variant.new_array(
          GLib.VariantType.new_array(
            GLib.VariantType.new_dict_entry(
              GLib.VariantType.new('s'),
              GLib.VariantType.new('v')
            )
          ),
          arr
        );
      })(),
      subdir: GLib.Variant.new_string(this.subdir.get_path()),
      archive_group: (() => {
        if (this.archive_group === undefined) return null;
        return this.archive_group.toGVariant();
      })(),
    });
  }
}

export function creators2humanreadable(map: Map<string, {}> | undefined) {
  const creators: string[] = [];
  map?.forEach((_, key) => creators.push(key));
  if (creators.length === 0) return 'Unknown author';
  const text: string = creators.reduce((acc, x, i) => {
    if (i === 0) return `${x}`;
    return `${acc}, ${x}`;
  });
  return text;
}
