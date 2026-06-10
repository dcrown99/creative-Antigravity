"""
Weekly Strategy Optimization Scheduler
毎週月曜日 09:00 JST にMomentum戦略パラメータを最適化
"""
import asyncio
import logging
from datetime import datetime
from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger("scheduler")

# タイムゾーン設定
TIMEZONE = "Asia/Tokyo"


class ModelTrainingScheduler:
    """
    定期的な戦略パラメータ最適化スケジューラー
    
    スケジュール:
    - 毎週月曜日 09:00 JST
    - Backfill → Optimize Momentum の順で実行
    
    Note: LightGBM学習は削除され、ルールベース戦略の最適化に置換
    """
    
    def __init__(self):
        self.scheduler: Optional[AsyncIOScheduler] = None
        self._is_running = False
        
    async def start(self):
        """スケジューラー起動"""
        self.scheduler = AsyncIOScheduler(timezone=TIMEZONE)
        
        # 毎週月曜日 09:00 に実行
        self.scheduler.add_job(
            self._run_optimization_pipeline,
            CronTrigger(day_of_week="mon", hour=9, minute=0, timezone=TIMEZONE),
            id="weekly_optimization",
            name="Weekly Momentum Optimization",
            replace_existing=True
        )
        
        self.scheduler.start()
        next_run = self.scheduler.get_job("weekly_optimization").next_run_time
        logger.info(f"📅 Scheduler started. Next optimization: {next_run}")
        
    async def stop(self):
        """スケジューラー停止"""
        if self.scheduler:
            self.scheduler.shutdown(wait=False)
            logger.info("📅 Scheduler stopped")
            
    async def _run_optimization_pipeline(self):
        """最適化パイプライン実行"""
        if self._is_running:
            logger.warning("Optimization already in progress, skipping...")
            return
            
        self._is_running = True
        start_time = datetime.now()
        logger.info("🚀 Starting weekly momentum optimization pipeline...")
        
        try:
            # Step 1: Backfill (過去データ取得)
            logger.info("📥 Step 1/2: Backfilling historical data...")
            await self._run_script("scripts/run_backfill.py")
            
            # Step 2: Optimize Momentum Parameters
            logger.info("🔧 Step 2/2: Optimizing momentum parameters...")
            await self._run_script("scripts/optimize_momentum.py")
            
            elapsed = (datetime.now() - start_time).total_seconds()
            logger.info(f"✅ Optimization pipeline completed in {elapsed:.1f}s")
            
        except Exception as e:
            logger.error(f"❌ Optimization pipeline failed: {e}")
        finally:
            self._is_running = False
            
    async def _run_script(self, script_path: str):
        """Pythonスクリプトを非同期で実行"""
        process = await asyncio.create_subprocess_exec(
            "python", script_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await process.communicate()
        
        if process.returncode != 0:
            error_msg = stderr.decode() if stderr else "Unknown error"
            raise RuntimeError(f"{script_path} failed: {error_msg}")
            
        if stdout:
            logger.info(stdout.decode())
            
    def get_next_run(self) -> Optional[datetime]:
        """次回実行時刻を取得"""
        if self.scheduler:
            job = self.scheduler.get_job("weekly_optimization")
            if job:
                return job.next_run_time
        return None
        
    async def run_now(self):
        """今すぐ手動実行 (テスト用)"""
        logger.info("🔄 Manual optimization triggered")
        await self._run_optimization_pipeline()

