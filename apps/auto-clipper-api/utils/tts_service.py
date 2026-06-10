import requests
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

VOICEVOX_URL = os.getenv("VOICEVOX_URL", "http://voicevox:50021")

class TTSService:
    def __init__(self, base_url=VOICEVOX_URL):
        self.base_url = base_url

    def check_health(self, timeout=2):
        """Check if VOICEVOX service is reachable."""
        try:
            response = requests.get(f"{self.base_url}/version", timeout=timeout)
            if response.status_code == 200:
                return True
        except requests.exceptions.RequestException:
            pass
        return False

    def generate_audio(self, text: str, speaker_id: int = 3, output_path: str = "temp/narration.wav") -> str | None:
        """
        Generate audio using VOICEVOX with optimized settings for Short videos.
        """
        if not self.check_health():
            logger.warning("VOICEVOX is not available. Skipping narration.")
            return None

        try:
            # Step 1: Create Audio Query
            query_payload = {"text": text, "speaker": speaker_id}
            query_response = requests.post(
                f"{self.base_url}/audio_query",
                params=query_payload,
                timeout=10
            )
            query_response.raise_for_status()
            query_data = query_response.json()

            # --- Pro-Tip: Enhance Engagement ---
            # ショート動画向けにテンポと抑揚を強化
            query_data['speedScale'] = 1.25      # 1.25倍速でテンポよく
            query_data['intonationScale'] = 1.3  # 抑揚を強めて退屈させない
            query_data['pitchScale'] = 0.05      # ほんの少しピッチを上げて明るく
            # -----------------------------------

            # Step 2: Synthesize Audio
            synthesis_response = requests.post(
                f"{self.base_url}/synthesis",
                params={"speaker": speaker_id},
                json=query_data,
                timeout=30
            )
            synthesis_response.raise_for_status()

            # Save to file
            dirname = os.path.dirname(output_path)
            if dirname:
                os.makedirs(dirname, exist_ok=True)
            with open(output_path, "wb") as f:
                f.write(synthesis_response.content)
            
            logger.info(f"Narration generated: {output_path} (Spk:{speaker_id}, Speed:1.25x)")
            return output_path

        except Exception as e:
            logger.error(f"Failed to generate narration: {e}")
            return None

# Global instance
tts_service = TTSService()
