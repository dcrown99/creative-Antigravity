import os
import logging
import polars as pl
from datetime import datetime
from typing import List, Dict, Any
import asyncio

logger = logging.getLogger("recorder")

class DataRecorder:
    """
    市場データをバッファリングし、1分ごとにParquetファイルへダンプする。
    """
    def __init__(self, data_dir: str = "/app/data/raw"):
        self.data_dir = data_dir
        self.buffer: List[Dict[str, Any]] = []
        self.lock = asyncio.Lock()
        os.makedirs(data_dir, exist_ok=True)

    async def add(self, record: Dict[str, Any]):
        async with self.lock:
            # タイムスタンプをISO形式へ変換などの前処理
            if 'ts' in record and isinstance(record['ts'], int):
                # ミリ秒想定
                record['datetime'] = datetime.fromtimestamp(record['ts'] / 1000)
            
            self.buffer.append(record)

    async def flush(self):
        """バッファをディスクに書き出す"""
        async with self.lock:
            if not self.buffer:
                return

            try:
                # Polars DataFrame作成
                df = pl.DataFrame(self.buffer)
                
                # ファイル名生成 (例: 2025-12-05_1200.parquet)
                now = datetime.now()
                filename = f"{now.strftime('%Y%m%d_%H%M%S')}.parquet"
                filepath = os.path.join(self.data_dir, filename)
                
                # Parquet保存 (圧縮あり)
                df.write_parquet(filepath, compression="snappy")
                
                logger.info(f"💾 Flushed {len(self.buffer)} records to {filename}")
                self.buffer.clear()
                
            except Exception as e:
                logger.error(f"❌ Failed to flush data: {e}")
