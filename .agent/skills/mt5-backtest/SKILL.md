







---
name: mt5-backtest
category: Trading & Quant
description: MT5 EA のバックテスト自動実行と結果判定
---

# MT5 バックテスト自動化

EA のコンパイル → デプロイ → バックテスト実行 → レポート解析 → 自動判定を一括で行う。

> [!IMPORTANT]
> スクリプトは自動で `.mq5` → `.ex5` のコンパイルを行う。手動で MetaEditor を開く必要はない。

---

## 2つのモード

### `--parity` (デフォルト): ロジックパリティ検証

Python 検証と同一期間で MT5 バックテストし、PF の乖離を確認する。

```powershell
# Python PF=1.75 と比較
.\.agent\skills\mt5-backtest\scripts\run_backtest.ps1 -EAName NakaneMaster -PythonPF 1.75 -Mode parity
```

| MT5 PF | 乖離率 | 判定 |
|:--|:--|:--|
| any | ≤ 20% | ✅ PASS → validate へ |
| any | > 20% | ⚠️ PARITY_CHECK → MQL 調査 |
| < 1.0 | any | ❌ REJECT → 即中止 |

### `--validate`: IS/OOS バリデーション

全期間を 2:1 に自動分割し、オーバーフィットを検出する。

```powershell
.\.agent\skills\mt5-backtest\scripts\run_backtest.ps1 -EAName NakaneMaster -Mode validate
```

| OOS PF | IS→OOS 劣化率 | 判定 |
|:--|:--|:--|
| ≥ 1.3 | ≤ 30% | ✅ PASS → 本番 OK |
| ≥ 1.3 | > 30% | ⚠️ WARN → 注意運用 |
| < 1.3 | any | ❌ OVERFIT → 戦略再検討 |

### `--compare`: 差分検証（リグレッションテスト）

既存レポート（ベースライン）と現在のロジックを比較し、結果の変化を確認する。
「実装したはずが反映されていない」ミスを防ぐために有効。

```powershell
.\.agent\skills\mt5-backtest\scripts\run_backtest.ps1 -EAName NakaneMaster -Mode compare -BaselineReport mt5/backtest_results/base.htm
```

| 判定 | メッセージ | 意味 |
|:--|:--|:--|
| **WARNING** | Logic unchanged | 結果が完全に一致（ロジック変更が反映されていない可能性） |
| **PASS** | Logic change confirmed | 結果に差異あり（変更が適用された） |

---

## 自動静的解析 (Static Check)

スクリプト実行時に MQL5 ソースコードを解析し、**未使用の `input` パラメータ** を検知するとエラー停止する。
これを無視して実行する場合は `-SkipStaticCheck` オプションを使用する。

```powershell
# 静的解析をスキップ
.\run_backtest.ps1 ... -SkipStaticCheck
```

---

## 手順

### Step 1: スクリプト実行

```powershell
# // turbo
.\.agent\skills\mt5-backtest\scripts\run_backtest.ps1 -EAName <EA名> -Mode <parity|validate> [-PythonPF <値>]
```

パラメータ一覧:

| パラメータ | デフォルト | 説明 |
|:--|:--|:--|
| `-EA` | (必須) | EA名 |
| `-Symbol` | `USDJPY` | 通貨ペア |
| `-Period` | `M1` | 時間足 |
| `-From` | `2023.01.01` | 開始日 |
| `-To` | `2025.12.31` | 終了日 |
| `-Mode` | `parity` | `parity`, `validate`, `compare`, `optimize` |
| `-Optimization` | `0` | 最適化モード (0: 無効, 1: 全探索, 2: 遺伝的アルゴリズム) |
| `-ForwardMode` | `0` | OOSテストモード (0: 無効, 1: 1/2, 2: 1/3, 3: 1/4, 4: Custom) |
| `-OptimizationCriterion`| `0` | 評価基準 (0: 残高Max, 1: PF Max, 2: 期待利得Max, 3: DD Min, 4: RecFact Max, 5: Sharpe Max, 6: Custom) |
| `-PythonPF` | `$null` | Python PF (parity 時) |
| `-EAParams` | `@{}` | EA入力パラメータ (ハッシュテーブル) |
| `-Shutdown` | `$true` | テスト後に MT5 を閉じるか |
| `-DryRun` | `$false` | .ini 生成のみ |

> [!WARNING]
> `-EAParams` で Boolean 値を渡す場合、`true`/`false` **ではなく** `1`/`0` を使用すること。
> MT5 テスターは文字列 `"true"`/`"false"` を正しく解釈しない。
>
> ```powershell
> # ✅ 正しい
> -EAParams @{InpUsePriceAction="1"}
> # ❌ 間違い (無視される)
> -EAParams @{InpUsePriceAction="true"}
> ```

### Step 2: 結果確認

スクリプトが自動で:
1. `compile_mql5.ps1` で MetaEditor64 コンパイル
2. `force_deploy.ps1` で MT5 インスタンスへデプロイ
3. `.ini` 生成 → `terminal64.exe /config:` で実行
4. HTML レポートをパース → PF/WR/DD 表示
5. 判定表に基づき PASS / PARITY_CHECK / REJECT / OVERFIT を出力

### Step 3: 判定に応じたアクション

- **✅ PASS:** 本番運用 or validate モードへ
- **⚠️ PARITY_CHECK:** `mt5-full-cycle` Phase 3 に戻りロジック差異を調査
- **❌ REJECT/OVERFIT:** `mt5-full-cycle` Phase 1 に戻り戦略を再検討
### `check_mql_inputs.py`

- MQL5 ソース内の `input` 定義と使用箇所を正規表現でチェック
- 定義のみで参照されていない変数を検出し、exit code 1 を返す

---

## A/B テスト例 (EAParams 使用)

```powershell
# Mode A: 機械的エントリー
.\run_backtest.ps1 -EAName TrendScanner_EA -Mode parity -EAParams @{InpUsePriceAction="0"}

# Mode B: プライスアクション確認後エントリー
.\run_backtest.ps1 -EAName TrendScanner_EA -Mode compare `
  -BaselineReport mt5/backtest_results/TrendScanner_EA_baseline.htm `
  -EAParams @{InpUsePriceAction="1"}
```

## 最適化 (Optimization) と フォワードテスト (OOS) 例

`Mode="optimize"` を指定し、最適化用の各種フラグとパラメータ探索範囲を `EAParams` で渡します。  
最適化時の配列形式は `"Start||Step||Stop"` または `"Value||Start||Step||Stop"` となります。（MT5の実装仕様上、`.ini` に正しい書式が入るように `EAParams` を構成します）。

```powershell
# 遺伝的アルゴリズム (2) + フォワードテスト 1/3期間 (2)
.\run_backtest.ps1 -EAName TrendScanner_EA -Mode optimize `
  -Optimization 2 -ForwardMode 2 -OptimizationCriterion 1 `
  -EAParams @{
      "InpUsePriceAction"="1||0||0||0||N";
      "InpAdxThreshold"="30||20||5||40||Y";
      "InpMinPbAtr"="0.5||0.3||0.1||1.0||Y"
  }
```

> [!NOTE]
> MT5の最適化でパラメータを「探索対象」にする場合、`.ini`ファイルでは特定の書式が必要です。
> 最適化対象の変数は `変数名="初期値||Start||Step||Stop||Y"` （Y は探索有効フラグ）を送る必要があります。
> 最適化しない変数も `変数名="初期値||0||0||0||N"` のように無効フラグ (N) として値を固定することをおすすめします。
