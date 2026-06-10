import type { Config } from "tailwindcss";
import sharedConfig from "@repo/config/tailwind.config";

const config: Config = {
    ...sharedConfig,
    darkMode: 'class',
    content: [
        "./src/**/*.{ts,tsx}",
        "../../packages/ui/src/**/*.{ts,tsx}",
    ],
};

export default config;
