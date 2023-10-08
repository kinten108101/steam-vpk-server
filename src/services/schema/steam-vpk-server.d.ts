import { ArchiveManifest } from "./archive-manifest";

export type GetAddonResponse = {
  stvpkid: string;
  publishedfileid: string;
  time_updated: number;
  title: string;
  description: string;
  creators: {
    id: string;
  }[],
  subdir: string;
  archive_group: ArchiveManifest[];
}
