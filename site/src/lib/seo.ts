import type { Metadata } from "next";

/** Public site origin (matches legacy WordPress). */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://tosuthien.com"
).replace(/\/$/, "");

export const SITE_NAME = "Tổ Sư Thiền";

/** Primary SEO keyword — lead titles and descriptions when possible. */
export const SEO_PRIMARY_KEYWORD = SITE_NAME;

/** Domain / Latin brand variant for search and JSON-LD. */
export const SEO_DOMAIN_KEYWORD = "tosuthien";

export const SEO_DOMAIN_LABEL = "tosuthien.com";

/** PWA install name. */
export const PWA_APP_NAME =
  process.env.NEXT_PUBLIC_PWA_APP_NAME?.trim() || SITE_NAME;

/** Site-wide meta description — Tổ Sư Thiền + thư viện Hòa thượng (~155 chars for Google). */
export const SITE_DESCRIPTION =
  "Tổ Sư Thiền (tosuthien.com) — Tông Phong Thiền Việt Nam. Thư viện Hòa thượng Thích Duy Lực: kinh sách, pháp âm MP3, hỏi đáp Phật pháp và thiền đường.";

export const SITE_KEYWORDS = [
  "Tổ Sư Thiền",
  "Tổ Sư Thiền Việt Nam",
  "Tông Phong Tổ Sư Thiền",
  "Tông Phong Thiền Việt Nam",
  "Thư viện Tổ Sư Thiền",
  "Thư viện Hòa thượng Thích Duy Lực",
  "Hòa thượng Thích Duy Lực",
  "Thích Duy Lực",
  "Kinh sách Tổ Sư Thiền",
  "Ngữ lục Tổ Sư Thiền",
  "Pháp âm Tổ Sư Thiền",
  "Hỏi đáp Tổ Sư Thiền",
  "Tổ Sư Thiền online",
  "trang chính thức Tổ Sư Thiền",
  "tosuthien",
  "tosuthien.com",
  "Thiền",
  "Phật pháp",
  "Thiền đường",
  "Kinh sách",
  "Pháp âm",
  "Tin tức Phật giáo",
];

export const DEFAULT_OG_IMAGE = {
  url: `${SITE_URL}/wp/header-right.png`,
  width: 512,
  height: 512,
  alt: `${SEO_PRIMARY_KEYWORD} — Thư viện Hòa thượng Thích Duy Lực`,
};

const BRAND_LEAD_RE = /^(Tổ Sư Thiền|tosuthien)/i;

/** Standard title: «Tổ Sư Thiền | …» (brand first). */
export function formatBrandTitle(pagePart: string): string {
  const part = pagePart.trim();
  if (!part) return SEO_PRIMARY_KEYWORD;
  if (part.startsWith(SEO_PRIMARY_KEYWORD)) return part;
  return `${SEO_PRIMARY_KEYWORD} | ${part}`;
}

/** Prefix descriptions with the primary keyword when missing at the start. */
export function formatBrandDescription(
  description?: string | null,
  max = 160,
): string {
  const clean = description?.replace(/\s+/g, " ").trim();
  if (!clean) return SITE_DESCRIPTION;
  if (BRAND_LEAD_RE.test(clean)) return clean.length <= max ? clean : `${clean.slice(0, max - 1).trim()}…`;
  const prefixed = `${SEO_PRIMARY_KEYWORD} — ${clean}`;
  if (prefixed.length <= max) return prefixed;
  return `${SEO_PRIMARY_KEYWORD} — ${clean.slice(0, max - SEO_PRIMARY_KEYWORD.length - 4).trim()}…`;
}

export const HOME_SEO_TITLE = formatBrandTitle(
  "Thư viện Hòa thượng Thích Duy Lực — tosuthien.com",
);

/** robots.txt parity with legacy Yoast on tosuthien.com */
export const YOAST_ROBOTS: NonNullable<Metadata["robots"]> = {
  index: true,
  follow: true,
  "max-image-preview": "large",
  "max-snippet": -1,
  "max-video-preview": -1,
};

type BuildOpts = {
  title: string;
  /** Full HTML title already including «Tổ Sư Thiền | …». */
  absoluteTitle?: boolean;
  description?: string | null;
  path?: string;
  image?: string | null;
  imageWidth?: number;
  imageHeight?: number;
  type?: "website" | "article";
  noIndex?: boolean;
  publishedTime?: string | null;
  modifiedTime?: string | null;
};

/** Yoast-style metadata: title, canonical, og:locale vi_VN, Twitter large image. */
export function buildMetadata({
  title,
  absoluteTitle = false,
  description,
  path = "/",
  image,
  imageWidth,
  imageHeight,
  type = "website",
  noIndex = false,
  publishedTime,
  modifiedTime,
}: BuildOpts): Metadata {
  const url = `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const pageTitle = absoluteTitle
    ? title.includes(SEO_PRIMARY_KEYWORD)
      ? title
      : formatBrandTitle(title)
    : formatBrandTitle(title);
  const desc = formatBrandDescription(description);
  const ogImage = image
    ? {
        url: image.startsWith("http") ? image : `${SITE_URL}${image}`,
        width: imageWidth,
        height: imageHeight,
        alt: formatBrandTitle(title),
      }
    : DEFAULT_OG_IMAGE;

  return {
    title: { absolute: pageTitle },
    description: desc,
    keywords: SITE_KEYWORDS,
    alternates: { canonical: url },
    robots: noIndex
      ? { index: false, follow: false }
      : YOAST_ROBOTS,
    openGraph: {
      type,
      locale: "vi_VN",
      url,
      siteName: SITE_NAME,
      title: pageTitle,
      description: desc,
      images: [ogImage],
      ...(type === "article" && publishedTime
        ? {
            publishedTime,
            modifiedTime: modifiedTime || publishedTime,
          }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description: desc,
      images: [ogImage.url],
    },
  };
}

/** Trim text for Open Graph (~155 chars), keeping brand prefix when possible. */
export function excerptForOg(text?: string | null, max = 155): string | undefined {
  if (!text) return undefined;
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return undefined;
  return formatBrandDescription(clean, max);
}

export function absoluteUrl(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** JSON-LD alternate names for WebSite / Organization. */
export const SCHEMA_ALTERNATE_NAMES = [
  "Tông Phong Tổ Sư Thiền",
  "Tông Phong Thiền Việt Nam",
  "Thư viện Hòa thượng Thích Duy Lực",
  "Thư viện Tổ Sư Thiền",
  SEO_DOMAIN_KEYWORD,
  SEO_DOMAIN_LABEL,
] as const;
