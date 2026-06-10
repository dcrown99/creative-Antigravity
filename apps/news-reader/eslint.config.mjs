import sharedConfig from "@repo/config/eslint.config.mjs";

/** @type {import('eslint').Linter.Config[]} */
const eslintConfig = [
    ...sharedConfig,
    {
        ignores: [".next/**", "data/**"],
    },
    {
        files: ["**/*.js", "**/*.ts", "**/*.tsx"],
        rules: {
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/no-require-imports": "off",
        },
    },
];

export default eslintConfig;
