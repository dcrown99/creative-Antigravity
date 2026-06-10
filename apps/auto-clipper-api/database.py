import sqlite3
import os
import json
import redis

# Docker環境では環境変数を優先、なければカレントディレクトリのjobs.dbを使用
DB_NAME = os.getenv("DB_PATH", "jobs.db")
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

# Sync Redis client for database operations
redis_sync = redis.from_url(REDIS_URL, decode_responses=True)

def init_db():
    # データベースディレクトリが存在しない場合は作成（Dockerのボリュームマウント用）
    db_dir = os.path.dirname(DB_NAME)
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir)

    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    # Check if columns exist (simple migration)
    try:
        c.execute('SELECT candidates FROM jobs LIMIT 1')
    except sqlite3.OperationalError:
        # Table might not exist or column missing
        pass
        
    c.execute('''
        CREATE TABLE IF NOT EXISTS jobs (
            id TEXT PRIMARY KEY,
            url TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            result_path TEXT,
            candidates TEXT,
            transcript TEXT,
            video_path TEXT,
            title TEXT,
            thumbnail_url TEXT,
            youtube_url TEXT
        )
    ''')
    
    # Add columns if they don't exist (for existing DB)
    try:
        c.execute('ALTER TABLE jobs ADD COLUMN candidates TEXT')
    except sqlite3.OperationalError:
        pass
        
    try:
        c.execute('ALTER TABLE jobs ADD COLUMN transcript TEXT')
    except sqlite3.OperationalError:
        pass
        
    try:
        c.execute('ALTER TABLE jobs ADD COLUMN video_path TEXT')
    except sqlite3.OperationalError:
        pass

    try:
        c.execute('ALTER TABLE jobs ADD COLUMN title TEXT')
    except sqlite3.OperationalError:
        pass

    try:
        c.execute('ALTER TABLE jobs ADD COLUMN thumbnail_url TEXT')
    except sqlite3.OperationalError:
        pass
        
    try:
        c.execute('ALTER TABLE jobs ADD COLUMN youtube_url TEXT')
    except sqlite3.OperationalError:
        pass

    conn.commit()
    conn.close()

def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def create_job(job_id: str, url: str):
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('INSERT INTO jobs (id, url, status) VALUES (?, ?, ?)', (job_id, url, 'pending'))
    conn.commit()
    conn.close()

def update_job_status(job_id: str, status: str, result_path: str = None, candidates=None, transcript=None, video_path: str = None, title: str = None, thumbnail_url: str = None, youtube_url: str = None):
    conn = get_db_connection()
    c = conn.cursor()
    
    updates = ['status = ?']
    params = [status]
    
    if result_path:
        updates.append('result_path = ?')
        params.append(result_path)
    
    if candidates is not None:
        updates.append('candidates = ?')
        params.append(json.dumps(candidates))
        
    if transcript is not None:
        updates.append('transcript = ?')
        params.append(json.dumps(transcript))
        
    if video_path is not None:
        updates.append('video_path = ?')
        params.append(video_path)

    if title is not None:
        updates.append('title = ?')
        params.append(title)

    if thumbnail_url is not None:
        updates.append('thumbnail_url = ?')
        params.append(thumbnail_url)

    if youtube_url is not None:
        updates.append('youtube_url = ?')
        params.append(youtube_url)
        
    params.append(job_id)
    
    query = f'UPDATE jobs SET {", ".join(updates)} WHERE id = ?'
    c.execute(query, tuple(params))
    
    conn.commit()
    conn.close()

    # --- Redisへ通知 ---
    try:
        channel = f"job_updates:{job_id}"
        # フロントエンドが必要とするデータ + 更新差分
        notification_data = {
            "id": job_id,
            "status": status,
            "result_path": result_path,
            "thumbnail_url": thumbnail_url,
            "candidates": candidates,
            "video_path": video_path,
            "title": title,
            "youtube_url": youtube_url
        }
        # Noneのフィールドを除外して軽量化
        notification_data = {k: v for k, v in notification_data.items() if v is not None}
        
        redis_sync.publish(channel, json.dumps(notification_data))
    except Exception as e:
        print(f"Failed to publish update to Redis: {e}")

def get_job(job_id: str):
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('SELECT * FROM jobs WHERE id = ?', (job_id,))
    job = c.fetchone()
    conn.close()
    
    if job:
        # Convert row to dict and parse JSON fields
        job_dict = dict(job)
        if job_dict.get('candidates'):
            try:
                job_dict['candidates'] = json.loads(job_dict['candidates'])
            except Exception:
                job_dict['candidates'] = []
        if job_dict.get('transcript'):
            try:
                job_dict['transcript'] = json.loads(job_dict['transcript'])
            except Exception:
                job_dict['transcript'] = []
        return job_dict
        
    return None