---
name: notebooklm-research
category: DevOps & DevOpsCore
description: NotebookLM を使った汎用リサーチワークフロー
---

# NotebookLM リサーチスキル

Google NotebookLM を使い、複数ソースから情報を収集・統合・分析する汎用ワークフロー。

---

## 前提条件

- **CLI:** `notebooklm-mcp-cli` がインストール済み
  ```powershell
  uv tool install notebooklm-mcp-cli
  ```
- **認証:** `nlm login` でログイン済み
- **呼び出し方法 (統一):**
  ```powershell
  $env:PYTHONIOENCODING='utf-8'
  uv tool run --from notebooklm-mcp-cli nlm <command>
  ```

> [!WARNING]
> Windows では `UnicodeEncodeError` が発生しやすい。  
> 必ず `$env:PYTHONIOENCODING='utf-8'` を設定してから実行すること。

---

## ワークフロー

### Step 1: ノートブック作成

リサーチトピック専用のノートブックを作成する。

```powershell
uv tool run --from notebooklm-mcp-cli nlm notebook create "トピック名"
```

出力される **Notebook ID** を控えておく（後続ステップで使用）。

---

### Step 2: ソース収集 & 投入

関連する URL/PDF/YouTube を投入する（最大 50 ソース/ノートブック）。

```powershell
$id = "<notebook-id>"

# Web ページ / PDF
uv tool run --from notebooklm-mcp-cli nlm source add $id --url "https://example.com/article"

# YouTube 動画
uv tool run --from notebooklm-mcp-cli nlm source add $id --url "https://youtube.com/watch?v=..."

# ローカルファイル
uv tool run --from notebooklm-mcp-cli nlm source add $id --file "path/to/file.pdf"
```

> [!TIP]
> 3〜5 件の高品質ソースが理想。量より質を重視する。

---

### Step 3: 質問 & 統合

ソース横断で情報を抽出・統合する。

```powershell
# 要約
uv tool run --from notebooklm-mcp-cli nlm notebook query $id "主要な発見を要約してください"

# 具体的な質問
uv tool run --from notebooklm-mcp-cli nlm notebook query $id "この研究の限界は何ですか？"

# 構造化ドキュメント生成
uv tool run --from notebooklm-mcp-cli nlm notebook query $id "背景、主要な発見、結論のセクションを含むブリーフィングドキュメントを作成してください" > research_brief.md
```

---

### Step 4: 成果物の生成

```powershell
# Markdown レポートとして出力
uv tool run --from notebooklm-mcp-cli nlm notebook query $id "<クエリ>" > output.md

# (オプション) 音声概要の作成
uv tool run --from notebooklm-mcp-cli nlm audio create $id --confirm
```

---

## エラーハンドリング

| エラー | 原因 | 対処 |
|:---|:---|:---|
| `NotAuthenticated` | 認証切れ | `nlm login` を再実行 |
| `UnicodeEncodeError` | Windows の文字コード | `$env:PYTHONIOENCODING='utf-8'` を設定 |
| `Source add failed` | URL がアクセス不可 | URL を直接ブラウザで確認 → 別ソースを検索 |
| `Notebook not found` | ID が間違っている | `nlm list` で既存ノートブック一覧を確認 |
| `Rate limit exceeded` | API 制限 | 30秒待って再試行 |
