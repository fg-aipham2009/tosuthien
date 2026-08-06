import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/seo";

/** robots.txt — index công khai; ẩn trang đọc sách nội bộ. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/kinh-sach/pdf/", "/kinh-sach/chu/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
