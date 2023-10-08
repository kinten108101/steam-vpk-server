import GLib from 'gi://GLib';

/**
 * Error GQuark for services of archiver module
 */
export function archiver_error_quark() {
  return GLib.quark_from_string('archiver-error');
}

export enum ArchiverErrorEnum {
  /**
   * Archive files are not supported for add-on item
   */
  ARCHIVE_NOT_AVAILABLE,
  /**
   * No archive specified for add-on item
   */
  NO_ARCHIVE,
}
