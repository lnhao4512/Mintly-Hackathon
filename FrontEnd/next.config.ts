import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
    resolveAlias: {
      "@solana-mobile/wallet-adapter-mobile": "./src/stubs/mobile-wallet-adapter.ts",
      "@solana-mobile/mobile-wallet-adapter-protocol": "./src/stubs/mobile-wallet-adapter.ts",
      "eventemitter3": "./node_modules/eventemitter3/index.js",
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@solana-mobile/wallet-adapter-mobile": path.resolve(process.cwd(), "src/stubs/mobile-wallet-adapter.ts"),
      "@solana-mobile/mobile-wallet-adapter-protocol": path.resolve(process.cwd(), "src/stubs/mobile-wallet-adapter.ts"),
      eventemitter3: path.resolve(process.cwd(), "node_modules/eventemitter3/index.js"),
    };
    return config;
  },
};

export default nextConfig;
