import spotipy
from spotipy.oauth2 import SpotifyClientCredentials
import music_tag
import requests
from io import BytesIO
import os
import sys
from pathlib import Path
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class AudioMetadataTagger:
    def __init__(self, client_id=None, client_secret=None):
        """
        Initialize the metadata tagger with Spotify credentials.
        
        Args:
            client_id (str): Spotify client ID (optional, will try environment variables)
            client_secret (str): Spotify client secret (optional, will try environment variables)
        """
        # Try to get credentials from parameters, environment variables, or fallback to hardcoded
        self.client_id = client_id or os.getenv('SPOTIFY_CLIENT_ID', '70eca55b355f4bd788c18f94a35a69ad')
        self.client_secret = client_secret or os.getenv('SPOTIFY_CLIENT_SECRET', 'cf5a8af3294e4cff9968f2992ccbe0e6')
        
        try:
            self.sp = spotipy.Spotify(auth_manager=SpotifyClientCredentials(
                client_id=self.client_id,
                client_secret=self.client_secret
            ))
            logger.info("Successfully connected to Spotify API")
        except Exception as e:
            logger.error(f"Failed to connect to Spotify API: {e}")
            raise

    def search_song_metadata(self, query):
        """
        Search for song metadata using Spotify API.
        
        Args:
            query (str): Search query for the song
            
        Returns:
            dict: Metadata dictionary or None if not found
        """
        try:
            logger.info(f"Searching Spotify for: {query}")
            result = self.sp.search(q=query, type='track', limit=1)
            
            if result['tracks']['items']:
                track = result['tracks']['items'][0]
                
                # Get artist info for better genre detection
                artist_id = track['artists'][0]['id']
                artist_info = self.sp.artist(artist_id)
                
                # Extract album release information
                release_date = track['album']['release_date']
                album_year = ''
                release_date_full = ''
                
                if release_date:
                    release_date_full = release_date
                    # Extract year from release date (format: YYYY-MM-DD or YYYY)
                    album_year = release_date.split('-')[0] if '-' in release_date else release_date[:4]
                
                metadata = {
                    'title': track['name'],
                    'artist': ', '.join([artist['name'] for artist in track['artists']]),
                    'album': track['album']['name'],
                    'album_year': album_year,  # Album release year
                    'year': album_year,  # Standard year field
                    'release_date': release_date_full,  # Full release date
                    'track_number': track['track_number'],
                    'album_artist': track['album']['artists'][0]['name'] if track['album']['artists'] else '',
                    'genre': ', '.join(artist_info.get('genres', [])),  # Get genres from artist info
                    'artwork_url': track['album']['images'][0]['url'] if track['album']['images'] else None,
                    'album_total_tracks': track['album']['total_tracks'],
                    'disc_number': track['disc_number'],
                    'duration_ms': track['duration_ms'],
                    'popularity': track['popularity']
                }
                
                logger.info(f"Found metadata for: {metadata['artist']} - {metadata['title']}")
                return metadata
            else:
                logger.warning(f"No results found for query: {query}")
                return None
                
        except Exception as e:
            logger.error(f"Error searching for metadata: {e}")
            return None

    def download_artwork(self, artwork_url):
        """
        Download artwork from URL.
        
        Args:
            artwork_url (str): URL of the artwork
            
        Returns:
            bytes: Artwork data or None if download fails
        """
        try:
            if artwork_url:
                logger.info("Downloading artwork...")
                response = requests.get(artwork_url, timeout=10)
                response.raise_for_status()
                return response.content
        except Exception as e:
            logger.error(f"Failed to download artwork: {e}")
        return None

    def add_metadata_to_file(self, file_path, metadata):
        """
        Add metadata to an audio file with comprehensive field mapping.
        
        Args:
            file_path (str): Path to the audio file
            metadata (dict): Metadata dictionary
        """
        try:
            logger.info(f"Adding metadata to: {file_path}")
            
            # Load the audio file
            audio_file = music_tag.load_file(file_path)
            
            # Clear existing metadata first (optional - remove if you want to preserve existing tags)
            # audio_file.remove_tag()

            # Title - try multiple field names
            if metadata.get('title'):
                try:
                    audio_file['title'] = metadata['title']
                    audio_file['TIT2'] = metadata['title']  # ID3v2
                    logger.info(f"Added title: {metadata['title']}")
                except Exception as e:
                    logger.warning(f"Failed to set title: {e}")

            # Artist - try multiple field names
            if metadata.get('artist'):
                try:
                    audio_file['artist'] = metadata['artist']
                    audio_file['TPE1'] = metadata['artist']  # ID3v2
                    audio_file['ARTIST'] = metadata['artist']  # Vorbis
                    logger.info(f"Added artist: {metadata['artist']}")
                except Exception as e:
                    logger.warning(f"Failed to set artist: {e}")

            # Album - try multiple field names
            if metadata.get('album'):
                try:
                    audio_file['album'] = metadata['album']
                    audio_file['TALB'] = metadata['album']  # ID3v2
                    audio_file['ALBUM'] = metadata['album']  # Vorbis
                    logger.info(f"Added album: {metadata['album']}")
                except Exception as e:
                    logger.warning(f"Failed to set album: {e}")

            # Album Year - try multiple field names and formats
            if metadata.get('album_year'):
                try:
                    year_value = metadata['album_year']
                    year_int = int(year_value) if str(year_value).isdigit() else year_value
                    
                    # Standard fields
                    audio_file['year'] = year_int
                    audio_file['date'] = str(year_value)
                    
                    # ID3v2 fields
                    audio_file['TDRC'] = str(year_value)  # Recording time
                    audio_file['TYER'] = str(year_value)  # Year (deprecated but still used)
                    
                    # Vorbis fields
                    audio_file['DATE'] = str(year_value)
                    audio_file['YEAR'] = str(year_value)
                    
                    logger.info(f"Added album year: {year_value}")
                except Exception as e:
                    logger.warning(f"Failed to set year: {e}")

            # Track Number - try multiple field names
            if metadata.get('track_number'):
                try:
                    track_num = str(metadata['track_number'])
                    total_tracks = str(metadata.get('album_total_tracks', ''))
                    
                    # Format as "track/total" if total is available
                    if total_tracks:
                        track_format = f"{track_num}/{total_tracks}"
                    else:
                        track_format = track_num
                    
                    audio_file['tracknumber'] = track_format
                    audio_file['TRCK'] = track_format  # ID3v2
                    audio_file['TRACKNUMBER'] = track_num  # Vorbis
                    audio_file['TRACK'] = track_num
                    
                    logger.info(f"Added track number: {track_format}")
                except Exception as e:
                    logger.warning(f"Failed to set track number: {e}")

            # Album Artist - try multiple field names
            if metadata.get('album_artist'):
                try:
                    audio_file['albumartist'] = metadata['album_artist']
                    audio_file['TPE2'] = metadata['album_artist']  # ID3v2
                    audio_file['ALBUMARTIST'] = metadata['album_artist']  # Vorbis
                    audio_file['ALBUM_ARTIST'] = metadata['album_artist']
                    logger.info(f"Added album artist: {metadata['album_artist']}")
                except Exception as e:
                    logger.warning(f"Failed to set album artist: {e}")

            # Genre - try multiple field names
            if metadata.get('genre'):
                try:
                    audio_file['genre'] = metadata['genre']
                    audio_file['TCON'] = metadata['genre']  # ID3v2
                    audio_file['GENRE'] = metadata['genre']  # Vorbis
                    logger.info(f"Added genre: {metadata['genre']}")
                except Exception as e:
                    logger.warning(f"Failed to set genre: {e}")

            # Additional metadata with error handling
            if metadata.get('album_total_tracks'):
                try:
                    audio_file['totaltracks'] = str(metadata['album_total_tracks'])
                    audio_file['TRACKTOTAL'] = str(metadata['album_total_tracks'])
                except Exception as e:
                    logger.warning(f"Failed to set total tracks: {e}")

            if metadata.get('disc_number'):
                try:
                    audio_file['discnumber'] = str(metadata['disc_number'])
                    audio_file['TPOS'] = str(metadata['disc_number'])  # ID3v2
                    audio_file['DISCNUMBER'] = str(metadata['disc_number'])  # Vorbis
                except Exception as e:
                    logger.warning(f"Failed to set disc number: {e}")

            # Add release date if available
            if metadata.get('release_date'):
                try:
                    audio_file['originaldate'] = metadata['release_date']
                    audio_file['TDOR'] = metadata['release_date']  # ID3v2 Original release time
                except Exception as e:
                    logger.warning(f"Failed to set release date: {e}")

            # Add artwork with better error handling
            if metadata.get('artwork_url'):
                try:
                    artwork_data = self.download_artwork(metadata['artwork_url'])
                    if artwork_data:
                        audio_file['artwork'] = artwork_data
                        audio_file['APIC'] = artwork_data  # ID3v2
                        logger.info("Artwork added successfully")
                except Exception as e:
                    logger.warning(f"Failed to add artwork: {e}")

            # Save the file with error handling
            try:
                audio_file.save()
                logger.info(f"Successfully saved metadata to {file_path}")
            except Exception as e:
                logger.error(f"Failed to save file {file_path}: {e}")
                raise
            
            # Verify metadata was written by reading it back
            try:
                verify_file = music_tag.load_file(file_path)
                verification_results = {
                    'title': str(verify_file['title'].value) if verify_file['title'].value else 'Not set',
                    'artist': str(verify_file['artist'].value) if verify_file['artist'].value else 'Not set',
                    'album': str(verify_file['album'].value) if verify_file['album'].value else 'Not set',
                    'year': str(verify_file['year'].value) if verify_file['year'].value else 'Not set',
                    'tracknumber': str(verify_file['tracknumber'].value) if verify_file['tracknumber'].value else 'Not set',
                    'albumartist': str(verify_file['albumartist'].value) if verify_file['albumartist'].value else 'Not set',
                    'genre': str(verify_file['genre'].value) if verify_file['genre'].value else 'Not set'
                }
                
                # Print verification summary
                print(f"\n✅ Metadata added and verified for: {os.path.basename(file_path)}")
                print(f"   Title: {verification_results['title']}")
                print(f"   Artist: {verification_results['artist']}")
                print(f"   Album: {verification_results['album']}")
                print(f"   Album Year: {verification_results['year']}")
                print(f"   Track Number: {verification_results['tracknumber']}")
                print(f"   Album Artist: {verification_results['albumartist']}")
                print(f"   Genre: {verification_results['genre']}")
                
                # Check if any critical fields failed
                failed_fields = []
                if verification_results['title'] == 'Not set' and metadata.get('title'):
                    failed_fields.append('Title')
                if verification_results['artist'] == 'Not set' and metadata.get('artist'):
                    failed_fields.append('Artist')
                if verification_results['album'] == 'Not set' and metadata.get('album'):
                    failed_fields.append('Album')
                if verification_results['year'] == 'Not set' and metadata.get('album_year'):
                    failed_fields.append('Year')
                
                if failed_fields:
                    print(f"   ⚠️  Warning: These fields may not have been set properly: {', '.join(failed_fields)}")
                else:
                    print(f"   ✅ All metadata fields verified successfully!")
                    
            except Exception as e:
                logger.warning(f"Could not verify metadata for {file_path}: {e}")
                # Still show what we tried to add
                print(f"\n✅ Metadata processing completed for: {os.path.basename(file_path)}")
                print(f"   Attempted to add:")
                print(f"   Title: {metadata.get('title', 'N/A')}")
                print(f"   Artist: {metadata.get('artist', 'N/A')}")
                print(f"   Album: {metadata.get('album', 'N/A')}")
                print(f"   Album Year: {metadata.get('album_year', 'N/A')}")
                print(f"   Track Number: {metadata.get('track_number', 'N/A')}")
                print(f"   Album Artist: {metadata.get('album_artist', 'N/A')}")
                print(f"   Genre: {metadata.get('genre', 'N/A')}")
            
        except Exception as e:
            logger.error(f"Failed to add metadata to {file_path}: {e}")
            print(f"❌ Error processing {os.path.basename(file_path)}: {e}")
            raise

    def tag_audio_file(self, file_path, search_query=None):
        """
        Tag a single audio file with metadata.
        
        Args:
            file_path (str): Path to the audio file
            search_query (str): Custom search query (optional)
        """
        # Validate file exists
        if not os.path.exists(file_path):
            logger.error(f"File not found: {file_path}")
            return False

        # Generate search query from filename if not provided
        if not search_query:
            filename = os.path.splitext(os.path.basename(file_path))[0]
            # Clean up common filename patterns
            search_query = filename.replace('SpotiDownloader.com - ', '').replace('_', ' ').replace('-', ' ')

        logger.info(f"Processing: {os.path.basename(file_path)}")
        metadata = self.search_song_metadata(search_query)

        if metadata:
            try:
                self.add_metadata_to_file(file_path, metadata)
                return True
            except Exception as e:
                logger.error(f"Failed to process {file_path}: {e}")
                return False
        else:
            print(f"❌ No metadata found for: {os.path.basename(file_path)}")
            return False

    def tag_multiple_files(self, file_paths, search_queries=None):
        """
        Tag multiple audio files with metadata.
        
        Args:
            file_paths (list): List of file paths
            search_queries (list): List of custom search queries (optional)
        """
        if search_queries and len(search_queries) != len(file_paths):
            raise ValueError("Number of search queries must match number of files")
        
        successful = 0
        total = len(file_paths)
        
        for i, file_path in enumerate(file_paths):
            query = search_queries[i] if search_queries else None
            if self.tag_audio_file(file_path, query):
                successful += 1
        
        print(f"\n📊 Summary: {successful}/{total} files processed successfully")

    def tag_directory(self, directory_path, file_extensions=None):
        """
        Tag all audio files in a directory.
        
        Args:
            directory_path (str): Path to the directory
            file_extensions (list): List of file extensions to process (default: common audio formats)
        """
        if file_extensions is None:
            file_extensions = ['.mp3', '.flac', '.m4a', '.wav', '.ogg', '.wma']
        
        directory = Path(directory_path)
        if not directory.exists():
            logger.error(f"Directory not found: {directory_path}")
            return
        
        audio_files = []
        for ext in file_extensions:
            audio_files.extend(directory.glob(f"*{ext}"))
        
        if not audio_files:
            print(f"No audio files found in {directory_path}")
            return
        
        print(f"Found {len(audio_files)} audio files to process...")
        self.tag_multiple_files([str(f) for f in audio_files])


def main():
    """Main function to demonstrate usage."""
    # Initialize the tagger
    tagger = AudioMetadataTagger()
    
    # Example usage - single file
    song_name = "File name"
    file_path = f"{song_name}.mp3"
    
    if os.path.exists(file_path):
        tagger.tag_audio_file(file_path, search_query=song_name)
    else:
        print(f"Example file not found: {file_path}")
        print("\nUsage examples:")
        print("1. Tag single file:")
        print('   tagger.tag_audio_file("song.mp3", "Artist Song Title")')
        print("\n2. Tag multiple files:")
        print('   tagger.tag_multiple_files(["song1.mp3", "song2.mp3"])')
        print("\n3. Tag all files in directory:")
        print('   tagger.tag_directory("/path/to/music/folder")')


if __name__ == "__main__":
    main()