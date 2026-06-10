---
description: MT5戦略マイニング完全ワークフロー（発見→検証→実装→デプロイ）
---

# /mine - MT5 戦略マイニング

ファンダメンタル/市場構造ベースの新戦略を発見し、バックテスト検証を経て EA 化するまでの完全フロー。

> ⚠️ テクニカル指標のみの戦略は対象外。エントリーの根拠は制度的・構造的要因であること。

---

## 前提チェック
// turbo
1. NotebookLM 認証確認
```powershell
./mt5/scripts/nlm_auth.ps1
```

---

## Phase 1: 戦略の発見

2. スキルを確認
```
view_file .agent/skills/mt5-strategy-mining/SKILL.md
```

3. 有望トピックリストからテーマを選択（またはユーザーに確認）

| トピック | アルファソース | 期待されるエッジ（優位性） | グレード |
|:---|:---|:---|:---|
| タイムシリーズ・モメンタム | 行動ファイナンス・情報伝播の遅延 | HFTには先回りできない中長期のトレンド継続性 | A |
| 統計的ペアトレード / コインテグレーション | 強い相関を持つ2通貨ペアの平均回帰 | 相関の崩れを狙うため、単一通貨の方向性リスクを排除 | A |
| キャリー & トレンド (金利差＋順張り) | 構造的なスワップ収益＋モメンタム | ポジティブスワップによる保有時間の味方とトレンドの合致 | A |
| Post-Earnings/News Drift (指標サプライズ後の調整) | サプライズ後の価格調整の遅れ (PEADのFX版) | 指標直後のスプレッド拡大期を避け、後追いでトレンドに乗る | B |

4. **人気度チェック（新規）** — 検索前にトピックの「コモディティ化」を確認
```
search_web(query="[トピック名] forex EA site:youtube.com")
```
   - YouTube 動画が **100件以上** → ⚠️ エッジ消失リスク高。別テーマを検討
   - YouTube 動画が **30件未満** → ✅ ニッチ。続行

5. Web検索で **高品質ソース** を収集（3〜5件）
   - 優先度: ① SSRN/NBER/学術論文PDF ② 機関投資家レポート ③ QuantConnect/Quantified Strategies 等の検証記事
   - **避けるべきソース**: YouTube、個人ブログ、SNS投稿
```
search_web(query="[トピック名] site:ssrn.com OR site:nber.org OR site:bis.org")
search_web(query="[トピック名] institutional flow evidence academic paper")
search_web(query="[トピック名] backtest profit factor quantified")
```

6. **ソース分析（2つのパスから選択）**

   **パス A: NotebookLM 分析（推奨 — 高品質ソース3件以上の場合）**
   - 各URLを `read_url_content` で事前チェック。404/403 の場合は代替URLを探す
   - ソース追加後のタイトルが「404」等の場合は無効→削除して再検索
   ```powershell
   $env:PYTHONIOENCODING='utf-8'
   $id = uv tool run --from notebooklm-mcp-cli nlm notebook create "[トピック名]"
   uv tool run --from notebooklm-mcp-cli nlm source add $id --url "[URL]"
   ```
   - 有効ソースが3件入ったら NLM クエリを実行:
   ```powershell
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
   > 💡 NLMの真価: 「OOSで負リターン」「G10限定では無効」等、**バックテスト前に時間を節約できる洞察**をソースから抽出できる

   **パス B: 直接分析（有効ソース3件未満 or NLM認証失敗時）**
   - `read_url_content` でソースを直接読み、AIがルール抽出＆Grade判定を行う
   - ⚠️ パスBでは「教科書的有名戦略の罠」に注意。人気度チェック(Step 4)の結果を重視すること

7. **判定ゲート**
   - Grade A/B **かつ** 「widely known」フラグなし → Step 9 へ
   - Grade A/B だが「widely known」→ ⚠️ エッジ消失リスク。ユーザーに確認
   - Grade C → **中止**。`mt5/research/strategy_post_mortem.txt` に記録して終了

---

## Phase 3: Python バックテスト

9. テンプレートから検証スクリプトを作成
```powershell
Copy-Item ".agent/skills/mt5-full-cycle/templates/verify_template.py" "mt5/analysis/verify_[戦略名].py"
```

10. 抽出したロジックを `next()` に実装して実行
    - **初回は必ず長期間（1y以上）で実行**。60d等の短期間はサンプルバイアスの罠
// turbo
```powershell
$env:PYTHONIOENCODING='utf-8'; python mt5/analysis/verify_[戦略名].py
```

11. **PF 判定ゲート**
    - PF ≥ 1.5 **かつ** トレード数 ≥ 30 → Step 12 へ（**mt5-full-cycle Phase 3** に移行）
    - PF 1.0〜1.5 → 改善ループ（最大2回）。フィルター追加で再試行
    - PF < 1.0 → **中止**。ポストモーテム記録
    > ⚠️ トレード数が30未満の場合、PFが高くてもサンプルバイアスの可能性大。期間延長して再検証すること。

---

## Phase 4: MQL5 実装 & デプロイ（PF ≥ 1.5 のみ）

12. ロジックパリティチェックリストを確認
```
view_file .agent/skills/mt5-full-cycle/checklists/logic_parity.md
```

13. MQL5 コーディング & コンパイル
```powershell
& "C:\Program Files\MetaTrader 5\metaeditor64.exe" /compile:"mt5\Experts\[EA名].mq5" /log:"mt5\compile.log"
```

14. デプロイ
```powershell
./mt5/force_deploy.ps1 -Source "mt5\Experts\[EA名].ex5" -EAName "[EA名]"
```

15. MT5 バックテスト自動検証 (`mt5-backtest` 使用)
// turbo
```powershell
.\.agent\skills\mt5-backtest\scripts\run_backtest.ps1 -EAName "[EA名]" -PythonPF [PF値] -Mode parity
```

---

## 記録（必須）

16. 結果を `mt5/research/strategy_post_mortem.txt` に追記

17. 検証チケットを作成: `docs/verification_tickets/TICKET_[日時].md`
