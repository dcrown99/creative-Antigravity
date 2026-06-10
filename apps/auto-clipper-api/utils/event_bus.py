import redis.asyncio as redis
import json
import os

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

async def get_redis_client():
    return redis.from_url(REDIS_URL, encoding="utf-8", decode_responses=True)

async def publish_job_update(job_id: str, data: dict):
    """
    ジョブの更新情報をRedisチャンネルにパブリッシュします。
    """
    client = await get_redis_client()
    try:
        # メッセージをJSON文字列化
        message = json.dumps(data)
        channel = f"job_updates:{job_id}"
        await client.publish(channel, message)
    finally:
        await client.aclose()

async def subscribe_job_updates(job_id: str):
    """
    指定されたジョブIDの更新情報を購読する非同期ジェネレータ。
    """
    client = await get_redis_client()
    pubsub = client.pubsub()
    channel = f"job_updates:{job_id}"
    await pubsub.subscribe(channel)
    
    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                yield message["data"]
    finally:
        await client.aclose()
