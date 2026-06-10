import traceback
from typing import List, Dict
from .video_engine import VideoEngine

def create_digest_video(video_path: str, script: List[Dict], output_path: str, 
                        vertical_mode: bool = True, transcript: List[Dict] = None,
                        subtitle_position: str = 'bottom',
                        bgm_path: str = None): # Added BGM path
    """
    VideoEngineを使用した新世代の総集編生成 (BGM対応)
    """
    try:
        print(f"🎬 Digest Engine 2.0 Starting: {video_path}")
        
        engine = VideoEngine(video_path, vertical_mode=vertical_mode)
        
        for segment in script:
            start = float(segment['start'])
            end = float(segment['end'])
            summary = segment.get('summary', '')
            
            engine.add_segment(
                start, 
                end, 
                transcript=transcript, 
                overlay_text=summary,
                subtitle_position=subtitle_position
            )
            
        # Render with BGM
        success = engine.render(output_path, bgm_path=bgm_path, bgm_volume=0.1)
        return success

    except Exception as e:
        print(f"Digest generation failed: {e}")
        traceback.print_exc()
        return False
