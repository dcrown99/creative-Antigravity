import type { StorybookConfig } from "@storybook/react-vite";
import { join, dirname } from "path";
import { createRequire } from "module";
import tsconfigPaths from "vite-tsconfig-paths";

const require = createRequire(import.meta.url);

/**
 * This function is used to resolve the absolute path of a package.
 * It is needed in projects that use Yarn PnP or are set up within a monorepo.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getAbsolutePath(value: string): any {
    return dirname(require.resolve(join(value, "package.json")));
}

const config: StorybookConfig = {
    stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
    addons: [
        getAbsolutePath("@storybook/addon-links"),
        getAbsolutePath("@storybook/addon-essentials"),
        getAbsolutePath("@storybook/addon-onboarding"),
        getAbsolutePath("@storybook/addon-interactions"),
        getAbsolutePath("@storybook/addon-themes"),
    ],
    framework: {
        name: getAbsolutePath("@storybook/react-vite"),
        options: {},
    },
    docs: {
        autodocs: "tag",
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    viteFinal: async (config: any) => {
        return {
            ...config,
            plugins: [...(config.plugins || []), tsconfigPaths()],
        };
    },
};
export default config;
