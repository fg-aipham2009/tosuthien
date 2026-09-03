import type { NextConfig } from "next";

const LOOPBACK_API = "http://127.0.0.1:8000";

const publicApi = (
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.tosuthien.net"
).replace(/\/$/, "");

/** Next rewrite fallback — production on VPS always hits Nest via loopback. */
const rewriteApiOrigin = (
  process.env.API_INTERNAL_BASE_URL ||
  (process.env.NODE_ENV === "production" ? LOOPBACK_API : publicApi)
).replace(/\/$/, "");

const nextConfig: NextConfig = {
  /** If a request reaches Next /api (not nginx), proxy to localhost Nest. */
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${rewriteApiOrigin}/api/:path*` },
      { source: "/files/:path*", destination: `${rewriteApiOrigin}/files/:path*` },
      // FlipHTML5 bookcase skin assets (JS uses absolute /bookcase/img/...)
      {
        source: "/bookcase/img/:path*",
        destination:
          "https://static.fliphtml5.com/resourceFiles/bookcase/img/:path*",
      },
    ];
  },
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
