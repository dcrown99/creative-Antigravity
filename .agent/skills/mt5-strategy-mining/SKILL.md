---
name: mt5-strategy-mining
category: Trading & Quant
description: ファンダメンタル・市場構造ベースの MT5 戦略発見・検証ワークフロー
---

# MT5 戦略マイニングスキル

**ファンダメンタル（市場メカニクス・制度的要因）に基づく** 戦略のみを対象とする。  
テクニカル指標（RSI, MACD, ボリンジャーバンド等）単体の戦略は **原則不採用**。

> [!IMPORTANT]
> **テクニカル分析だけでは稼げない。**  
> エッジ（アルファの源泉）は「なぜ値が動くか」の構造的理由にのみ存在する。  
> インジケータはフィルターとして使えるが、エントリーの根拠にはならない。

---

## 前提条件

- **NotebookLM:** `notebooklm-research` スキルのセットアップ済み
  ```
  view_file .agent/skills/notebooklm-research/SKILL.md
  ```
- **Python パッケージ:** `backtesting`, `pandas`, `yfinance`

---

## 有効なアルファソースの分類

戦略を評価する際、以下の分類でエッジの根拠を判定する。

| グレード | アルファソース | 例 | 判定 |
|:---|:---|:---|:---|
| **A** | リテール特化の構造的要因 | タイムシリーズ・モメンタム、ペアトレード(共和分)、金利差キャリー | ✅ 最優先（HFTと競合しない） |
| **B** | マクロ・ニュースドリフト | 経済指標サプライズ後の調整遅れ、中央銀行のトレンド転換 | ✅ 検証対象 |
| **C** | 微細なアノマリー / テクニカル単体 | 仲値・月末リバランス（スプレッド負けする）、RSI逆張り | ❌ **原則不採用** |

---

## ワークフロー

### Step 1: 戦略の発見 (リサーチ)

**⓪ ターゲット頻度と出力形式の事前決定 (NEW!)**
- マイニング開始時に、ユーザーが期待する**トレード頻度**（スキャル/デイ/スイング）をヒアリングする。
- 頻度が低い（年数回〜数十回）戦略の場合、MT5 EAではなくTradingViewインジケーター（アラート専用）への方針転換をあらかじめ合意しておく。

**① 人気度チェック (必須)** — 検索前にトピックの「コモディティ化」を確認:
```
search_web(query="[トピック名] forex EA site:youtube.com")
```
- YouTube 動画 100件以上 → ⚠️ エッジ消失リスク高。別テーマを検討
- YouTube 動画 30件未満 → ✅ ニッチ。続行

**② トピック選定** — 以下の有望トピックリストから選択、または新規テーマを提案:

| トピック | アルファソース | 期待されるエッジ（優位性） | グレード |
|:---|:---|:---|:---|
| タイムシリーズ・モメンタム | 行動ファイナンス・情報伝播の遅延 | HFTには先回りできない中長期のトレンド継続性 | A |
| 統計的ペアトレード / コインテグレーション | 強い相関を持つ2通貨ペアの平均回帰 | 相関の崩れを狙うため、単一通貨の方向性リスクを排除 | A |
| キャリー & トレンド (金利差＋順張り) | 構造的なスワップ収益＋モメンタム | ポジティブスワップによる保有時間の味方とトレンドの合致 | A |
| Post-Earnings/News Drift (指標サプライズ後の調整) | サプライズ後の価格調整の遅れ (PEADのFX版) | 指標直後のスプレッド拡大期を避け、後追いでトレンドに乗る | B |

**③ Web 検索** (ツール呼び出し):
- 優先度: ① SSRN/NBER/BIS等の学術論文 ② 機関投資家レポート ③ QuantConnect/Quantified Strategies等検証記事
- **避けるべきソース**: YouTube、個人ブログ、SNS投稿
```
search_web(query="[トピック名] site:ssrn.com OR site:nber.org OR site:bis.org")
search_web(query="[トピック名] institutional flow evidence academic paper")
```

**④ ソース分析（2つのパスから選択）:**

> [!TIP]
> **パス A (NLM) 推奨。** 高品質ソース3件以上が利用可能な場合、NLMは「OOSで負リターン」「特定通貨限定で無効」等の
> **バックテスト前に時間を節約できる洞察**をソースから抽出できる。

