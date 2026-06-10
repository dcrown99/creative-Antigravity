import os
import logging
import httpx
from typing import Dict, Any, Optional

logger = logging.getLogger("discord")

class DiscordNotifier:
    """
    Redisイベントを受信し、Discord Webhookに整形して送信するクラス。
    """
    def __init__(self):
        # .env から DISCORD_WEBHOOK_URL を読み込む
        self.webhook_url = os.getenv("DISCORD_WEBHOOK_URL")
        if not self.webhook_url:
            logger.warning("⚠️ DISCORD_WEBHOOK_URL not set. Notifications disabled.")

    async def send_event(self, event_type: str, data: Dict[str, Any]):
        """
        イベントをDiscordに送信する。
        エラーが起きても呼び出し元（メインループ）を止めないよう、例外はここで握りつぶす。
        """
        if not self.webhook_url:
            return

        try:
            payload = self._create_payload(event_type, data)
            if not payload:
                return

            async with httpx.AsyncClient() as client:
                # 3秒でタイムアウト（思考の邪魔をさせない）
                await client.post(self.webhook_url, json=payload, timeout=3.0)
                
        except Exception as e:
            logger.error(f"Failed to send Discord notification: {e}")

    def _create_payload(self, event_type: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """イベントタイプに応じてEmbedメッセージを作成"""
        
        # 1. 約定通知 (Order Filled)
        if event_type == "order_filled":
            side = data.get("side", "UNKNOWN").upper()
            qty = data.get("qty", 0)
            symbol = data.get("symbol", "UNKNOWN")
            data.get("price", "MARKET") # GhostClientの実装次第だが念のため
            balance = data.get("balance", 0)
            
            # Buy=Green, Sell=Red
            color = 0x2ea043 if side == "BUY" else 0xda3633
            
            return {
                "username": "Neural Alpha",
                "avatar_url": "https://cdn-icons-png.flaticon.com/512/4712/4712009.png", # AI Icon
                "embeds": [{
                    "title": f"🚀 ORDER FILLED: {side}",
                    "description": f"**{symbol}**",
                    "color": color,
                    "fields": [
                        {"name": "Amount", "value": f"`{qty}`", "inline": True},
                        {"name": "Balance", "value": f"`${balance:,.2f}`", "inline": True},
                        {"name": "Order ID", "value": f"`{data.get('id', 'N/A')}`", "inline": False}
                    ],
                    "footer": {"text": "Antigravity God Mode • Live Execution"}
                }]
            }

        # 2. AIシグナル通知 (Prediction) - 自信がある時だけ通知したい場合など
        # Strategy側で event_type="ai_signal" を送る想定
        elif event_type == "ai_signal":
            side = data.get("side", "UNKNOWN")
            prob = data.get("prob", 0)
            color = 0x5865F2 # Blurple
            
            return {
                "username": "Neural Alpha",
                "embeds": [{
                    "title": f"🧠 AI Insight: {side}",
                    "description": f"Confidence: **{prob:.1%}**",
                    "color": color,
                    "footer": {"text": "Model: LightGBM-Evolved"}
                }]
            }
        

        
        # 5. On-Chain シグナル (warning/critical のみ通知 - info は無視)
        elif event_type == "onchain_signal":
            # data は既にシグナルオブジェクト (pubsub_loop で payload.get("data") として渡される)
            severity = data.get("severity", "info")
            
            # info レベルは通知しない (low_fee 等のノイズ削減)
            if severity == "info":
                return None
            
            sig_type = data.get("type", "unknown")
            message = data.get("message", "")
            
            # Severity based color
            colors = {"warning": 0xf0b132, "critical": 0xda3633}
            color = colors.get(severity, 0xf0b132)
            
            return {
                "username": "On-Chain Alpha",
                "avatar_url": "https://cdn-icons-png.flaticon.com/512/6001/6001283.png",
                "embeds": [{
                    "title": f"⛓️ {sig_type.upper().replace('_', ' ')}",
                    "description": message,
                    "color": color,
                    "fields": [
                        {"name": "Implication", "value": data.get("implication", "N/A"), "inline": False}
                    ],
                    "footer": {"text": "On-Chain Analysis • mempool.space + blockchain.com"}
                }]
            }
        
        # 6. Daily Momentum Strategy Entry
        elif event_type == "daily_momentum_entry":
            symbol = data.get("symbol", "UNKNOWN")
            price = data.get("price", 0)
            qty = data.get("qty", 0)
            rsi = data.get("rsi", 0)
            reason = data.get("reason", "")
            color = 0x2ea043  # Green
            
            return {
                "username": "Momentum Strategy",
                "avatar_url": "https://cdn-icons-png.flaticon.com/512/2920/2920277.png",
                "embeds": [{
                    "title": f"📈 LONG ENTRY: {symbol}",
                    "description": "Daily Momentum Strategy (Evidence-Based)",
                    "color": color,
                    "fields": [
                        {"name": "Price", "value": f"`${price:,.2f}`", "inline": True},
                        {"name": "Size", "value": f"`{qty:.4f}`", "inline": True},
                        {"name": "RSI(14)", "value": f"`{rsi:.1f}`", "inline": True},
                        {"name": "Signal", "value": reason, "inline": False}
                    ],
                    "footer": {"text": "Long-Term Strategy • Daily Evaluation"}
                }]
            }
        
        # 7. Daily Momentum Strategy Exit
        elif event_type == "daily_momentum_exit":
            symbol = data.get("symbol", "UNKNOWN")
            price = data.get("price", 0)
            qty = data.get("qty", 0)
            rsi = data.get("rsi", 0)
            reason = data.get("reason", "")
            color = 0xda3633  # Red
            
            return {
                "username": "Momentum Strategy",
                "avatar_url": "https://cdn-icons-png.flaticon.com/512/2920/2920277.png",
                "embeds": [{
                    "title": f"📉 EXIT: {symbol}",
                    "description": "Daily Momentum Strategy",
                    "color": color,
                    "fields": [
                        {"name": "Price", "value": f"`${price:,.2f}`", "inline": True},
                        {"name": "Size", "value": f"`{qty:.4f}`", "inline": True},
                        {"name": "RSI(14)", "value": f"`{rsi:.1f}`", "inline": True},
                        {"name": "Reason", "value": reason, "inline": False}
                    ],
                    "footer": {"text": "Long-Term Strategy • Trend Reversal Detected"}
                }]
            }

        # 8. Test Signal
        elif event_type == "test":
            message = data.get("message", "Test Notification")
            return {
                "username": "System Test",
                "embeds": [{
                    "title": "🔔 Test Notification",
                    "description": message,
                    "color": 0x5865F2, # Blurple
                    "footer": {"text": "Antigravity Notification Check"}
                }]
            }
            
        return None

