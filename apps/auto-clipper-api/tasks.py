import os
from celery_app import celery_app
from database import update_job_status, get_job
from config import TEMP_DIR
from utils.downloader import download_video, sanitize_filename
from utils.transcriber import transcribe_audio
from utils.analyzer import analyze_audio
from utils.video_engine import VideoEngine
from utils.llm_analyzer import generate_digest_script, analyze_transcript_semantics
from utils.digest_maker import create_digest_video
from utils.file_utils import save_to_storage
from utils.thumbnail_generator import generate_thumbnail
from utils.smart_cropper import extract_best_frame
from utils.tts_service import tts_service
# Phase 4
from utils.metadata_generator import generate_video_metadata
from utils.youtube_client import YouTubeClient

ASSETS_BGM_DIR = os.path.join(os.path.dirname(__file__), "assets", "bgm")

@celery_app.task(name="tasks.process_video")
def process_video_task(job_id: str, url: str):
    try:
        print(f"Starting job {job_id} for {url}")
        update_job_status(job_id, "downloading")
        video_path, video_title = download_video(url, job_id)
        update_job_status(job_id, "downloading", video_path=video_path, title=video_title)
        
        update_job_status(job_id, "transcribing")
        segments = transcribe_audio(video_path)
        
        update_job_status(job_id, "analyzing")
        candidates = []
        if segments:
            try:
                llm_results = analyze_transcript_semantics(segments)
                if llm_results:
                    for item in llm_results:
                        candidates.append(item)
            except Exception as e:
                print(f"LLM error: {e}")
        
        if not candidates:
            start, end = analyze_audio(video_path, transcript=segments)
            candidates = [{"start": start, "end": end, "reason": "Audio Analysis"}]
        
        update_job_status(job_id, "waiting_for_selection", candidates=candidates, transcript=segments)
    except Exception as e:
        print(f"Job {job_id} failed: {e}")
        update_job_status(job_id, "failed")

@celery_app.task(name="tasks.render_video")
def render_video_task(job_id: str, start: float, end: float, vertical_mode: bool, subtitles: bool, 
                      subtitle_position: str = "bottom", use_narration: bool = False, use_thumbnail: bool = False, 
                      narration_script: str = None, thumbnail_title: str = None, bgm_file: str = None,
                      upload_to_youtube: bool = False, youtube_privacy: str = "private"):
    try:
        job = get_job(job_id)
        if not job:
            return
        video_path = job.get('video_path')
        if not video_path or not os.path.exists(video_path):
            update_job_status(job_id, "failed")
            return
        
        update_job_status(job_id, "editing")
        output_filename = f"{job_id}_clip.mp4"
        output_path = os.path.join(TEMP_DIR, output_filename)
        
        narration_audio_path = None
        if use_narration and narration_script:
            narration_path = os.path.join(TEMP_DIR, f"{job_id}_narration.wav")
            narration_audio_path = tts_service.generate_audio(narration_script, output_path=narration_path)
        
        bgm_path = None
        if bgm_file:
            bgm_path = os.path.join(ASSETS_BGM_DIR, os.path.basename(bgm_file))
        
        try:
            full_transcript = job.get('transcript', [])
            engine = VideoEngine(video_path, vertical_mode=vertical_mode)
            engine.add_segment(start, end, transcript=full_transcript if subtitles else None,
                               narration_path=narration_audio_path, subtitle_position=subtitle_position)
            success = engine.render(output_path, bgm_path=bgm_path, bgm_volume=0.1)
        except Exception as e:
            print(f"VideoEngine failed: {e}")
            success = False
        
        thumbnail_path_local = None
        thumbnail_url = None
        if success:
            if use_thumbnail and thumbnail_title:
                try:
                    best_frame = extract_best_frame(video_path, start, end)
                    if best_frame is not None:
                        thumb_path = os.path.join(TEMP_DIR, f"{job_id}_thumb.jpg")
                        if generate_thumbnail(best_frame, thumbnail_title, thumb_path):
                            thumbnail_url = f"/temp/{job_id}_thumb.jpg"
                            thumbnail_path_local = thumb_path
                            save_to_storage(thumb_path, f"{sanitize_filename(job.get('title', 'video'))}_thumb_{job_id[:8]}.jpg")
                except Exception as e:
                    print(f"Thumbnail error: {e}")

            save_to_storage(output_path, f"{sanitize_filename(job.get('title', 'video'))}_clip_{job_id[:8]}.mp4")
            
            youtube_url = None
            if upload_to_youtube:
                update_job_status(job_id, "uploading")
                try:
                    clip_transcript = [t for t in full_transcript if t['end'] > start and t['start'] < end]
                    metadata = generate_video_metadata(clip_transcript, is_short=vertical_mode)
                    yt = YouTubeClient()
                    res = yt.upload_video(output_path, title=metadata['title'], description=metadata['description'],
                                          tags=metadata['tags'], category_id=metadata['categoryId'], 
                                          privacy_status=youtube_privacy, thumbnail_path=thumbnail_path_local)
                    if res.get("success"):
                        youtube_url = res.get("url")
                except Exception as e:
                    print(f"Upload failed: {e}")

            update_job_status(job_id, "completed", f"/temp/{output_filename}", thumbnail_url=thumbnail_url, youtube_url=youtube_url)
        else:
            update_job_status(job_id, "failed")
    except Exception as e:
        print(f"Render task failed: {e}")
        update_job_status(job_id, "failed")

