import { isNumberString } from "../../steam-vpk-utils/utils.js";
import { generateAuthor, generateName } from "../id.js";
import { PlayerSummary, PublishedFileDetails } from "../schema/steam-api.js";

function get_addon_part(gpfd_response: PublishedFileDetails): string | undefined {
  const title = gpfd_response['title'];
  if (title === undefined) return undefined;
  return generateName(title);
}

function get_creator_part(gps_response: PlayerSummary): string | undefined {
  const personaname = gps_response['personaname'];
  if (!(typeof personaname !== 'string' || personaname === ''))
    return generateAuthor(personaname);

  const profileurl = gps_response['profileurl'];
  const idIdx = profileurl?.indexOf('/id/') || -1;
  const vanityId = profileurl?.substring(idIdx + 4, profileurl.length - 1) || '';
  if (!(idIdx === -1 || isNumberString(vanityId))) // not vanityid found
    return generateAuthor(vanityId);

  const realname = gps_response['realname'];
  if (!(typeof realname !== 'string' || realname === ''))
    return generateAuthor(realname);

  return undefined;
}

export function create_id_from_workshop(gpfd_response: PublishedFileDetails, gps_response: PlayerSummary): string | undefined {
  const addon_part = get_addon_part(gpfd_response);
  if (addon_part === undefined) return undefined;
  const creator_part = get_creator_part(gps_response);
  if (creator_part === undefined) return undefined;
  return `${addon_part}@${creator_part}`;
}
