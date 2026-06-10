import type { Config } from "tailwindcss";
import sharedConfig from "../../packages/config/tailwind.config";

const config: Config = {
    ...sharedConfig,
    content: [
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        // 共有UIコンポーネントのスタイルを適用
        "../../packages/ui/src/**/*.{ts,tsx}",
    ],
};
export default config;
