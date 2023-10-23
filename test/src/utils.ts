import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

const DefaultEncoder = new TextEncoder();

enum Color {
  reset = 0,
  bold = 1,
  red = 31,
  green = 32,
  lightGreen = 92,
  yellow = 33,
  blue = 34,
  pink = 35,
  cyan = 36,
  gray = 37,
  lightMagenta = 95,
};

let color: boolean = true;

function _sgr(param: number) {
  if (color)
    return `\x1b[${param}m`;
  else
    return '';
}

export function make_dir_nonstrict(dir: Gio.File) {
  try {
    dir.make_directory(null);
  } catch (error) {
    if (error instanceof GLib.Error) {
      if (error.matches(Gio.io_error_quark(), Gio.IOErrorEnum.EXISTS)) {}
      else throw error;
    } else throw error;
  }
}

export function replace_json(value: any, dest: Gio.File) {
  const serial = serialize(value);
  const bytes = DefaultEncoder.encode(serial);
  dest.replace_contents(bytes, null, false, Gio.FileCreateFlags.NONE, null);
  return;
}

function serialize(value: any) {
  return JSON.stringify(value, null, 2);
}

export async function timeout_async(delayms: number, ...args: any[]): Promise<null> {
  return new Promise((resolve, _reject) => {
    setTimeout(() => {
      resolve(null);
    }, delayms, args);
  });
}

/**
 * Callback signature for recursiveFileOperation().
 *
 * The example callback `recursiveDeleteCallback()` demonstrates how to
 * recursively delete a directory of files, while skipping unsupported file types.
 *
 * @param {Gio.File} file - the file to operate on
 * @param {Gio.FileType} fileType - the file type
 * @param {Gio.Cancellable} [cancellable] - optional cancellable
 * @returns {Promise|null} a Promise for the operation, or %null to ignore
 */
export function recursiveDeleteCallback(file: Gio.File, fileType: Gio.FileType.DIRECTORY, cancellable: Gio.Cancellable | null): Promise<any>;
export function recursiveDeleteCallback(file: Gio.File, fileType: Gio.FileType, cancellable: Gio.Cancellable | null = null) {
    switch (fileType) {
    case Gio.FileType.REGULAR:
    case Gio.FileType.SYMBOLIC_LINK:
        return file.delete(cancellable);

    case Gio.FileType.DIRECTORY:
        return recursiveFileOperation(file, recursiveDeleteCallback,
            cancellable);

    default:
        return null;
    }
}

/**
 * Recursively operate on @file and any children it may have.
 *
 * @param {Gio.File} file - the file or directory to delete
 * @param {Function} callback - a function that will be passed the file,
 *     file type (e.g. regular, directory), and @cancellable
 * @param {Gio.Cancellable} [cancellable] - optional cancellable
 * @returns {Promise} a Promise for the operation
 */
async function recursiveFileOperation(file: Gio.File, callback: Function, cancellable: Gio.Cancellable | null = null) {
    const fileInfo = await file.query_info_async('standard::type',
        Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, GLib.PRIORITY_DEFAULT,
        cancellable);
    const fileType = fileInfo.get_file_type();

    // If @file is a directory, collect all the operations as Promise branches
    // and resolve them in parallel
    if (fileType === Gio.FileType.DIRECTORY) {
        const iter = await file.enumerate_children_async('standard::type',
            Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, GLib.PRIORITY_DEFAULT,
            cancellable);

        const branches = [];

        while (true) {
            // eslint-disable-next-line
            const fileInfos = await iter.next_files_async(10, // max files
                GLib.PRIORITY_DEFAULT, cancellable);

            if (fileInfos.length === 0)
                break;

            for (const info of fileInfos) {
                const child = iter.get_child(info);
                const childType = info.get_file_type();

                // The callback decides whether to process a file, including
                // whether to recurse into a directory
                const branch = callback(child, childType, cancellable);

                if (branch)
                    branches.push(branch);
            }
        }

        await Promise.all(branches);
    }

    // Return the Promise for the top-level file
    return callback(file, cancellable);
}

export function parse_argv(argv: string[]) {
  if (argv.includes('--nocolor')) {
    color = false;
  }
}

export function random_name(): string {
  return Math.random().toString(36).replace('.', '');
}

let count_pass = 0;
let count_total = 0;

export async function run(name: string, fn: () => Promise<number>) {
  count_total++;
  let status;
  let error_obj: Error | GLib.Error | undefined;
  const time_start = new Date;
  try {
    status = await fn();
  } catch (error) {
    error_obj = error as Error | GLib.Error;
  }
  const time_end = new Date;
  const elapsed = Number(time_end) - Number(time_start);
  if (status === 0) {
    print(`${name} ${elapsed}ms ${_sgr(Color.bold)}${_sgr(Color.lightGreen)}PASS${_sgr(Color.reset)}`);
    count_pass++;
  } else if (error_obj) {
    print(`${name} ${elapsed}ms ${_sgr(Color.bold)}${_sgr(Color.red)}FAILED${_sgr(Color.reset)} Exception thrown`);
    print(error_obj?.message);
  } else {
    print(`${name} ${elapsed}ms ${_sgr(Color.bold)}${_sgr(Color.red)}FAILED${_sgr(Color.reset)}`);
  }
}

export function summarize() {
  print(`${count_pass}/${count_total}`);
}
