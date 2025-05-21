import spotipy
from spotipy.oauth2 import SpotifyClientCredentials
import music_tag
import requests
from io import BytesIO

# Spotify Auth
sp = spotipy.Spotify(auth_manager=SpotifyClientCredentials(
    client_id='YOUR_SPOTIFY_CLIENT_ID',
    client_secret='YOUR_SPOTIFY_CLIENT_SECRET'
))

def search_song_metadata(query):
    result = sp.search(q=query, type='track', limit=1)
    if result['tracks']['items']:
        track = result['tracks']['items'][0]
        metadata = {
            'title': track['name'],
            'artist': ', '.join([a['name'] for a in track['artists']]),
            'album': track['album']['name'],
            'year': track['album']['release_date'][:4],
            'artwork_url': track['album']['images'][0]['url'] if track['album']['images'] else None
        }
        return metadata
    return None

def add_metadata_to_file(file_path, metadata):
    f = music_tag.load_file(file_path)

    f['title'] = metadata.get('title')
    f['artist'] = metadata.get('artist')
    f['album'] = metadata.get('album')
    f['year'] = metadata.get('year')

    # Add artwork
    if metadata.get('artwork_url'):
        artwork_data = requests.get(metadata['artwork_url']).content
        f['artwork'] = artwork_data

    f.save()
    print(f"Metadata added to {file_path}")

def tag_audio_file(file_path, search_query=None):
    if not search_query:
        import os
        search_query = os.path.splitext(os.path.basename(file_path))[0]

    print(f"Searching for: {search_query}")
    metadata = search_song_metadata(search_query)

    if metadata:
        add_metadata_to_file(file_path, metadata)
    else:
        print("No metadata found.")


if __name__ == "__main__":
    file_path = "your_song.mp3"
    tag_audio_file(file_path, search_query="Coldplay Paradise")