@celery_app.task(name="tasks.create_digest")
def create_digest_task(job_id: str, duration_minutes: int, model_name: str, bgm_file: str = None,
                       upload_to_youtube: bool = False, youtube_privacy: str = "private"):
    try:
        job = get_job(job_id)
        if not job:
            return
        video_path = job.get('video_path')
        if not video_path or not os.path.exists(video_path):
            update_job_status(job_id, "failed")
            return

        update_job_status(job_id, "planning_digest")
        transcript = job.get('transcript', [])
        if not transcript:
            update_job_status(job_id, "failed")
            return

        script = generate_digest_script(transcript, duration_minutes, model_name)
        if not script:
            update_job_status(job_id, "failed")
            return

        update_job_status(job_id, "editing_digest")
        output_filename = f"{job_id}_digest.mp4"
        output_path = os.path.join(TEMP_DIR, output_filename)
        bgm_path = None
        if bgm_file:
            bgm_path = os.path.join(ASSETS_BGM_DIR, os.path.basename(bgm_file))

        success = create_digest_video(video_path, script, output_path, transcript=transcript, bgm_path=bgm_path)

        if success:
            save_to_storage(output_path, f"{sanitize_filename(job.get('title', 'video'))}_digest_{job_id[:8]}.mp4")
            
            youtube_url = None
            if upload_to_youtube:
                update_job_status(job_id, "uploading")
                try:
                    # 1. Generate Metadata
                    metadata = generate_video_metadata(transcript, is_short=False)
                    
                    # 2. Generate Thumbnail for Digest (Updated Feature)
                    thumbnail_path_local = None
                    try:
                        best_frame = extract_best_frame(video_path, float(script[0]['start']), float(script[0]['end']))
                        if best_frame is not None:
                            thumb_path = os.path.join(TEMP_DIR, f"{job_id}_digest_thumb.jpg")
                            # Use main title + "Highlights"
                            thumb_title = "HIGHLIGHTS" 
                            if generate_thumbnail(best_frame, thumb_title, thumb_path):
                                thumbnail_path_local = thumb_path
                    except Exception as e:
                        print(f"Digest thumbnail error: {e}")

                    # 3. Upload
                    yt = YouTubeClient()
                    res = yt.upload_video(output_path, title=metadata['title'], description=metadata['description'],
                                          tags=metadata['tags'], category_id=metadata['categoryId'], 
                                          privacy_status=youtube_privacy, thumbnail_path=thumbnail_path_local)
                    if res.get("success"):
                        youtube_url = res.get("url")
                except Exception as e:
                    print(f"Digest Upload failed: {e}")

            candidates = [{"start": s['start'], "end": s['end'], "reason": s.get('summary')} for s in script]
            update_job_status(job_id, "completed", f"/temp/{output_filename}", candidates=candidates, youtube_url=youtube_url)
        else:
            update_job_status(job_id, "failed")
    except Exception as e:
        print(f"Digest task failed: {e}")
        update_job_status(job_id, "failed")
