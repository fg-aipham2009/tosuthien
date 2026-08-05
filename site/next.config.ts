import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "api.tosuthien.net" },
      { protocol: "https", hostname: "tosuthien.com" },
      { protocol: "http", hostname: "tosuthien.com" },
    ],
  },
};

export default nextConfig;
