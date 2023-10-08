import { ArchiveManifest } from "./archive-manifest";

export interface AddonManifest {
  stvpkid?: string,
  publishedfileid?: string,
  time_updated?: number,
  title?: string,
  description?: string,
  tags?: { tag: string }[],
  creators?: { creator?: string }[],
  archives?: ArchiveManifest[],
}
