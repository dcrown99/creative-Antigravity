# 3Dモデル（アバター）追加計画書

AI Talkerに新しい3Dモデル（人間、VTuber、アニメキャラ風）を追加するための手順書です。

## 1. 対応フォーマット

### A. VRM形式 (推奨)
- **用途**: VTuber、アニメキャラクター、VRoid製モデル
- **メリット**: 表情（BlendShape）、リップシンク、揺れもの（SpringBone）が標準で動作します。
- **入手方法**: VRoid Hub, Booth, またはVRoid Studioで作成。

### B. GLB/GLTF形式
- **用途**: リアルな人間、Ready Player Me、Blenderで作った汎用モデル
- **注意点**: VRM固有の機能（自動リップシンク、表情制御）はそのままでは動きません。
- **対策**: `AvatarModel.tsx` を改修し、GLB用のローダーとアニメーション制御を追加する必要があります。

---

## 2. 実装ステップ (VRMの場合)

最も簡単かつ効果的な方法は、すべてのモデルを **VRM形式** で用意することです。

### ステップ 1: モデルファイルの配置
`apps/ai-talker/public/models/` フォルダに `.vrm` ファイルを配置します。
例:
- `avatar_girl.vrm`
- `avatar_boy.vrm`
- `real_human.vrm` (VRoidや変換ツールで作成)

### ステップ 2: 定数の更新
`apps/ai-talker/src/lib/constants.ts` にアバター定義を追加します。

```typescript
export const AVATAR_PRESETS = [
  { id: "default", name: "デフォルト (少女)", url: "/models/avatar.vrm" },
  { id: "boy", name: "少年", url: "/models/avatar_boy.vrm" },
  { id: "real", name: "リアル調", url: "/models/real_human.vrm" },
];
```

### ステップ 3: ストアの更新
`apps/ai-talker/src/stores/settings-store.ts` に `avatarUrl` を追加します。

```typescript
interface SettingsState {
  // ... existing
  avatarUrl: string;
  setAvatarUrl: (url: string) => void;
}

// ... default: "/models/avatar.vrm"
```

### ステップ 4: UIの更新
`SettingsDialog.tsx` にアバター選択のプルダウンを追加します。

### ステップ 5: キャンバスへの反映
`AvatarCanvas.tsx` でストアから `avatarUrl` を読み込み、`AvatarModel` に渡します。

```typescript
// AvatarCanvas.tsx
const avatarUrl = useSettingsStore(s => s.avatarUrl);
// ...
<AvatarModel url={avatarUrl} />
```

---

## 3. 実装ステップ (GLB/リアル系の場合)

もし `.glb` を直接使いたい場合（Ready Player Meなど）、以下の追加作業が必要です。

1. **コンポーネントの分岐**: `AvatarModel.tsx` 内で拡張子を判定。
2. **GLBローダー**: `@react-three/drei` の `useGLTF` を使用。
3. **アニメーション**: Mixamoなどの `.fbx` アニメーションをリターゲットして適用する必要があります。
4. **リップシンク**: `morphTargetDictionary` を解析し、母音（aa, ih, ou...）に対応するシェイプキーを手動で動かすロジックが必要です。

**推奨**: リアル系モデルであっても、BlenderやUnityで **VRMに変換** してからインポートするのが、AI Talkerの機能をフル活用する最短ルートです。
