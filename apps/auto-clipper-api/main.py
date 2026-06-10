from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse
import uuid
import os
import json
import glob

from database import init_db, create_job, get_job
from models import JobRequest, JobResponse, RenderRequest, DigestRequest
from config import TEMP_DIR
from utils.event_bus import subscribe_job_updates

from tasks import process_video_task, render_video_task, create_digest_task

app = FastAPI()

@app.on_event("startup")
def on_startup():
    init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if not os.path.exists(TEMP_DIR):
    os.makedirs(TEMP_DIR)
app.mount("/temp", StaticFiles(directory=TEMP_DIR), name="temp")

ASSETS_DIR = os.path.join(os.path.dirname(__file__), "assets")
BGM_DIR = os.path.join(ASSETS_DIR, "bgm")
if not os.path.exists(BGM_DIR):
    os.makedirs(BGM_DIR)

@app.post("/process", response_model=JobResponse)
async def process_video(request: JobRequest):
    job_id = str(uuid.uuid4())
    create_job(job_id, request.url)
    process_video_task.delay(job_id, request.url)
    return JobResponse(id=job_id, status="pending", url=request.url)

@app.post("/render/{job_id}", response_model=JobResponse)
async def render_video(job_id: str, request: RenderRequest):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    render_video_task.delay(
        job_id, 
        request.start, 
        request.end, 
        request.vertical_mode, 
        request.subtitles,
        request.subtitle_position,
        request.use_narration, 
        request.use_thumbnail, 
        request.narration_script, 
        request.thumbnail_title,
        request.bgm_file,
        request.upload_to_youtube,
        request.youtube_privacy
    )
    
    return JobResponse(id=job_id, status="editing", url=job['url'])

@app.post("/digest/{job_id}", response_model=JobResponse)
async def create_digest(job_id: str, request: DigestRequest):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if not job.get('transcript'):
        raise HTTPException(status_code=400, detail="Analysis not complete")

    create_digest_task.delay(
        job_id, 
        request.duration_minutes, 
        request.model_name,
        request.bgm_file,
        request.upload_to_youtube,
        request.youtube_privacy
    )
    return JobResponse(id=job_id, status="planning_digest", url=job['url'])

@app.get("/assets/bgm")
async def get_bgm_list():
    files = glob.glob(os.path.join(BGM_DIR, "*.mp3")) + glob.glob(os.path.join(BGM_DIR, "*.wav"))
    return {"files": [os.path.basename(f) for f in files]}

def get_video_url(vpath: str) -> str:
    if not vpath:
        return None
    abs_temp = os.path.abspath(TEMP_DIR)
    abs_vpath = os.path.abspath(vpath)
    if abs_vpath.startswith(abs_temp):
        rel_path = abs_vpath[len(abs_temp):].replace(os.sep, '/')
        if rel_path.startswith('/'):
            rel_path = rel_path[1:]
        return f"/temp/{rel_path}"
    else:
        if os.path.dirname(vpath) == TEMP_DIR:
            return f"/temp/{os.path.basename(vpath)}"
        return vpath

@app.get("/status/{job_id}", response_model=JobResponse)
async def get_job_status(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return JobResponse(
        id=job['id'],
        status=job['status'],
        url=job['url'],
        result_path=job['result_path'],
        video_path=get_video_url(job.get('video_path')),
        thumbnail_url=job.get('thumbnail_url'),
        candidates=job.get('candidates'),
        youtube_url=job.get('youtube_url')
    )

@app.get("/events/{job_id}")
async def stream_job_status(job_id: str):
    async def event_generator():
        current_job = get_job(job_id)
        if current_job:
            if current_job.get('video_path'):
                current_job['video_path'] = get_video_url(current_job['video_path'])
            yield f"data: {json.dumps(current_job)}\n\n"
            
        async for message in subscribe_job_updates(job_id):
            try:
                data = json.loads(message)
                if data.get('video_path'):
                    data['video_path'] = get_video_url(data['video_path'])
                yield f"data: {json.dumps(data)}\n\n"
            except Exception:
                yield f"data: {message}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.get("/thumbnails/{filename}")
async def get_thumbnail(filename: str):
    file_path = os.path.join(TEMP_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Thumbnail not found")
    from fastapi.responses import FileResponse
    return FileResponse(file_path)

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Auto-Clipper Backend (Phase 4 Ready)"}
