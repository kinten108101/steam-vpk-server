export type ArchiveManifest = LocalArchiveManifest | RemoteArchiveManifest;

export type AbstractArchiveManifest = {
  type?: string;
  path?: string;
}

export type LocalArchiveManifest = {
  type: 'local';
} & AbstractArchiveManifest;

export type RemoteArchiveManifest = {
  type: 'steam';
  url?: string;
  size?: number;
} & AbstractArchiveManifest;

export const ArchiveTypes = ['local', 'steam'];
export type ArchiveType = 'local' | 'steam';

export namespace ArchiveType {
  export function parse(val: unknown): ArchiveManifest["type"] | undefined {
    let ret: string | undefined = undefined;
    ArchiveTypes.forEach(key => {
      if (val === key) {
        ret = key;
        return;
      }
    });
    return ret;
  }
}
