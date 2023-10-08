import GLib from 'gi://GLib';

/**
 * Error GQuark for services of steam-api module
 */
export function steam_api_error_quark() {
  return GLib.quark_from_string('steam-api-error');
}

export enum SteamApiErrorEnum {
  /**
   * Wrong URL format, ID parameter not found
   */
  IdNotFound = 1,
  /**
   * Wrong URL format, ID parameter is not in decimal
   */
  IdNotDecimal,
  /**
   * Generic error from Steamwork server
   */
  RequestNotSuccessful,
  /**
   * Workshop item is not for the game L4D2
   */
  NotGameL4d2,
}
