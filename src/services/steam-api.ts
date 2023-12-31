import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Soup from 'gi://Soup';
import { isNumberString } from '../steam-vpk-utils/utils.js';
import { DefaultEncoder, read_json_bytes } from './files.js';
import { generateAuthor } from './id.js';
import { GetPlayerSummariesResponse, GetPublishedFileDetailsResponse, PlayerSummary, PublishedFileDetails } from './schema/steam-api.js';
import { SteamApiErrorEnum, steam_api_error_quark } from './errors/steam-api.js';
import { WEBAPI } from '../const.js';

export function make_workshop_item_url(file_id: string) {
  return `https://steamcommunity.com/sharedfiles/filedetails/?id=${file_id}`;
}

export default class SteamworkServices {
  bus_export!: Gio.DBusExportedObject;
  url_gpfd: GLib.Uri;
  session: Soup.Session;
  cancellable: Gio.Cancellable;

  constructor(config: { session?: Soup.Session } = {}) {
    this.url_gpfd = GLib.Uri.parse('https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/', GLib.UriFlags.NONE);
    this.session = config.session || new Soup.Session();
    this.cancellable = new Gio.Cancellable();
  }

  async getPublishedFileDetails(steam_id: string): Promise<PublishedFileDetails> {
    const msg = new Soup.Message({
      method: 'POST',
      uri: this.url_gpfd,
    });
    const requestBody = new GLib.Bytes(DefaultEncoder.encode(`itemcount=1&publishedfileids%5B0%5D=${steam_id}`));
    msg.set_request_body_from_bytes(
      'application/x-www-form-urlencoded',
      requestBody,
    );
    const gbytes = await this.session.send_and_read_async(msg, GLib.PRIORITY_DEFAULT, this.cancellable);
    if (msg.status_code !== 200) {
      throw new GLib.Error(
        steam_api_error_quark(),
        SteamApiErrorEnum.RequestNotSuccessful,
        `Request was not successful. Received a response status code of \"${msg.status_code}\"`);
    }
    const bytes = gbytes.get_data();
    if (bytes === null) throw new Error;
    const response: GetPublishedFileDetailsResponse = read_json_bytes(bytes);
    const data = response['response']?.['publishedfiledetails']?.[0];
    if (data?.consumer_app_id !== 550) {
      throw new GLib.Error(
        steam_api_error_quark(),
        SteamApiErrorEnum.NotGameL4d2,
        `The item belongs to a workshop of ID \"${data?.consumer_app_id}\", which is not L4D2 Workshop`);
    }
    return data;
  }

  async getPlayerSummary(user_id: string): Promise<PlayerSummary> {
    const uri = GLib.Uri.parse(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${WEBAPI}&steamids=${user_id}`, GLib.UriFlags.NONE);

    const msg = new Soup.Message({
      method: 'GET',
      uri,
    });

    const gbytes = await this.session.send_and_read_async(msg, GLib.PRIORITY_DEFAULT, null);
    const bytes = gbytes.get_data();
    if (msg.status_code !== 200) {
      throw new GLib.Error(
        steam_api_error_quark(),
        SteamApiErrorEnum.RequestNotSuccessful,
        `Request was not successful. Received a response status code of \"${msg.status_code}\"`);
    }
    if (bytes === null) throw new Error;
    const response: GetPlayerSummariesResponse = read_json_bytes(bytes);
    const summary: PlayerSummary | undefined = response.response?.players?.[0];
    if (summary === undefined) throw new Error;
    return summary;
  }

  getWorkshopItemId(url: string): string {
    const idxParam = url.indexOf('?id=', 0);
    if (idxParam === undefined) {
      throw new GLib.Error(
        steam_api_error_quark(),
        SteamApiErrorEnum.IdNotFound,
        `Could not extract id parameter from url \"${url}\"`);
    }

    const fileId = url.substring(idxParam + 4, idxParam + 14);
    if (!isNumberString(fileId)) {
      throw new GLib.Error(
        steam_api_error_quark(),
        SteamApiErrorEnum.IdNotDecimal,
        `Supposed id parameter in url \"${url}\" is not in decimal format`);
    }
    return fileId;
  }

  getCreatorPart(playerDetails: PlayerSummary): string | undefined {
   const personaname = playerDetails['personaname'];
    if (!(typeof personaname !== 'string' || personaname === ''))
      return generateAuthor(personaname);

    const profileurl = playerDetails['profileurl'];
    const idIdx = profileurl?.indexOf('/id/') || -1;
    const vanityId = profileurl?.substring(idIdx + 4, profileurl?.length - 1) || '';
    if (!(idIdx === -1 || isNumberString(vanityId))) // not vanityid found
      return generateAuthor(vanityId);

    const realname = playerDetails['realname'];
    if (!(typeof realname !== 'string' || realname === ''))
      return generateAuthor(realname);

    return undefined;
  }
}
