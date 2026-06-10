---
name: webapp-testing
category: Web & APIs
description: Playwrightを使ったWebアプリのE2Eテスト手順
---

# Webアプリテストスキル (Webapp Testing)

Playwright を使ってローカルWebアプリを自動テスト・検証する。

> 💡 ブラウザ目視確認だけの場合は `ui-verify` スキルを使用。
> このスキルは**自動化されたE2Eテスト**が必要な場合に使用する。

---

## いつ使うか

- フォーム送信・ボタンクリック等のインタラクションテスト
- 複数ページにまたがるフローテスト
- レスポンシブデザインの検証
- コンソールエラーの自動検出

---

## 前提条件

テスト対象のコンテナが起動していること:
```powershell
./scripts/dev_manager.ps1
```

## ポートマップ (テスト対象)

| アプリ | URL |
|:---|:---|
| money-master | `http://localhost:3001` |
| my-kindle | `http://localhost:3002` |
| auto-clipper-web | `http://localhost:3003` |
| ai-talker | `http://localhost:3004` |
| news-reader | `http://localhost:3005` |

---

## 手順

### Step 1: テストシナリオの定義

```markdown
| # | 操作 | 期待結果 |
|:--|:---|:---|
| 1 | トップページにアクセス | ページが表示される |
| 2 | 「追加」ボタンをクリック | ダイアログが開く |
| 3 | フォームに入力して送信 | リストに追加される |
```

### Step 2: Playwright スクリプトの作成

`browser_subagent` を使用してテストを実行:

```
Task: "http://localhost:<port> にアクセスし、以下を検証:
1. ページが正常に読み込まれる (networkidle を待機)
2. <要素> が表示されている
3. <操作> を実行して <期待結果> を確認
スクリーンショットを撮って結果を報告"
```

### Step 3: テストパターン

#### A) ページ読み込みテスト
```
- ページにアクセス
- networkidle を待機
- 主要な要素が存在するか確認
- コンソールエラーがないか確認
```

#### B) フォーム操作テスト
```
- フォームを開く
- 各フィールドに値を入力
- 送信ボタンをクリック
- 成功メッセージ or リスト更新を確認
```

#### C) ナビゲーションテスト
```
- 各メニュー項目をクリック
- URL遷移を確認
- ページ内容の一致を確認
```

### Step 4: エラーパターンの確認

| エラー | 原因 | 対処 |
|:---|:---|:---|
| `Timeout waiting for selector` | 要素が未レンダリング | `waitForSelector` のタイムアウト延長 |
| `net::ERR_CONNECTION_REFUSED` | コンテナ未起動 | `dev_manager.ps1` で確認 |
| Console error detected | JSランタイムエラー | `systematic-debugging` スキルに移行 |

---

## チェックリスト

- [ ] テスト対象コンテナが起動中
- [ ] テストシナリオを定義
- [ ] `browser_subagent` でテスト実行
- [ ] スクリーンショットで結果を確認
- [ ] コンソールエラーがないことを確認
- [ ] 結果を検証チケットに記録
