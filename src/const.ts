import GLib from 'gi://GLib';


export let VERSION = '';
export let PREFIX = '/usr';
export let LIB_DIR = 'lib';
export let DATA_DIR = 'share';

export type BuildTypes = 'debug' | 'release';
export let BUILD_TYPE: BuildTypes = 'release';

/** @deprecated */
export const APP_ID = 'com.github.kinten108101.SteamVPK';
export const SERVER_ID = 'com.github.kinten108101.SteamVPK.Server';
export const SERVER_PATH = '/com/github/kinten108101/SteamVPK/Server';
export const GSETTINGS_ID = 'com.github.kinten108101.SteamVPK';
export const DIR_NAME = 'steam-vpk';
export const CONFIG_DIR = GLib.get_user_config_dir() || GLib.build_filenamev([GLib.get_home_dir(), '.config']);
export const USER_DATA_DIR = GLib.get_user_data_dir() || GLib.build_filenamev([GLib.get_home_dir(), '.local', 'share']);
export const USER_STATE_DIR = GLib.get_user_state_dir() || GLib.build_filenamev([GLib.get_home_dir(), '.local', 'state']);
export const WEBAPI = 'a495b2096303c5909ee32b808fa608b3';
export const OAUTH = 'ac52a3a6c7496f8f71be2cf9f3fefdc7';
export const ADDON_INFO = 'metadata.json';
export const ADDON_INDEX = 'addons.json';
export const ADDON_DIR = 'addons';
export const PROFILE_DEFAULT_INFO = 'config.metadata.json';
export const ADDON_ARCHIVE = 'main.vpk';
export const DOWNLOAD_DIR = 'downloads';

export default {
  init(vals: Partial<{
    version: string,
    prefix: string,
    lib_dir: string,
    data_dir: string,
    build_type: string,
  }>) {
    if (vals.version)       VERSION       = vals.version;
    if (vals.prefix)        PREFIX        = vals.prefix;
    if (vals.lib_dir)       LIB_DIR       = vals.lib_dir;
    if (vals.data_dir)      DATA_DIR      = vals.data_dir;
    if (vals.build_type)    BUILD_TYPE    = vals.build_type as BuildTypes;
  },
};
