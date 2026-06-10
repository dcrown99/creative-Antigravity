---
description: XM全銘柄トレンドスキャン（トレンドフォロー EA 稼働判断用）
---

# /scan - トレンドスキャナー

XM Trading の全銘柄（FX, 株指数, 商品, 仮想通貨）をスキャンし、トレンドが出ている銘柄を検出する。

---

// turbo
1. 全銘柄スキャン
```powershell
$env:PYTHONIOENCODING='utf-8'; python mt5/analysis/trend_scanner.py --signals
```

2. 結果を確認し、EA 稼働推奨銘柄を整理

3. （オプション）カテゴリ別や閾値変更でフィルタリング
```powershell
# FX のみ
$env:PYTHONIOENCODING='utf-8'; python mt5/analysis/trend_scanner.py --category fx

# 強トレンドのみ (ADX > 30)
$env:PYTHONIOENCODING='utf-8'; python mt5/analysis/trend_scanner.py --min-adx 30
```

4. EA 稼働判断 / 裁量エントリー
   - 🚀 **SETUP** → エントリーゾーン、SL、Trail を参考に裁量エントリー（または EA 稼働）
   - 👀 **WATCH** → ゾーン接近中。アラート設定推奨
   - 📈 **TREND** → トレンド継続中だが押し目なし
   - 💤 **RANGE** → エントリー不可
