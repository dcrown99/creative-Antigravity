# @repo/ui

共有UIコンポーネントライブラリです。Shadcn UI と Radix UI をベースに構築されています。

## 概要

このパッケージは、モノレポ内のすべてのアプリケーション (`money-master`, `my-kindle`, `auto-clipper-web`) で使用される再利用可能なReactコンポーネントを提供します。

## 技術スタック

- **React**: 19
- **Tailwind CSS**: v4
- **Radix UI**: アクセシビリティ対応のプリミティブ
- **Lucide React**: アイコン
- **Shadcn UI**: ベースデザインシステム

## コンポーネントの追加

Shadcn UI CLIを使用してコンポーネントを追加できます（ルートディレクトリから実行）：

```bash
npx shadcn-ui@latest add [component-name]
```

## 開発

Storybookを使用してコンポーネントを独立して開発・テストできます：

```bash
pnpm storybook
```
