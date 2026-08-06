import type { NextConfig } from "next";

const apiOrigin = (
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.tosuthien.net"
).replace(/\/$/, "");

const nextConfig: NextConfig = {
  /** Browser gọi /api/* → Nest (RAG chat dùng CHAT_PROVIDER=flare / 9flare như portal). */
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiOrigin}/api/:path*` }];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "api.tosuthien.net" },
      { protocol: "https", hostname: "tosuthien.com" },
      { protocol: "http", hostname: "tosuthien.com" },
    ],
  },
};

export default nextConfig;
