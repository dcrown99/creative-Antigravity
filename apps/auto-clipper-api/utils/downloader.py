import yt_dlp
import os
import imageio_ffmpeg
import re
import sys
import time

# パス設定の解決
try:
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from config import TEMP_DIR, COOKIES_FILE
except ImportError:
    # configがない場合のフォールバック
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    TEMP_DIR = os.path.join(os.path.dirname(BASE_DIR), "temp_data")
    COOKIES_FILE = os.path.join(BASE_DIR, "cookies.txt")

if not os.path.exists(TEMP_DIR):
    os.makedirs(TEMP_DIR)

def sanitize_filename(title: str) -> str:
    """Windowsファイル名として使用できない文字を除去"""
    sanitized = re.sub(r'[<>:"/\\|?*]', '', title)
    sanitized = re.sub(r'\s+', ' ', sanitized)
    return sanitized.strip()[:200] or "video"

def refresh_cookies_file() -> bool:
    """
    ローカルブラウザからCookieを抽出し、cookies.txtを更新する
    Returns:
        bool: 更新に成功したらTrue
    """
    print("🔄 Attempting to refresh cookies.txt from local browsers...")
    
    # 探索するブラウザの優先順位
    browsers = ['chrome', 'edge', 'firefox', 'brave', 'opera']
    
    # 検証用ダミーURL (軽量なページ)
    test_url = "https://www.youtube.com/watch?v=jNQXAC9IVRw"

    for browser in browsers:
        print(f"   Checking {browser}...")
        opts = {
            'cookiesfrombrowser': (browser,),
            'cookiefile': COOKIES_FILE,
            'quiet': True,
            'skip_download': True,
            'no_warnings': True,
        }
        
        try:
            # yt-dlpを使ってCookieを抽出・保存試行
            with yt_dlp.YoutubeDL(opts) as ydl:
                ydl.extract_info(test_url, download=False)
                
            # ファイルが生成され、中身があるか確認
            if os.path.exists(COOKIES_FILE) and os.path.getsize(COOKIES_FILE) > 0:
                print(f"✅ Successfully refreshed cookies from {browser}!")
                return True
                
        except Exception:
            # ブラウザがインストールされていない、またはログインしていない場合など
            continue

    print("❌ Failed to refresh cookies from any browser.")
    return False

def _download_attempt(url: str, output_template: str, ffmpeg_path: str) -> tuple[str, str]:
    """単一のダウンロード試行を行う内部関数"""
    
    ydl_opts = {
        # Force h264 to avoid AV1 decoding issues in some environments
        'format': 'bestvideo[ext=mp4][vcodec^=avc]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        'outtmpl': output_template,
        'quiet': True,
        'no_warnings': True,
        # 'overwrites': True, # Removed potential cause of bool error
        'ffmpeg_location': str(ffmpeg_path), # Ensure string
        # 403 Forbidden対策のUser-Agent偽装
        'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    }

    # cookies.txtが存在すれば使用する
    if os.path.exists(COOKIES_FILE):
        print(f"   Using cookie file: {COOKIES_FILE}")
        ydl_opts['cookiefile'] = COOKIES_FILE

    print(f"   [DEBUG] URL: {url} (Type: {type(url)})")
    print(f"   [DEBUG] Output Template: {output_template}")
    print(f"   [DEBUG] FFmpeg Path: {ffmpeg_path}")

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        filename = ydl.prepare_filename(info)
        title = info.get('title', 'video')
        return os.path.abspath(filename), title

def download_video(url: str, job_id: str) -> tuple[str, str]:
    """
    動画をダウンロードする。
    失敗した場合（特に認証エラー）、自動的にCookieを更新してリトライする。
    Returns:
        tuple[str, str]: (ファイルパス, 動画タイトル)
    """
    # Extract Video ID to check cache
    # Simple regex for YouTube ID
    video_id_match = re.search(r'(?:v=|\/)([0-9A-Za-z_-]{11}).*', url)
    
    if video_id_match:
        vid_id = video_id_match.group(1)
        # Check if file exists with this ID
        # We assume mp4 for simplicity in cache check, though yt-dlp might download mkv/webm.
        # But our output template forces mp4/mkv merge.
        # Let's check for common extensions.
        for ext in ['mp4', 'mkv', 'webm']:
            cache_path = os.path.join(TEMP_DIR, f"{vid_id}.{ext}")
            if os.path.exists(cache_path):
                print(f"[{job_id}] Cache hit! Using existing file: {cache_path}")
                
                # キャッシュヒット時もタイトルを取得する
                try:
                    ydl_opts = {
                        'quiet': True,
                        'no_warnings': True,
                        'skip_download': True,
                        'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    }
                    if os.path.exists(COOKIES_FILE):
                        ydl_opts['cookiefile'] = COOKIES_FILE
                        
                    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                        info = ydl.extract_info(url, download=False)
                        title = info.get('title', 'video')
                        return cache_path, title
                except Exception as e:
                    print(f"[{job_id}] Failed to fetch title for cached video: {e}")
                    return cache_path, "video"
        
        # If not cached, we will download to {vid_id}.%(ext)s
        output_template = os.path.join(TEMP_DIR, f"{vid_id}.%(ext)s")
    else:
        # Fallback to job_id if ID extraction fails
        output_template = os.path.join(TEMP_DIR, f"{job_id}.%(ext)s")

    ffmpeg_path = imageio_ffmpeg.get_ffmpeg_exe()
    
    max_retries = 1
    
    for attempt in range(max_retries + 1):
        try:
            print(f"[{job_id}] Download attempt {attempt + 1}...")
            return _download_attempt(url, output_template, ffmpeg_path)
            
        except Exception as e:
            error_msg = str(e).lower()
            is_auth_error = "sign in" in error_msg or "cookie" in error_msg or "403" in error_msg or "private" in error_msg
            
            # 最後の試行だった場合、または認証エラー以外で回復見込みがない場合はエラーを投げる
            if attempt == max_retries:
                print(f"[{job_id}] Final attempt failed: {e}")
                raise e
            
            if is_auth_error:
                print(f"[{job_id}] Authentication failed. Triggering self-healing...")
                # Cookie更新を試みる
                if refresh_cookies_file():
                    print(f"[{job_id}] Cookies refreshed. Retrying download...")
                    continue # 次のループ（再試行）へ
                else:
                    print(f"[{job_id}] Could not refresh cookies. Aborting.")
                    raise e
            else:
                # 認証以外のエラー（ネットワーク等）も一応リトライするが、ログだけ出す
                print(f"[{job_id}] Error occurred: {e}. Retrying...")
                time.sleep(2) # 少し待ってからリトライ
                continue

    raise Exception("Download failed after retries")