import sharedConfig from "@repo/config/eslint.config.mjs";

/** @type {import('eslint').Linter.Config[]} */
const eslintConfig = [
    ...sharedConfig,
    {
        rules: {
            "@next/next/no-html-link-for-pages": "off",
        },
    },
];

export default eslintConfig;
