from PIL import Image, ImageDraw, ImageFont, ImageEnhance
import cv2
import numpy as np
import textwrap

def generate_thumbnail(frame: np.ndarray, title: str, output_path: str) -> bool:
    """
    Generates a high-impact YouTuber-style thumbnail.
    """
    try:
        # 1. Convert & Enhance Image
        image = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        
        # 彩度を上げてポップに (Saturation Boost)
        enhancer = ImageEnhance.Color(image)
        image = enhancer.enhance(1.6)
        
        # コントラストを強調 (Contrast Boost)
        enhancer = ImageEnhance.Contrast(image)
        image = enhancer.enhance(1.2)
        
        width, height = image.size
        draw = ImageDraw.Draw(image)
        
        # 2. Font Setup
        # Dockerfileでインストール済みのNotoSansCJK-Boldを優先
        font_paths = [
            "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
            "/usr/share/fonts/noto-cjk/NotoSansCJK-Bold.ttc", 
            "C:\\Windows\\Fonts\\msgothic.ttc", 
        ]
        
        font = None
        # 動画幅の13%程度の巨大文字
        font_size = int(width * 0.13)
        
        for path in font_paths:
            try:
                font = ImageFont.truetype(path, font_size)
                break
            except IOError:
                continue
                
        if font is None:
            font = ImageFont.load_default()

        # 3. Text Layout (Wrap text)
        # 全角10文字程度で折り返し
        lines = textwrap.wrap(title, width=10)
        
        # 行間計算
        ascent, descent = font.getmetrics()
        line_height = ascent + descent + 20
        total_text_height = len(lines) * line_height
        
        # 中央より少し下、または顔を避ける位置に配置
        # ここではシンプルに「中央」から開始
        current_y = (height - total_text_height) / 2

        # 4. Draw Text with Heavy Stroke
        stroke_width = int(font_size * 0.1) # フォントサイズの10%の縁取り
        
        for line in lines:
            # 行ごとの幅を取得
            text_bbox = draw.textbbox((0, 0), line, font=font)
            text_width = text_bbox[2] - text_bbox[0]
            
            x = (width - text_width) / 2
            
            # 縁取り付きで描画 (Pillow 10.0+ recommended way, but fallback compliant)
            draw.text(
                (x, current_y), 
                line, 
                font=font, 
                fill="white", 
                stroke_width=stroke_width, 
                stroke_fill="black"
            )
            
            current_y += line_height
        
        # 5. Save
        image = image.convert('RGB')
        image.save(output_path, quality=95)
        print(f"High-impact thumbnail saved to {output_path}")
        return True
        
    except Exception as e:
        print(f"Error generating thumbnail: {e}")
        import traceback
        traceback.print_exc()
        return False
