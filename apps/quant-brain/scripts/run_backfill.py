import asyncio
import sys
import os

# パスを通す
sys.path.append(os.getcwd())

from src.infrastructure.backfiller import BybitBackfiller

async def main():
    # 過去1年分 (365日) のデータを取得
    bf = BybitBackfiller()
    await bf.fetch_history(days=365)

if __name__ == "__main__":
    if os.name == 'nt':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
