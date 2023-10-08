export type GetPublishedFileDetailsResponse = {
  response?: {
    result?: number;
    resultcount?: number;
    publishedfiledetails?: PublishedFileDetails[],
  }
};

export type PublishedFileDetails = {
  title?: string;
  publishedfileid?: string;
  file_name?: string;
  file_size?: number;
  file_url?: string;
  consumer_app_id?: number;
  creator?: string;
  description?: string;
  time_updated?: number;
  tags?: {
    tag?: string;
  }[];
};

export type GetPlayerSummariesResponse = {
  response?: {
    players?: PlayerSummary[],
  },
}

export type PlayerSummary = {
  personaname?: string; // empty will be ''
  profileurl?: string; // empty will be ''
  realname?: string; // empty will be ''
}
