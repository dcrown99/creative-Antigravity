import sys
import os
import logging

# プロジェクトルート (/app) をパスに追加
sys.path.append("/app")

from src.ai.trainer import ModelTrainer

# ログ設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)

def main():
    """
    LightGBMモデルの学習を実行するエントリーポイント。
    run_backfill.py で生成された data/raw/*.parquet を使用する。
    """
    try:
        logging.info("🚀 Starting Model Training Sequence...")
        
        # トレーナーの初期化
        trainer = ModelTrainer(
            data_dir="/app/data/raw",
            model_dir="/app/models"
        )
        
        # 学習実行 & モデル保存
        model = trainer.train()
        
        logging.info("🎉 Training Completed Successfully.")
        
    except Exception as e:
        logging.error(f"💥 Training Failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
