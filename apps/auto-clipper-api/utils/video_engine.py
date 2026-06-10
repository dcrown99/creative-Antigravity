import os
import numpy as np
from moviepy.editor import (
    VideoFileClip, AudioFileClip, TextClip, CompositeVideoClip, 
    CompositeAudioClip, concatenate_videoclips
)
# moviepy 1.0.3 specific imports
from moviepy.audio.fx.all import audio_fadein, audio_fadeout, audio_loop
from moviepy.video.fx.all import fadein, fadeout
from PIL import Image
from typing import List, Dict, Tuple, Union

class VideoSegment:
    def __init__(self, start: float, end: float, transcript: List[Dict] = None, 
                 narration_path: str = None, overlay_text: str = None,
                 subtitle_position: str = 'bottom'):
        self.start = start
        self.end = end
        self.transcript = transcript or []
        self.narration_path = narration_path
        self.overlay_text = overlay_text
        self.subtitle_position = subtitle_position

class VideoEngine:
    """
    VideoEngine v1.3: Added BGM Support (Looping & Mixing)
    """
    def __init__(self, source_path: str, vertical_mode: bool = True):
        self.source_path = source_path
        self.vertical_mode = vertical_mode
        self.target_size = (1080, 1920) if vertical_mode else (1920, 1080)
        self.segments: List[VideoSegment] = []
        self.font_path = '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'

    def add_segment(self, start: float, end: float, subtitle_position: str = 'bottom', **kwargs):
        self.segments.append(VideoSegment(start, end, subtitle_position=subtitle_position, **kwargs))

    def _apply_smart_crop(self, clip: VideoFileClip) -> CompositeVideoClip:
        w, h = self.target_size
        
        # 1. Background (Blurred)
        bg_clip = clip.resize(height=h)
        bg_clip = bg_clip.crop(x1=bg_clip.w/2 - w/2, y1=0, width=w, height=h)
        
        def blur_frame(image):
            img = Image.fromarray(image)
            # Resize optimization
            small = img.resize((int(img.width * 0.05), int(img.height * 0.05)), resample=Image.BILINEAR)
            blurred = small.resize((img.width, img.height), resample=Image.BICUBIC)
            # Darken
            return (np.array(blurred) * 0.7).astype(np.uint8)
            
        bg_clip = bg_clip.fl_image(blur_frame)

        # 2. Foreground (Centered)
        fg_clip = clip.resize(width=w)
        
        return CompositeVideoClip([bg_clip, fg_clip.set_position("center")])

    def _get_subtitle_pos_coords(self, position: str) -> Tuple[Union[str, int], Union[str, int]]:
        w, h = self.target_size
        if position == 'top':
            return ('center', int(h * 0.20))
        elif position == 'center':
            return ('center', 'center')
        else: # bottom
            return ('center', int(h * 0.75))

    def _merge_segments(self, segments: List[Dict], max_duration: float = 5.0, max_gap: float = 1.0) -> List[Dict]:
        merged = []
        current_text = ""
        current_start = 0.0
        current_end = 0.0
        
        if not segments:
            return []

        current_start = segments[0]['start']
        current_end = segments[0]['start']
        
        for i, seg in enumerate(segments):
            text = seg.get('text', '').strip()
            start = seg['start']
            end = seg['end']
            
            gap = start - current_end
            if gap > max_gap and current_text:
                merged.append({'text': current_text, 'start': current_start, 'end': current_end})
                current_text = ""
                current_start = start
            
            if not current_text:
                current_start = start
            
            current_text += text
            current_end = end
            
            is_end_of_sentence = any(p in text for p in ['。', '！', '？', '!', '?', '.'])
            duration = current_end - current_start
            
            if is_end_of_sentence or (duration > max_duration and len(current_text) > 10) or i == len(segments) - 1:
                merged.append({'text': current_text, 'start': current_start, 'end': current_end})
                current_text = ""
            
        return merged

    def _create_subtitles(self, transcript: List[Dict], duration: float, position: str = 'bottom') -> List[TextClip]:
        clips = []
        w, h = self.target_size
        fontsize = int(w * 0.055)
        pos_coords = self._get_subtitle_pos_coords(position)
        
        merged_transcript = self._merge_segments(transcript)

        for item in merged_transcript:
            rel_start = max(0, item['start'])
            rel_end = min(duration, item['end'])
            txt_dur = rel_end - rel_start
            
            if txt_dur <= 0.1:
                continue
            
            try:
                txt = (TextClip(
                    item['text'], 
                    font=self.font_path, 
                    fontsize=fontsize, 
                    color='white', 
                    stroke_color='black', 
                    stroke_width=3,
                    method='caption', 
                    size=(int(w * 0.9), None), 
                    align='center'
                )
                .set_position(pos_coords)
                .set_start(rel_start)
                .set_duration(txt_dur))
                
                clips.append(txt)
            except Exception as e:
                print(f"Subtitle error: {e}")
                
        return clips

    def render(self, output_path: str, bgm_path: str = None, bgm_volume: float = 0.1):
        if not self.segments:
            raise ValueError("No segments to render")

        source_video = VideoFileClip(self.source_path)
        processed_clips = []

        print(f"Rendering {len(self.segments)} segments...")

        for seg in self.segments:
            # 1. Cut
            clip = source_video.subclip(seg.start, seg.end)
            
            # 2. Layout
            if self.vertical_mode:
                clip = self._apply_smart_crop(clip)
            else:
                clip = clip.resize(width=self.target_size[0])

            layers = [clip]

            # 3. Subtitles
            if seg.transcript:
                segment_transcript = []
                for t in seg.transcript:
                    if t['end'] > seg.start and t['start'] < seg.end:
                        segment_transcript.append({
                            'text': t['text'],
                            'start': t['start'] - seg.start,
                            'end': t['end'] - seg.start
                        })
                
                subs = self._create_subtitles(segment_transcript, clip.duration, position=seg.subtitle_position)
                layers.extend(subs)

            # 4. Overlay Text
            if seg.overlay_text:
                txt = (TextClip(seg.overlay_text, font=self.font_path, fontsize=40, color='white', bg_color='black')
                       .set_position(('left', 'top'))
                       .set_duration(3.0)
                       .set_opacity(0.8))
                layers.append(txt)

            # 5. Narration
            if seg.narration_path and os.path.exists(seg.narration_path):
                narration = AudioFileClip(seg.narration_path)
                original_audio = clip.audio.volumex(0.2) if clip.audio else None
                if original_audio:
                    final_audio = CompositeAudioClip([original_audio, narration])
                    clip = clip.set_audio(final_audio)
                    layers[0] = clip

            # 6. Composite Segment
            comp_clip = CompositeVideoClip(layers).set_duration(clip.duration)
            comp_clip = comp_clip.fx(fadein, 0.5).fx(fadeout, 0.5)
            if comp_clip.audio:
                comp_clip.audio = comp_clip.audio.fx(audio_fadein, 0.5).fx(audio_fadeout, 0.5)
            
            processed_clips.append(comp_clip)

        # Concatenate Segments
        final_video = concatenate_videoclips(processed_clips, method="compose")
        
        # 7. Add BGM (Looping)
        if bgm_path and os.path.exists(bgm_path):
            print(f"Adding BGM: {bgm_path}")
            try:
                bgm = AudioFileClip(bgm_path)
                # Loop BGM to fit video duration
                # Use fx function for safety in MoviePy 1.0.3
                if final_video.duration > bgm.duration:
                     bgm = audio_loop(bgm, duration=final_video.duration)
                else:
                    bgm = bgm.subclip(0, final_video.duration)
                
                bgm = bgm.volumex(bgm_volume)
                
                if final_video.audio:
                    final_audio = CompositeAudioClip([final_video.audio, bgm])
                else:
                    final_audio = bgm
                
                final_video = final_video.set_audio(final_audio)
            except Exception as e:
                print(f"Failed to add BGM: {e}")

        # Write Output
        final_video.write_videofile(
            output_path,
            codec='libx264',
            audio_codec='aac',
            fps=30,
            preset='medium',
            threads=4,
            remove_temp=True,
            logger=None
        )
        
        source_video.close()
        for c in processed_clips:
            c.close()
            
        return True
