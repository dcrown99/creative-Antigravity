from database import update_job_status
from unittest.mock import patch
import pytest


def test_root_endpoint(client):
    """Test root endpoint returns OK status"""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "Auto-Clipper Backend" in data["message"]


def test_process_video_endpoint(client, mock_celery_task, sample_job_data):
    """Test POST /process creates a new job and triggers Celery task"""
    response = client.post("/process", json=sample_job_data)
    
    assert response.status_code == 200
    data = response.json()
    
    # Verify response structure
    assert "id" in data
    assert data["status"] == "pending"
    assert data["url"] == sample_job_data["url"]
    
    # Verify Celery task was called
    mock_celery_task['process'].assert_called_once()
    args = mock_celery_task['process'].call_args[0]
    assert args[0] == data["id"]  # job_id
    assert args[1] == sample_job_data["url"]  # url


def test_get_job_status_existing(client, mock_celery_task, sample_job_data):
    """Test GET /status/{job_id} returns job status"""
    # Create a job first
    create_response = client.post("/process", json=sample_job_data)
    job_id = create_response.json()["id"]
    
    # Get job status
    response = client.get(f"/status/{job_id}")
    
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == job_id
    assert data["status"] == "pending"
    assert data["url"] == sample_job_data["url"]


def test_get_job_status_not_found(client):
    """Test GET /status/{job_id} with non-existent job"""
    response = client.get("/status/non-existent-job-id")
    
    assert response.status_code == 404
    data = response.json()
    assert "Job not found" in data["detail"]


def test_render_video_endpoint(client, mock_celery_task, sample_job_data, sample_render_request):
    """Test POST /render/{job_id} triggers render task"""
    # Create a job first
    create_response = client.post("/process", json=sample_job_data)
    job_id = create_response.json()["id"]
    
    # Update job status to completed (so it can be rendered)
    update_job_status(job_id, "completed", result_path="/fake/path.json")
    
    # Trigger render
    response = client.post(f"/render/{job_id}", json=sample_render_request)
    
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == job_id
    assert data["status"] == "editing"
    
    # Verify Celery task was called
    mock_celery_task['render'].assert_called_once()


def test_render_video_job_not_found(client, sample_render_request):
    """Test POST /render/{job_id} with non-existent job"""
    response = client.post("/render/non-existent-job", json=sample_render_request)
    
    assert response.status_code == 404
    assert "Job not found" in response.json()["detail"]


def test_create_digest_endpoint(client, mock_celery_task, sample_job_data):
    """Test POST /digest/{job_id} creates digest"""
    # Create a job first
    create_response = client.post("/process", json=sample_job_data)
    job_id = create_response.json()["id"]
    
    # Update job with transcript
    update_job_status(job_id, "completed", transcript="Sample transcript")
    
    digest_request = {
        "duration_minutes": 5,
        "model_name": "gemini-2.0-flash-exp",
        "bgm_file": None,
        "upload_to_youtube": False,
        "youtube_privacy": "private"
    }
    
    response = client.post(f"/digest/{job_id}", json=digest_request)
    
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == job_id
    assert data["status"] == "planning_digest"
    
    # Verify Celery task was called
    mock_celery_task['digest'].assert_called_once()


def test_create_digest_no_transcript(client, sample_job_data):
    """Test POST /digest/{job_id} fails without transcript"""
    # Create a job without transcript
    create_response = client.post("/process", json=sample_job_data)
    job_id = create_response.json()["id"]
    
    digest_request = {
        "duration_minutes": 5,
        "model_name": "gemini-2.0-flash-exp"
    }
    
    response = client.post(f"/digest/{job_id}", json=digest_request)
    
    assert response.status_code == 400
    assert "Analysis not complete" in response.json()["detail"]


def test_get_bgm_list(client):
    """Test GET /assets/bgm returns BGM file list"""
    response = client.get("/assets/bgm")
    
    assert response.status_code == 200
    data = response.json()
    assert "files" in data
    assert isinstance(data["files"], list)


@pytest.mark.skip(reason="Hangs in CI environment due to StreamingResponse")
def test_stream_job_status(client, mock_celery_task, sample_job_data):
    """Test GET /events/{job_id} returns SSE stream"""
    # Create a job first
    create_response = client.post("/process", json=sample_job_data)
    job_id = create_response.json()["id"]
    
    async def mock_async_gen():
        yield '{"status": "processing"}'

    with patch('main.subscribe_job_updates') as mock_subscribe:
        mock_subscribe.return_value = mock_async_gen()
        response = client.get(f"/events/{job_id}")
    
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/event-stream; charset=utf-8"


def test_get_video_url():
    from main import get_video_url
    with patch('main.TEMP_DIR', '/app/temp'):
        # Inside temp dir
        assert get_video_url('/app/temp/video.mp4') == '/temp/video.mp4'
        # Outside temp dir
        assert get_video_url('/other/video.mp4') == '/other/video.mp4'
        # None
        assert get_video_url(None) is None


def test_get_thumbnail(client):
    with patch('os.path.exists') as mock_exists:
        mock_exists.return_value = True
        response = client.get("/thumbnails/test.jpg")
        assert response.status_code == 200


def test_get_thumbnail_not_found(client):
    with patch('os.path.exists') as mock_exists:
        mock_exists.return_value = False
        response = client.get("/thumbnails/missing.jpg")
        assert response.status_code == 404

