import GLib from 'gi://GLib';

/**
 * Error GQuark for ID services
 */
export function id_error_quark() {
  return GLib.quark_from_string('id-error');
}

export enum IdErrorEnum {
  /**
   * Generic failure
   */
  FAILED = 1,
}
