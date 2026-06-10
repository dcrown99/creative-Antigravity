---
name: mt5-full-cycle
category: Trading & Quant
description: MT5戦略開発の完全ライフサイクル管理 (発見 → 検証 → 実装 → デプロイ → 確認)
---

# MT5 フルサイクル戦略ワークフロー

MT5 戦略の完全ライフサイクルを管理するスキル。各フェーズのチェックを省略せず、確実に品質を担保する。

---

## Phase 1: 戦略の発見 (Discovery)

**目標:** 外部エビデンスに裏付けられた高確率の戦略ロジックを発見する。

1. **`mt5-strategy-mining` スキルを実行**
   ```
   view_file .agent/skills/mt5-strategy-mining/SKILL.md
   ```
2. **成果物:** エビデンス Grade A/B のロジックノート
   - Grade C (パターン/チャートアートのみ) → **即リジェクト**

---

## Phase 2: Python 検証 (Pre-Code)

**目標:** MQL コーディング前にベクトルバックテストでロジックを検証する。

1. **検証スクリプトを作成:**
   - ファイルパス: `mt5/analysis/verify_[戦略名].py`
   - テンプレート: [`templates/verify_template.py`](file:///c:/Users/koume/Downloads/code/.agent/skills/mt5-full-cycle/templates/verify_template.py)
   - 標準は `yfinance` でデータ取得 → `backtesting.py` で検証
   
   > [!IMPORTANT]
   > **MT5ローカルデータを利用する場合 (精緻なM1検証等):**
   > ブローカーごとのシンボル名差異（例: `EURJPY` と `EURJPY#` や `EURJPY.a`）による取得エラーを回避するため、シンボル名をハードコーディングせず、必ず `mt5_utils.ensure_symbol_data_sync("EURJPY")` または `resolve_symbol_name` を使用して動的に解決された正しいシンボル名を取得・使用すること。

2. **合否判定:**

   | 指標 | 基準 | 判定 |
   |:---|:---|:---|
   | Profit Factor | **≥ 1.5** | 必須 (手数料・スリッページ考慮) |
   | Win Rate | 戦略に依存 (参考値) | 参考 |
   | Max Drawdown | 口座の20%以内 | 推奨 |

   - **PF < 1.5:** アーカイブして中止 → `mt5/research/strategy_post_mortem.txt` に記録
   - **PF ≥ 1.5:** Phase 3 へ進行

---

## Phase 3: MQL5 実装

**目標:** 堅牢なテンプレートとライブラリを使って EA をコーディングする。

### コーディング規約
- `NakaneMaster` ライブラリ (`TradeExecutor`, `RiskManager`) を可能な限り継承
- すべてのパラメータに `input` を使用 (MagicNo, SL, TP, 時刻 など)

### コンパイル
```powershell
& "C:\Program Files\MetaTrader 5\metaeditor64.exe" /compile:"mt5\Experts\YourEA.mq5" /log:"mt5\compile.log"
```

### ⚠️ ロジックパリティ (CRITICAL)

Python と MQL の対応を必ず確認すること。**これを怠ると「ファントムアルファ」(Python で勝つが EA で負ける) が発生する。**

チェックリスト: [`checklists/logic_parity.md`](file:///c:/Users/koume/Downloads/code/.agent/skills/mt5-full-cycle/checklists/logic_parity.md)

| Python | MQL5 | 意味 |
|:---|:---|:---|
| `df['Close'].shift(0)` | `iClose(_Symbol, PERIOD_XX, 0)` | 現在足 (リペインティングの可能性あり) |
| `df['Close'].shift(1)` | `iClose(_Symbol, PERIOD_XX, 1)` | 確定足 (安全) |
| `df['Close'].shift(N)` | `iClose(_Symbol, PERIOD_XX, N)` | N本前の足 |

---

## Phase 4: デプロイ (CRITICAL)

**目標:** ファイルロック問題を回避して安全に MT5 へデプロイする。

### デプロイコマンド (必須)
```powershell
./mt5/force_deploy.ps1 -Source "mt5\Experts\YourEA.ex5" -EAName "YourEA"
```

> [!CAUTION]
> **手動コピーやリネームは禁止。** `force_deploy.ps1` がファイルロック解除とバックアップを自動処理する。

---

## Phase 5: 検証とハンドオーバー

**目標:** `mt5-backtest` スキルを使用し、ライブ動作が Python 理論値と一致しているか、およびオーバーフィットがないかを自動検証する。

### 手順
1. **パリティ検証 (Logic Parity)**
   ```powershell
   .\.agent\skills\mt5-backtest\scripts\run_backtest.ps1 -EAName "YourEA" -PythonPF <Python側のPF> -Mode parity
   ```
   - **PASS:** 乖離率 ±20% 以内 → 2へ進む
   - **WARNING/FAIL:** ロジックパリティを再チェック → Phase 3 に戻る

2. **IS/OOS バリデーション (Overfit Check)**
   ```powershell
   .\.agent\skills\mt5-backtest\scripts\run_backtest.ps1 -EAName "YourEA" -Mode validate
   ```
   - **PASS (OOS PF ≥ 1.3):** 本番運用開始

> [!TIP]
> 既存ロジックを変更する際は、`-Mode compare -BaselineReport <old.htm>` を使用して差分検証を行ってください。
