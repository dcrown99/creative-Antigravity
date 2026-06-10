import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from main import app
from database import init_db


import tempfile
import os

@pytest.fixture(autouse=True)
def mock_env_vars():
    """Mock environment variables and database connections"""
    # Create temp DB file
    fd, db_path = tempfile.mkstemp()
    os.close(fd)
    
    with patch('database.DB_NAME', db_path), \
         patch('database.redis_sync'):
        # Setup DB
        init_db()
        yield
        
    # Cleanup
    if os.path.exists(db_path):
        try:
            os.unlink(db_path)
        except PermissionError:
            pass

@pytest.fixture
def client(mock_env_vars):
    """Test client fixture"""
    with TestClient(app) as c:
        yield c

@pytest.fixture
def mock_celery_task():
    """Mock Celery tasks to prevent actual execution"""
    with patch('tasks.process_video_task.delay') as mock_process, \
         patch('tasks.render_video_task.delay') as mock_render, \
         patch('tasks.create_digest_task.delay') as mock_digest:
        yield {
            'process': mock_process,
            'render': mock_render,
            'digest': mock_digest,
        }

@pytest.fixture
def sample_job_data():
    """Sample job data for testing"""
    return {
        "url": "https://www.youtube.com/watch?v=test123"
    }

@pytest.fixture
def sample_render_request():
    """Sample render request data"""
    return {
        "start": 10.0,
        "end": 60.0,
        "vertical_mode": False,
        "subtitles": True,
        "subtitle_position": "bottom",
        "use_narration": False,
        "use_thumbnail": False,
        "narration_script": None,
        "thumbnail_title": None,
        "bgm_file": None,
        "upload_to_youtube": False,
        "youtube_privacy": "private"
    }

