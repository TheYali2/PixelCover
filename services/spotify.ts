const CLIENT_ID = 'b24ea73959ae45ca8e6ea7cf97fb1b44';
const CLIENT_SECRET = 'c022d451b6ea495686aa2bfb53de3b88';

let accessToken: string | null = null;
let tokenExpirationTime: number = 0;

export interface SpotifyImage {
  url: string;
  height: number;
  width: number;
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  images: SpotifyImage[];
  release_date: string;
  external_urls: { spotify: string };
  album_type: 'album' | 'single' | 'compilation';
}

export interface SpotifyArtist {
  id: string;
  name: string;
  images?: SpotifyImage[];
  genres?: string[];
}

export const getAccessToken = async (): Promise<string> => {
  const currentTime = Date.now();
  if (accessToken && currentTime < tokenExpirationTime) {
    return accessToken;
  }

  const authString = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${authString}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch Spotify access token');
  }

  const data = await response.json();
  accessToken = data.access_token;
  tokenExpirationTime = currentTime + (data.expires_in - 60) * 1000;
  return accessToken as string;
};

export const searchArtists = async (name: string): Promise<SpotifyArtist[]> => {
  const token = await getAccessToken();
  const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(name)}&type=artist&limit=20`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  const data = await response.json();
  return data.artists?.items || [];
};

export const getRandomArtistName = async (): Promise<string> => {
  const token = await getAccessToken();
  const characters = 'abcdefghijklmnopqrstuvwxyz';
  const randomChar = characters.charAt(Math.floor(Math.random() * characters.length));
  const randomOffset = Math.floor(Math.random() * 1000);

  const response = await fetch(`https://api.spotify.com/v1/search?q=${randomChar}&type=artist&limit=1&offset=${randomOffset}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  const data = await response.json();
  if (data.artists && data.artists.items.length > 0) {
    return data.artists.items[0].name;
  }
  return 'The Beatles';
};

export const getArtistTopTracks = async (artistId: string): Promise<SpotifyAlbum[]> => {
  const token = await getAccessToken();
  const response = await fetch(`https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=US`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const data = await response.json();

  if (!data.tracks) return [];

  return data.tracks.map((track: any) => ({
    id: track.id,
    name: track.name,
    images: track.album.images,
    release_date: track.album.release_date,
    external_urls: { spotify: track.external_urls.spotify },
    album_type: 'single' // Top tracks are treated as individual items
  }));
};

export const getRandomAlbumForArtist = async (
  artistId: string,
  difficulty: 'EASY' | 'MEDIUM' | 'HARD',
  excludeIds: string[] = []
): Promise<SpotifyAlbum | null> => {
  const token = await getAccessToken();
  let items: SpotifyAlbum[] = [];

  if (difficulty === 'EASY') {
    items = await getArtistTopTracks(artistId);
  } else {
    const limit = difficulty === 'MEDIUM' ? 20 : 50;
    const response = await fetch(`https://api.spotify.com/v1/artists/${artistId}/albums?include_groups=album,single&limit=${limit}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const data = await response.json();
    items = data.items || [];
  }

  if (items.length === 0) {
    return null;
  }

  const availableItems = items.filter((item: SpotifyAlbum) => !excludeIds.includes(item.id));

  if (availableItems.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * availableItems.length);
  return availableItems[randomIndex];
};