import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    reactStrictMode: true,
    transpilePackages: ["@repo/ui"],
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "**",
            },
            {
                protocol: "http",
                hostname: "**",
            }
        ],
    },
    webpack: (config) => {
        config.ignoreWarnings = [
            { module: /node_modules\/bullmq/ }
        ];
        return config;
    },
};

export default nextConfig;
