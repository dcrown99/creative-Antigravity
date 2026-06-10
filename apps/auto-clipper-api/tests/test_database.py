from unittest.mock import patch
import json
from database import create_job, get_job, update_job_status, get_db_connection

def test_create_and_get_job():
    job_id = "test-job-1"
    url = "http://example.com/video"
    
    create_job(job_id, url)
    
    job = get_job(job_id)
    assert job is not None
    assert job['id'] == job_id
    assert job['url'] == url
    assert job['status'] == 'pending'

def test_update_job_status():
    job_id = "test-job-2"
    url = "http://example.com/video"
    create_job(job_id, url)
    
    # Update status
    update_job_status(job_id, "processing")
    job = get_job(job_id)
    assert job['status'] == "processing"
    
    # Update with result
    update_job_status(job_id, "completed", result_path="/tmp/res.mp4")
    job = get_job(job_id)
    assert job['status'] == "completed"
    assert job['result_path'] == "/tmp/res.mp4"

def test_update_job_complex_fields():
    job_id = "test-job-3"
    create_job(job_id, "http://example.com")
    
    candidates = [{"start": 0, "end": 10}]
    transcript = [{"text": "hello", "start": 0, "end": 1}]
    
    update_job_status(job_id, "analyzing", candidates=candidates, transcript=transcript)
    
    job = get_job(job_id)
    assert job['candidates'] == candidates
    assert job['transcript'] == transcript

def test_redis_notification():
    job_id = "test-job-redis"
    create_job(job_id, "http://example.com")
    
    with patch('database.redis_sync') as mock_redis:
        update_job_status(job_id, "processing")
        
        mock_redis.publish.assert_called_once()
        args = mock_redis.publish.call_args[0]
        assert args[0] == f"job_updates:{job_id}"
        data = json.loads(args[1])
        assert data['status'] == "processing"
        assert data['id'] == job_id

def test_get_non_existent_job():
    job = get_job("non-existent")
    assert job is None

def test_json_parsing_error_handling():
    job_id = "test-job-json"
    create_job(job_id, "http://example.com")
    
    # Manually insert invalid JSON
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('UPDATE jobs SET candidates = ? WHERE id = ?', ('invalid-json', job_id))
    conn.commit()
    conn.close()
    
    job = get_job(job_id)
    assert job['candidates'] == []  # Should fallback to empty list
