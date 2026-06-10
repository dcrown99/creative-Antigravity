import os
import warnings
import subprocess
from faster_whisper import WhisperModel
import imageio_ffmpeg
import torch
import json

# Global caches
_whisper_cache = {}
_diarization_pipeline = None

# Optimize PyTorch for Ampere+ GPUs
if torch.cuda.is_available():
    torch.backends.cuda.matmul.allow_tf32 = True
    torch.backends.cudnn.allow_tf32 = True

# Suppress specific warnings

warnings.filterwarnings("ignore", message=".*TensorFloat-32.*")
warnings.filterwarnings("ignore", message=".*std\(\): degrees of freedom is <= 0.*")

def _extract_audio(video_path: str, output_path: str) -> None:
    """Extract audio from a video file using ffmpeg.
    The output is a mono 16kHz WAV file suitable for Whisper.
    """
    ffmpeg_path = imageio_ffmpeg.get_ffmpeg_exe()
    # Build ffmpeg command
    cmd = [ffmpeg_path, '-y', '-i', video_path, '-vn', '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1', output_path]
    try:
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"ffmpeg failed to extract audio: {e}")

def get_cached_pipeline(hf_token: str):
    """Get or load the diarization pipeline (Singleton).
    
    Returns None if pyannote.audio is not available (graceful degradation).
    """
    global _diarization_pipeline
    if _diarization_pipeline is not None:
        return _diarization_pipeline

    print("Loading pyannote.audio pipeline (Cold Start)...")
    try:
        from pyannote.audio import Pipeline
        from pyannote.audio.core.task import Specifications, Problem, Resolution
    except ImportError as e:
        print(f"Warning: pyannote.audio not available. Diarization disabled. ({e})")
        return None
    
    # Use use_auth_token directly as token argument is not supported in this version
    try:
        with torch.serialization.safe_globals([torch.torch_version.TorchVersion, Specifications, Problem, Resolution]):
            pipeline = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1", token=hf_token)
    except AttributeError:
        # Fallback for older torch versions or if safe_globals is not available/needed in the same way
        pipeline = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1", token=hf_token)
    
    if torch.cuda.is_available():
        pipeline.to(torch.device("cuda"))
    
    _diarization_pipeline = pipeline
    return _diarization_pipeline

def get_diarization(audio_path: str):
    """Perform speaker diarization using cached pipeline."""
    hf_token = os.environ.get("HF_TOKEN")
    if not hf_token:
        print("Warning: HF_TOKEN not found. Skipping speaker diarization.")
        return None

    try:
        pipeline = get_cached_pipeline(hf_token)
        print("Running diarization...")
        diarization = pipeline(audio_path)
        return diarization
    except Exception as e:
        print(f"Diarization failed: {e}")
        return None

def get_cached_whisper_model(model_size: str, device: str, compute_type: str):
    """Get or load the Whisper model (Cached)."""
    key = f"{model_size}_{device}_{compute_type}"
    if key not in _whisper_cache:
        print(f"Loading Whisper model: {model_size} (Cold Start)...")
        _whisper_cache[key] = WhisperModel(model_size, device=device, compute_type=compute_type)
    return _whisper_cache[key]

def transcribe_audio(video_path: str, model_size: str = "base"):
    """Transcribe audio using cached faster-whisper model."""
    # Check cache file
    cache_path = video_path + ".json"
    if os.path.exists(cache_path):
        print(f"Loading transcription from cache: {cache_path}")
        try:
            with open(cache_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"Failed to load cache: {e}")

    # Determine device
    device = "cuda" if torch.cuda.is_available() else "cpu"
    compute_type = "float16" if device == "cuda" else "int8"
    
    # Use cached model
    model = get_cached_whisper_model(model_size, device, compute_type)

    # Prepare audio
    temp_dir = os.path.dirname(video_path)
    audio_path = os.path.join(temp_dir, f"temp_audio_{os.path.basename(video_path)}.wav")
    _extract_audio(video_path, audio_path)

    # 1. Transcribe
    print(f"Transcribing audio from {audio_path}...")
    # faster-whisper returns a generator
    segments_generator, info = model.transcribe(audio_path, beam_size=5, word_timestamps=True, language="ja")
    
    whisper_segments = []
    for segment in segments_generator:
        whisper_segments.append({
            "start": segment.start,
            "end": segment.end,
            "text": segment.text.strip(),
            "words": [{"start": w.start, "end": w.end, "word": w.word} for w in segment.words] if segment.words else []
        })
        
    # 2. Diarize
    diarization = get_diarization(audio_path)
    
    # 3. Align Speaker to Segments
    final_segments = []
    for seg in whisper_segments:
        speaker = "SPEAKER_UNKNOWN"
        if diarization:
            # Find speaker who speaks the most during this segment
            speakers_in_segment = {}
            # Iterate over diarization segments that intersect with this whisper segment
            # Handle different return types from pyannote.audio
            diarization_obj = diarization
            
            # If it's a DiarizeOutput (or similar wrapper), try to get the annotation
            if hasattr(diarization, 'speaker_diarization'):
                diarization_obj = diarization.speaker_diarization
            elif hasattr(diarization, 'annotation'):
                diarization_obj = diarization.annotation
            
            # Check if it has itertracks (standard Annotation)
            if hasattr(diarization_obj, 'itertracks'):
                tracks_iter = diarization_obj.itertracks(yield_label=True)
            # Check if it's iterable directly (some versions/wrappers)
            elif hasattr(diarization_obj, '__iter__'):
                tracks_iter = diarization_obj
            else:
                print(f"Warning: Unknown diarization object type: {type(diarization)}")
                # print(f"Available attributes: {dir(diarization)}")
                tracks_iter = []

            for turn, _, spk in tracks_iter:
                intersection_start = max(seg["start"], turn.start)
                intersection_end = min(seg["end"], turn.end)
                duration = max(0, intersection_end - intersection_start)
                
                if duration > 0:
                    speakers_in_segment[spk] = speakers_in_segment.get(spk, 0) + duration
            
            if speakers_in_segment:
                speaker = max(speakers_in_segment, key=speakers_in_segment.get)

        seg["speaker"] = speaker
        final_segments.append(seg)

    # Clean up
    try:
        os.remove(audio_path)
    except OSError:
        pass
        
    # Save cache
    try:
        with open(cache_path, 'w', encoding='utf-8') as f:
            json.dump(final_segments, f, ensure_ascii=False, indent=2)
        print(f"Saved transcription cache to: {cache_path}")
    except Exception as e:
        print(f"Failed to save cache: {e}")

    print(f"Transcription complete. Found {len(final_segments)} segments.")
    return final_segments
