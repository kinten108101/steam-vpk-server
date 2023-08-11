import Soup from 'gi://Soup';
import SteamworkServices from './steam-api.js';

export class AddAddonServices {
  session: Soup.Session;

  steamapi!: SteamworkServices;

  constructor(
  { session,
  }:
  { session?: Soup.Session;
  }) {
    this.session = session || new Soup.Session();
  }

  bind(
  { steamapi,

  }:
  { steamapi: SteamworkServices;

  }) {
    this.steamapi = steamapi;
  }
  /*
  async retrieve_download_info(url: GLib.Uri) {

      const fileId = this.steamapi.getWorkshopItemId(url);
      if (fileId === undefined) {
        console.debug('Could not extract ID in URL');
        this.content_provider.errorWorkshopItemUrl('Incorrect Workshop Item URL');
        return [conversation.navigation.RETRY];
      }

      let fileDetails;
      try {
        fileDetails = await this.steamapi.getPublishedFileDetails(fileId);
      } catch (error) {
        console.debug('Could not get response');
        this.content_provider.errorWorkshopItemUrl('Incorrect Workshop Item URL');
        return [conversation.navigation.RETRY];
      }

      conversation.set_param('shared-file-details', fileDetails);

      const appid = fileDetails['consumer_app_id'];
      if (appid !== 550) {
        console.debug('Only L4D2 add-ons are allowed');
        this.content_provider.errorWorkshopItemUrl('Only L4D2 add-ons are allowed');
        return [conversation.navigation.RETRY];
      }

      const addonName = generateAddonName(fileDetails['title'] || '');
      conversation.set_param('addon-name', addonName);
      const creator = fileDetails['creator'];

      let playerDetails;
      try {
        playerDetails = await this.steamapi.getPlayerSummary(creator);
      } catch (error) {
        console.debug('Could not get response');
        showErrorMsg('Internal error');
        return [conversation.navigation.RETRY];
      }
      conversation.set_param('shared-creator-details', playerDetails);

      const creatorPart = this.steamapi.getCreatorPart(playerDetails);
      if (creatorPart === undefined) {
        return [conversation.navigation.RETRY];
      }

      const addonId = `${generateName(addonName)}@${creatorPart}`;
      conversation.set_param('addon-id', addonId);

      return [conversation.navigation.NEXT];
  }
  */
}
