import type { NextConfig } from "next";

const apiOrigin = (
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.tosuthien.net"
).replace(/\/$/, "");

const nextConfig: NextConfig = {
  /** Browser gọi /api/* → Nest (RAG chat dùng CHAT_PROVIDER=flare / 9flare như portal). */
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiOrigin}/api/:path*` }];
  },
  /** Giữ thứ hạng khi chuyển từ WordPress sang Next — URL cũ 301 sang trang mới. */
  async redirects() {
    return [
      { source: "/thong-bao", destination: "/tin-tuc", permanent: true },
      { source: "/thong-bao/:path*", destination: "/tin-tuc", permanent: true },
      {
        source: "/:year(\\d{4})/:month(\\d{2})/:day(\\d{2})/:slug*",
        destination: "/tin-tuc/:slug*",
        permanent: true,
      },
      { source: "/category/:path*", destination: "/tin-tuc", permanent: true },
      { source: "/tag/:path*", destination: "/tin-tuc", permanent: true },
      { source: "/feed", destination: "/tin-tuc", permanent: true },
      { source: "/feed/:path*", destination: "/tin-tuc", permanent: true },
    ];
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
