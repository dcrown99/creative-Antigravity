# @repo/config

共有設定パッケージです。ESLintやTypeScriptの設定を一元管理します。

## 含まれる設定

### ESLint (`eslint-config`)

Next.jsおよびReactアプリケーション向けの共有ESLint設定です。

- **使用法**: `package.json` の `eslintConfig` または `eslint.config.mjs` で拡張します。

### TypeScript (`typescript-config`)

プロジェクト全体で統一された `tsconfig.json` のベース設定を提供します。

- **base**: 基本設定
- **nextjs**: Next.jsアプリ向け設定
- **react-library**: Reactライブラリ向け設定

## 使用方法

各アプリケーションの `package.json` で依存関係として追加し、設定ファイルを継承します。

```json
// package.json
{
  "devDependencies": {
    "@repo/config": "workspace:*"
  }
}
```
