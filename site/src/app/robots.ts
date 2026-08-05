import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/seo";

/** robots.txt giống Yoast: index/follow toàn site. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