**パス A: NotebookLM 分析（有効ソース3件以上）**
- 各URLを `read_url_content` で事前確認。404/403 は代替URLを探す
- ソース追加後のタイトルが「404」等の場合は無効→削除して再検索
- 有効ソース3件投入後、クエリを実行:
```powershell
$id = "<notebook-id>"
$query = @"
Analyze the '[トピック名]' strategy based ONLY on the provided sources.
1. Extract exact Entry/Exit/Filter rules with specific parameter values.
2. What is the fundamental Alpha Source?
3. Grade: [A: Academic with backtest], [B: Market Mechanics], [C: Pattern Only -> REJECT]
4. Will this edge persist? (Structural vs temporary)
5. How widely known is this strategy? Flag HIGH RISK if in popular trading education.
"@
uv tool run --from notebooklm-mcp-cli nlm notebook query $id $query
```

**パス B: 直接分析（有効ソース3件未満 or NLM認証失敗時）**
- `read_url_content` でソースを直接読み、AIがルール抽出＆Grade判定を行う
- ⚠️ パスBでは「教科書的有名戦略の罠」に注意。人気度チェックの結果を重視

---

**判定ゲート:**

| グレード | 判定 | 次のアクション |
|:---|:---|:---|
| **A/B** + widely knownなし | ✅ 承認 | Step 3 へ |
| **A/B** + widely known | ⚠️ 注意 | ユーザーに確認 |
| **C** | ❌ 却下 | **中止** — ユーザーに報告 |

> [!CAUTION]
> Grade C の戦略を「フィルターを追加すれば使える」と判断してはならない。  
> エントリーの根拠自体にエッジがなければ、フィルターでは救えない。

---

### Step 3: バックテスト検証 (Grade A/B のみ)

抽出されたロジックを Python スクリプトで検証する。

- **ファイルパス:** `mt5/analysis/verify_[戦略名].py`
- **テンプレート:** [`templates/backtest_template.py`](file:///c:/Users/koume/Downloads/code/.agent/skills/mt5-strategy-mining/templates/backtest_template.py)

> [!NOTE]
> テクニカル指標（SMA, RSI 等）は **フィルター** として使ってよいが、  
> **エントリーの主因** は必ずファンダメンタル条件（時刻、日付、イベント等）とすること。

> [!IMPORTANT]
> **初回バックテストは必ず 1年以上のデータで実行すること。**
> 60日等の短期間で PF が高くてもサンプルバイアスの可能性が高い。
> 特にトレード数が 30 未満の場合、期間を延長して再検証が必須。

---

### Step 4: 結果分析 & パリティ改善ループ

| PF | 判定 | アクション |
|:---|:---|:---|
| **≥ 1.5** かつ Trades ≥ 30 | ✅ 有望 | `mt5-full-cycle` Phase 2 で本格検証 |
| **≥ 1.5** だが Trades < 30 | ⚠️ サンプル不足 | 期間延長で再検証必須 |
| **1.0 〜 1.5** | 🟡 改善余地 | Step 4a (改善ループ) へ |
| **< 1.0** | ❌ 不採算 | Step 5 (ポストモーテム) へ |

**Step 4a: 改善ループ (最大2回)**

> [!WARNING]
> **イテレーション上限: 2回。** 2回で PF < 1.5 なら即リジェクト。

改善の方向性:
- 時間帯フィルター（アジア/欧州/米国セッション）
- 曜日・日付フィルター（ゴトー日、月末、SQ日）
- ボラティリティフィルター（ATR ベースのエントリー条件）
- **テクニカル指標の追加ではなく、不利な環境の除外** に集中する

**Step 4b: パリティ乖離の改善 (MT5実装後)**
Python (verify_*.py) と MT5 (EA) で結果が乖離した場合、以下の要因を調査し、Python側の前提条件をMT5の実環境（またはブローカー仕様）に近づけること：
1. **スプレッド/スワップの現実化**: ロールオーバー時（サーバー時間0時）の極端なスプレッド拡大をPython側でもコストとして織り込むか、EA側で0時台のエントリーを回避する。
2. **Filling Mode (約定方式)**: FOK/IOC 制約による注文拒否（Retcode 10030）を考慮し、CTradeクラス等で適切に処理する。
3. **日足(D1)のタイムゾーン**: MT5サーバーのタイムゾーン（通常EET/GMT+2）と、Pythonで取得するYFinanceデータのタイムゾーン（UTC等）のズレによる日足形成の違いを意識する。

---

### Step 5: ポストモーテム記録 (必須)

結果に関わらず記録する。過去の失敗は将来の無駄な検証を防ぐ資産。

**ファイル:** `mt5/research/strategy_post_mortem.txt`

```
## N. [戦略名] ([日付])
- **ロジック:** [エントリー/エグジットの要約]
- **アルファソース:** [Grade X: 構造的根拠の説明]
- **結果:** PF [値] / WR [値]%
- **結論:** [採用/却下の理由]
- **教訓:** [次の戦略探索に活かすべき知見]
- **ステータス:** [APPROVED / REJECTED]
```
