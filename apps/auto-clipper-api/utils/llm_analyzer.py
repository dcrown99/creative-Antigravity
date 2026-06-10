import os
import json
import google.generativeai as genai
from typing import List, Dict, Any

def analyze_transcript_semantics(transcript: List[Dict], model_name: str = "gemini-2.5-flash") -> List[Dict[str, Any]]:
    """
    Analyzes the transcript using an LLM to find the most engaging/funny segments.

    Args:
        transcript: List of segments, e.g., [{"start": 0.0, "end": 2.0, "text": "Hello"}, ...]
        model_name: The Gemini model to use.

    Returns:
        List of tuples: (start_time, end_time, reason)
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("Warning: GEMINI_API_KEY not found. Skipping semantic analysis.")
        return []

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(model_name)

    # Format transcript for the LLM
    formatted_transcript = ""
    for seg in transcript:
        formatted_transcript += f"[{seg['start']:.2f} - {seg['end']:.2f}] {seg['text']}\n"

    prompt = f"""
    あなたはYouTubeチャンネルのプロの動画編集者です。
    以下の文字起こしから、最も魅力的で面白く、バズりそうな瞬間を3つ特定してください。
    
    選択基準:
    1. 高いエネルギーや強い感情反応（笑い、驚き、怒りなど）
    2. 完結したジョークやオチ
    3. 興味深い事実や「なるほど」と思える瞬間
    4. セグメントは15秒から60秒の長さであること
    
    文字起こし:
    {formatted_transcript}
    
    出力形式:
    JSONの配列で各オブジェクトに以下を含めてください:
    - "start": float（開始時間・秒）
    - "end": float（終了時間・秒）
    - "reason": string（このクリップが良い理由を**日本語で**簡潔に説明）
    - "narration_script": string（このクリップに対する視聴者を引き込むためのAIナレーション台本。**セグメントの尺（秒数）を完全に使い切るように、十分に長い文章にしてください。動画の終了と同時に読み終わるのが理想です**。**日本語**。例：「まさかの展開にスタジオ騒然！...（中略）...これは笑うしかないｗ」）
    - "thumbnail_title": string（YouTubeサムネイル用のキャッチーなタイトル。10文字以内の**日本語**。例：「衝撃の結末」「放送事故！？」）
    
    JSON例:
    [
        {{
            "start": 12.5, 
            "end": 45.0, 
            "reason": "ホストが面白いミスをする",
            "narration_script": "見てくださいこの表情！まさかこんなミスをするなんて信じられませんねｗ",
            "thumbnail_title": "まさかのミスｗ"
        }}
    ]
    
    **必ずJSONのみを返してください。**
    """

    try:
        response = model.generate_content(prompt)
        text_response = response.text.strip()
        
        # Use regex to find the JSON array
        import re
        match = re.search(r'\[.*\]', text_response, re.DOTALL)
        if match:
            json_str = match.group(0)
            results = json.loads(json_str)
        else:
            # Fallback to direct load if no array found (might be single object or raw)
            results = json.loads(text_response)
        
        parsed_results = []
        for item in results:
            parsed_results.append({
                "start": float(item['start']), 
                "end": float(item['end']), 
                "reason": item['reason'],
                "narration_script": item.get('narration_script', ""),
                "thumbnail_title": item.get('thumbnail_title', "")
            })
            
        return parsed_results

    except Exception as e:
        print(f"Error during LLM analysis: {e}")
        return []


def generate_digest_script(
    transcript: List[Dict], 
    target_duration_minutes: int = 10, 
    model_name: str = "gemini-2.5-flash"
) -> List[Dict[str, Any]]:
    """
    Gemini 2.5 Flashを使用して、総集編動画の構成案（スクリプト）を生成します。
    
    Args:
        transcript: 文字起こしデータのリスト [{"start": 0.0, "end": 2.0, "text": "..."}, ...]
        target_duration_minutes: 目標総尺（分）
        model_name: 使用するGeminiモデル（デフォルト: gemini-2.5-flash）
    
    Returns:
        構成案のリスト [{"start": 10.5, "end": 45.0, "summary": "...", "score": 85}, ...]
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("Warning: GEMINI_API_KEY not found. Cannot generate digest script.")
        return []

    genai.configure(api_key=api_key)
    
    # JSON出力モードを有効化
    model = genai.GenerativeModel(
        model_name, 
        generation_config={"response_mime_type": "application/json"}
    )

    # 文字起こしをフォーマット
    formatted_transcript = ""
    for seg in transcript:
        formatted_transcript += f"[{seg['start']:.2f}-{seg['end']:.2f}] {seg['text']}\n"

    # 日本語プロンプト
    prompt = f"""
    あなたはプロのTV番組ディレクターです。
    以下の文字起こしから「見どころ総集編」を構成してください。
    
    制約条件:
    1. 合計時間は約 {target_duration_minutes} 分になるようにする
    2. 面白い、洞察的、または高エネルギーなセグメントを選択
    3. つなぎ言葉や無意味な部分は除外
    4. 各セグメントは15秒以上あること
    5. セグメント同士の流れが自然になるよう、時系列順に並べる
    
    文字起こし:
    {formatted_transcript}
    
    出力形式（JSON配列）:
    各オブジェクトに以下のキーを含める:
    - "start": float（開始時間・秒）
    - "end": float（終了時間・秒）
    - "summary": string（このセグメントの簡潔な説明を**日本語で**）
    - "score": int（1-100、このセグメントの面白さスコア）
    
    例:
    [
        {{"start": 10.5, "end": 45.0, "summary": "ホストが面白いミスをする", "score": 90}},
        {{"start": 102.0, "end": 150.5, "summary": "議題について激しい議論", "score": 85}}
    ]
    """

    try:
        print(f"Gemini {model_name} に総集編プランを生成依頼中...")
        response = model.generate_content(prompt)
        plan = json.loads(response.text)
        
        # 時系列順にソート（自然な流れのため）
        plan.sort(key=lambda x: x['start'])
        
        print(f"✅ {len(plan)} 個のセグメントからなる総集編プランを生成しました")
        
        return plan

    except Exception as e:
        print(f"総集編プラン生成中にエラーが発生しました: {e}")
        import traceback
        traceback.print_exc()
        return []
