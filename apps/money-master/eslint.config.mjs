import sharedConfig from "@repo/config/eslint.config.mjs";

/** @type {import('eslint').Linter.Config[]} */
const eslintConfig = [
  ...sharedConfig,
  {
    ignores: ["dist-seed/**", "playwright.config.ts", ".next/**"],
  },
  {
    files: ["**/*.js", "**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // アプリ固有のルールがあればここに追加
];

export default eslintConfig;
