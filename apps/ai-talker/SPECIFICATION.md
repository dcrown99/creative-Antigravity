# AI Talker Specification (Antigravity Pivot Edition)

## 概要
**「AI Talker」** は、Gemini 2.5 Pro の高度な推論能力と VRMアバターを組み合わせた、**「心に寄り添うAIパートナー」** アプリケーションです。
従来の「英語学習」機能は廃止され、ユーザーのメンタルケアや雑談、アイデア壁打ちに特化した日本語対話体験を提供します。

## コア機能

### 1. Empathetic AI Partner (共感AI)
* **Model:** **Gemini 2.5 Pro**
* **System Prompt:**
    * ユーザーを肯定し、共感することを最優先するプロンプト設計。
    * ロール（幼馴染、メンター、雑談フレンド）による人格の切り替え。
* **Emotion Analysis:**
    * 会話内容から感情（`joy`, `sorrow`, `angry`, `fun`）をリアルタイムに推論。
    * **Response Cleaning:** AIが生成した感情タグ（例: `[joy]`）はUI表示前に自動除去し、純粋な会話文のみをユーザーに提示。
    * アバターの表情と連動し、生きているような反応を返す。

### 2. Immersive 3D HUD
* **Design:** サイバーパンクテイストの没入型インターフェース。
* **Visuals:** React Three Fiber + Post-Processing (Bloom, Vignette) による映画的レンダリング。
* **Features:**
    * **Lip-Sync:** Voicevoxの音量レベルに合わせたリアルタイム口パク。
    * **Eye Contact:** ユーザー（カメラ）を追従する視線制御。
    * **Cinematic Mode:** UIを非表示にし、アバターとの対話に集中できるモード。

### 3. Voice Interaction (Japanese Native)
* **Input:** Web Speech API (日本語認識モード)
    * **Stability:** `continuous: false` + Manual Restart Loop による高信頼性実装（認識停止回避）。
* **Output:** **Voicevox** (Docker Local API)
    * 日本語テキストを直接合成し、高速なレスポンスを実現。
    * 以前の「カタカナ英語変換」レイヤーは廃止され、自然な日本語発話に特化。
    * **Speaker:** ずんだもん、ナースロボなど、キャラクター性豊かな音声プリセット。

### 4. Custom Avatar System
* **VRM Support:** VRM 0.x / 1.0 形式のアバターに対応。
* **URL Load:** 外部URLまたはローカルプロキシ経由での動的ロード。
* **Persist:** 設定（アバター、ボイス、ロール）はローカルストレージに永続化。

## 技術スタック

### Frontend
* **Framework:** Next.js 15 (App Router)
* **3D Engine:** React Three Fiber, @pixiv/three-vrm
* **State:** Zustand (with Persist)
* **UI:** Tailwind CSS, Framer Motion

### Backend & AI
* **LLM:** Google Gemini 2.5 Pro / Flash
* **TTS:** Voicevox Engine (Docker)

## ディレクトリ構造

```
apps/ai-talker/
├── src/
│   ├── app/
│   │   ├── api/tts/route.ts          # Voicevox Proxy (Japanese Pass-through)
│   ├── components/
│   │   ├── interface/
│   │   │   ├── ConversationUI.tsx    # Main HUD (Localized)
│   │   │   ├── SettingsDialog.tsx    # Partner Settings
│   │   │   └── CyberChatLog.tsx      # Chat History
│   ├── lib/
│   │   ├── ai/gemini-client.ts       # Emotion Analysis Client
│   │   └── constants.ts              # Role/Voice Presets
└── e2e/                               # Playwright Tests
```

## API Endpoints

### POST /api/tts
**Request:**
```json
{
  "text": "今日はいい天気だね",
  "speakerId": 47
}
```

**Processing:**
1. テキストをそのままVoicevox Query APIへ送信 (No conversion)
2. Voicevox Synthesis APIで音声合成
3. WAVバイナリを返却

**Response:**
- `Content-Type: audio/wav`
- Binary audio data

## 開発・デプロイ

### Docker Compose
Voicevoxエンジンと連携して動作します。

```yaml
services:
  ai-talker:
    ports: ["3004:3000"]
    depends_on: ["voicevox"]
  voicevox:
    image: voicevox/voicevox_engine:cpu-ubuntu20.04-latest
    ports: ["50021:50021"]
```

### ローカル開発

```bash
# 依存関係インストール
pnpm install

# 開発サーバー起動
pnpm dev

# E2Eテスト実行
pnpm test:e2e
```

## ロールプリセット

### 幼馴染パートナー
- **目的:** 親身な傾聴、心の支え
- **口調:** タメ口（親しみやすい）
- **感情:** joy, sorrow, fun を多用

### 冷静なメンター
- **目的:** 思考整理、気づきの提供
- **口調:** です・ます調（丁寧）
- **感情:** neutral, joy を多用

### 雑談フレンド
- **目的:** エンターテイメント、息抜き
- **口調:** ノリ重視（流行語OK）
- **感情:** fun, surprised を多用

## システム要件

- **Node.js:** 20.x 以上
- **Docker:** Voicevox Container
- **Browser:** Chrome / Edge (Web Speech API対応)

## 主な変更履歴

### v2.0.0 - Antigravity Pivot (2025-12)
- 英語学習機能を完全廃止
- 日本語対話特化型AIパートナーへ仕様変更
- カタカナ変換ロジック削除
- ロールプリセット3種追加
- UI完全日本語化

### v1.0.0 - Initial Release
- 英語学習アプリとしてリリース
- VRMアバター + Voicevox統合
- React Three Fiber ベースの3D HUD
