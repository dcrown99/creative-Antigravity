import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    output: "standalone",
    transpilePackages: ["@repo/ui"],
    eslint: {
        ignoreDuringBuilds: true,
    },
    /* config options here */
    webpack: (config, { dev }) => {
        if (dev && process.env.WATCHPACK_POLLING === "true") {
            config.watchOptions = {
                poll: 1000,
                aggregateTimeout: 300,
                ignored: /node_modules/,
            };
        }
        return config;
    },
};

export default nextConfig;
