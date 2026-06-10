import os
import pickle
import time
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from googleapiclient.errors import HttpError

# Scopes: Upload + Manage (needed for thumbnails)
SCOPES = [
    'https://www.googleapis.com/auth/youtube.upload', 
    'https://www.googleapis.com/auth/youtube',
    'https://www.googleapis.com/auth/youtube.force-ssl'
]

# Paths
CREDENTIALS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'credentials')
TOKEN_FILE = os.path.join(CREDENTIALS_DIR, 'token.pickle')

class YouTubeClient:
    def __init__(self):
        self.service = None
        self._authenticate()

    def _authenticate(self):
        """Authenticates using existing token.pickle"""
        creds = None
        
        if os.path.exists(TOKEN_FILE):
            with open(TOKEN_FILE, 'rb') as token:
                try:
                    creds = pickle.load(token)
                except Exception:
                    print("Token file is corrupt.")

        # Refresh if expired
        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
                # Save refreshed token
                if not os.path.exists(CREDENTIALS_DIR):
                    os.makedirs(CREDENTIALS_DIR)
                with open(TOKEN_FILE, 'wb') as token:
                    pickle.dump(creds, token)
                print("Token refreshed successfully.")
            except Exception as e:
                print(f"Token refresh failed: {e}")
                creds = None
        
        if creds and creds.valid:
            try:
                self.service = build('youtube', 'v3', credentials=creds)
                print("YouTube Service authenticated.")
            except Exception as e:
                print(f"Failed to build service: {e}")
        else:
            print("No valid credentials found. YouTube upload disabled.")
            print(f"Please run 'python scripts/auth_youtube.py' locally and upload {TOKEN_FILE} to server.")

    def upload_thumbnail(self, video_id: str, thumbnail_path: str):
        """Uploads a custom thumbnail for a video."""
        if not self.service or not video_id or not thumbnail_path or not os.path.exists(thumbnail_path):
            return False

        try:
            print(f"Uploading thumbnail for {video_id}...")
            self.service.thumbnails().set(
                videoId=video_id,
                media_body=MediaFileUpload(thumbnail_path)
            ).execute()
            print("Thumbnail set successfully.")
            return True
        except HttpError as e:
            print(f"Thumbnail upload failed: {e}")
            return False

    def upload_video(self, file_path: str, title: str, description: str, 
                     tags: list = None, category_id: str = "22", privacy_status: str = "private",
                     thumbnail_path: str = None):
        """
        Uploads a video and optionally sets a thumbnail.
        """
        if not self.service:
            return {"error": "YouTube service not authenticated"}

        if not os.path.exists(file_path):
            return {"error": "Video file not found"}

        tags = tags or []
        # Title limit check
        if len(title) > 100:
            title = title[:97] + "..."

        body = {
            'snippet': {
                'title': title,
                'description': description,
                'tags': tags,
                'categoryId': category_id
            },
            'status': {
                'privacyStatus': privacy_status,
                'selfDeclaredMadeForKids': False,
            }
        }

        media = MediaFileUpload(file_path, chunksize=4 * 1024 * 1024, resumable=True)

        try:
            print(f"Uploading {file_path} to YouTube...")
            request = self.service.videos().insert(
                part=','.join(body.keys()),
                body=body,
                media_body=media
            )

            response = None
            while response is None:
                status, response = request.next_chunk()
                if status:
                    print(f"Uploaded {int(status.progress() * 100)}%")

            video_id = response.get('id')
            print(f"Upload Complete! Video ID: {video_id}")
            
            # Custom Thumbnail Upload
            if thumbnail_path:
                # API sometimes needs a moment after upload before accepting thumbnail
                time.sleep(2) 
                self.upload_thumbnail(video_id, thumbnail_path)

            return {
                "success": True,
                "video_id": video_id,
                "url": f"https://youtu.be/{video_id}"
            }

        except Exception as e:
            print(f"An error occurred during upload: {e}")
            return {"success": False, "error": str(e)}
