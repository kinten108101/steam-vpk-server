import GLib from 'gi://GLib';

/**
 * Error GQuark for services of addon-store module
 */
export function addon_store_error_quark() {
  return GLib.quark_from_string('addon-store-error');
}

export enum AddonStoreErrorEnum {
  EXISTS = 1,
}
