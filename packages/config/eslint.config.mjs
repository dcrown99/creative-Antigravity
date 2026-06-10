import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
    baseDirectory: import.meta.dirname,
});

const eslintConfig = [
    ...compat.config({
        extends: ["next/core-web-vitals", "next/typescript"],
        rules: {
            "@typescript-eslint/no-unused-vars": "warn",
            "react/no-unescaped-entities": "off",
            "@typescript-eslint/strict-boolean-expressions": "off"
        }
    }),
];

export default eslintConfig;
