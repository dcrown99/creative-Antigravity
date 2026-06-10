import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // 🔴 CRITICAL: これがないと Monorepo 内の UI パッケージをビルドできずエラーになる
  transpilePackages: ["@repo/ui"],

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'm.media-amazon.com',
      },
    ],
  },
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