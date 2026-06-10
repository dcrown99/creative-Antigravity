# My Kindle

**My Kindle** は、Next.js で構築された自己ホスト型の個人用漫画リーダーアプリケーションです。
商用アプリのような没入感のあるモダンなUIと、快適な読書体験を提供します。

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![Tech](https://img.shields.io/badge/Next.js-15-black)
![Style](https://img.shields.io/badge/Tailwind-v4-cyan)

## ✨ 主な機能 (Features)

### 📚 Immersive Library (没入型ライブラリ)
- **Hero Section**: 最後に読んでいた本を自動判定し、ダイナミックな背景と共にトップに表示。ワンタップで続きから読めます。
- **Glassmorphism UI**: すりガラス効果を取り入れたヘッダーと、洗練されたカードデザイン。
- **Visual Feedback**: ホバー時の滑らかなアニメーションと、円形プログレスインジケーター。

### 📖 Advanced Reader (高機能リーダー)
- **Spread View (見開きモード)**: 横画面やPCでは、漫画を見開き（2ページ同時表示）で閲覧可能。表紙は自動的に単ページ表示になります。
- **Smart Navigation**:
  - **RTL / LTR 対応**: 漫画（右開き）と小説（左開き）の両方に対応。
  - **タッチ & キーボード**: スワイプ操作、キーボード（矢印キー）、クリック領域による直感的な操作。
- **Customization**: 画像のフィットモード（全体表示 / 画面一杯）や閲覧方向をいつでも設定変更可能。

### 🛠️ System & Robustness
- **完全日本語対応**: UI、設定メニュー、エラーメッセージに至るまで自然な日本語で統一。
- **進捗の自動保存**: 読んだページ、表示設定をブラウザに自動保存（LocalStorage）。
- **柔軟なファイル対応**: フォルダ形式の漫画だけでなく、`.cbz` や `.zip` 形式のアーカイブファイルもそのまま読み込み可能。

### Monorepo 構成

このプロジェクトは **Turborepo + pnpm Workspaces** で構成されたMonorepoの一部です。

- **パッケージ名**: `@app/my-kindle`
- **共有パッケージ**: `@repo/ui` (共通UIコンポーネント)
- **ビルドシステム**: Turborepo

> [!NOTE]
> Monorepo全体のアーキテクチャは [ARCHITECTURE.md](file:///c:/Users/koume/Downloads/code/ARCHITECTURE.md) を参照してください。

---

## 🚀 セットアップ手順 (Setup Guide)

### 1. 前提条件
- **Node.js**: v18以上推奨
- **漫画データ**: 任意のフォルダに漫画のフォルダ、またはZIP/CBZファイルを保存してください。

### 2. インストール
プロジェクトのディレクトリで依存関係をインストールします。

```bash
npm install
```

### 3. 設定 (Configuration)

ルートディレクトリに `.env.local` ファイルを作成し、漫画データが保存されているフォルダのパスを指定します。

```bash
# .env.local
MANGA_ROOT=H:\\DL\\MangaDownloads
```

※ Windowsの場合はパスの区切り文字に注意してください（通常はそのままで機能しますが、エスケープが必要な場合があります）。

### 4. アプリケーションの起動

#### 開発モード

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) にアクセスします。

#### 本番ビルド & 起動 (推奨)

パフォーマンスを最大限に引き出すため、ビルドして起動することをお勧めします。 付属の `start-server.bat` を使用するか、以下のコマンドを実行してください。

```bash
npm start
```

### 5. Dockerでの実行 (推奨)

Dockerを使用すると、Node.js環境を構築せずにアプリケーションを実行できます。

1. **設定の変更**:
   `docker-compose.dev.yml` (または `docker-compose.prod.yml`) を開き、漫画データのパスをあなたの環境に合わせて変更してください。
   ```yaml
   volumes:
     - "H:/漫画:/app/library" # 左側をあなたの漫画フォルダのパスに変更
   ```

2. **起動**:
   ```bash
   # マルチステージビルドにより初回以降は高速に起動します
   docker-compose up -d
   ```

3. **アクセス**:
   ブラウザで [http://localhost:3001](http://localhost:3001) にアクセスしてください。


   ```

3. **アクセス**: [http://localhost:3001](http://localhost:3001)

**マウントポイント**: `/mnt/gdrive/Manga` (環境変数 `LIBRARY_PATH`で設定)

**確認**:
```bash
# マウント状態確認
docker-compose -f docker-compose-drivestream.yml exec my-kindle ls -la /mnt/gdrive/Manga
```


---

## 📖 使い方 (Usage)

### ライブラリ画面
サーバーにある漫画フォルダ/ファイルが自動的に読み込まれ、グリッド表示されます。

読書中の本がある場合、画面上部の Hero Section に表示され、「続きを読む」ボタンですぐに再開できます。

### リーダー画面

- **メニュー表示**: 画面中央をタップ/クリックするとヘッダーとフッターが表示されます。
- **ページめくり**:
  - 画面の左右端をタップ/クリック
  - キーボードの `←` `→` または `Space`
  - スワイプ操作
- **設定変更**: 右上の歯車アイコンから「見開き/単ページ」「右開き/左開き」「フィットモード」を変更できます。設定は本ごとに記憶されます。

---

## 🛠️ 技術スタック

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4, tailwindcss-animate
- **Backend API**: Next.js Route Handlers
- **State Management**: React Hooks (Custom hooks)

---

## 📝 トラブルシューティング

### Q. 「ライブラリは空です」と表示される

- `.env.local` の `MANGA_ROOT` パスが正しいか確認してください。
- 指定したフォルダ内に画像ファイル（.jpg, .png, .webp）を含むサブフォルダ、または .zip/.cbz ファイルがあるか確認してください。

### Q. 画像が表示されない

- 画像ファイル名に特殊文字が含まれていないか確認してください。
- サーバーのログ（ターミナル）にエラーが出ていないか確認してください。

## 📜 ライセンス

このプロジェクトは個人使用を目的としています。

### 🌍 公開リポジトリ
本プロジェクトの公開版は以下で管理されています（機密情報を除外済み）:
[https://github.com/dcrown99/creative-Antigravity](https://github.com/dcrown99/creative-Antigravity)