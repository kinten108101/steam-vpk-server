import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Soup from 'gi://Soup';
import { isNumberString } from './steam-vpk-utils/utils.js';
import { DefaultEncoder, read_json_bytes } from './file.js';
import { OAUTH } from './const.js';
import { generateAuthor } from './id.js';

Gio._promisify(Soup.Session.prototype,
  'send_and_read_async',
  'send_and_read_finish');

export type GetPublishedFileDetailsResponse = {
  response: {
    result: number;
    resultcount: number;
    publishedfiledetails: PublishedFileDetails[],
  }
};

export type PublishedFileDetails = {
  title: string;
  publishedfileid: string;
  file_size: number;
  file_url: string;
  consumer_app_id: number;
  creator: string;
};

export type GetPlayerSummariesResponse = {
  response: {
    players: PlayerSummary[],
  },
}

export type PlayerSummary = {
  personaname: string; // empty will be ''
  profileurl: string; // empty will be ''
  realname: string; // empty will be ''
}

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
      throw new Error(`Request failed. Code ${msg.status_code}`);
    }
    const bytes = gbytes.get_data();
    if (bytes === null) throw new Error('Response is empty');
    const response = read_json_bytes(bytes);
    return response['response']?.['publishedfiledetails']?.[0];
  }

  async getPlayerSummary(user_id: string): Promise<PlayerSummary> {
    const webapi = OAUTH;
    const uri = GLib.Uri.parse(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?access_token=${webapi}&steamids=${user_id}&key=`, GLib.UriFlags.NONE);

    const msg = new Soup.Message({
      method: 'GET',
      uri,
    });

    const gbytes = await this.session.send_and_read_async(msg, GLib.PRIORITY_DEFAULT, null);
    const bytes = gbytes.get_data();
    if (bytes === null) throw new Error('Response is empty');
    const response = read_json_bytes(bytes);
    return response.players[0];
  }

  getWorkshopItemId(url: string): string | undefined {
    const idxParam = url.indexOf('?id=', 0);
    if (idxParam === undefined)
      return undefined;

    const fileId = url.substring(idxParam + 4, idxParam + 14);
    if (!isNumberString(fileId))
      return undefined;
    return fileId;
  }

  getCreatorPart(playerDetails: PlayerSummary): string | undefined {
   const personaname = playerDetails['personaname'];
    if (!(typeof personaname !== 'string' || personaname === ''))
      return generateAuthor(personaname);

    const profileurl = playerDetails['profileurl'];
    const idIdx = profileurl.indexOf('/id/');
    const vanityId = profileurl.substring(idIdx + 4, profileurl.length - 1);
    if (!(idIdx === -1 || isNumberString(vanityId))) // not vanityid found
      return generateAuthor(vanityId);

    const realname = playerDetails['realname'];
    if (!(typeof realname !== 'string' || realname === ''))
      return generateAuthor(realname);

    return undefined;
  }
}
