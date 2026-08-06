import type { Metadata } from "next";

/** Domain công khai — mặc định giống bản gốc WP. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://tosuthien.com"
).replace(/\/$/, "");

export const SITE_NAME = "Tổ Sư Thiền";
/** Mô tả site (chuẩn SEO tiếng Việt). */
export const SITE_DESCRIPTION =
  "Tông Phong Tổ Sư Thiền Việt Nam — tin tức, thiền đường, hỏi đáp kinh sách, pháp âm MP3.";

export const SITE_KEYWORDS = [
  "Tổ Sư Thiền",
  "Tông Phong Tổ Sư Thiền",
  "Thiền",
  "Phật pháp",
  "Thích Duy Lực",
  "Thiền đường",
  "Kinh sách",
  "Pháp âm",
  "Tin tức Phật giáo",
];

export const DEFAULT_OG_IMAGE = {
  url: `${SITE_URL}/wp/header-right.png`,
  width: 512,
  height: 512,
  alt: SITE_NAME,
};

/** robots giống Yoast SEO trên tosuthien.com */
export const YOAST_ROBOTS: NonNullable<Metadata["robots"]> = {
  index: true,
  follow: true,
  "max-image-preview": "large",
  "max-snippet": -1,
  "max-video-preview": -1,
};

type BuildOpts = {
  title: string;
  /** Nếu true: title đã gồm " - Tổ Sư Thiền", không dùng template. */
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

/** Metadata chuẩn Yoast: title, canonical, og:locale vi_VN, twitter large image. */
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
    ? title
    : title.includes(SITE_NAME)
      ? title
      : `${title} - ${SITE_NAME}`;
  const desc = description?.trim() || SITE_DESCRIPTION;
  const ogImage = image
    ? {
        url: image.startsWith("http") ? image : `${SITE_URL}${image}`,
        width: imageWidth,
        height: imageHeight,
        alt: title,
      }
    : DEFAULT_OG_IMAGE;

  return {
    title: absoluteTitle || title.includes(SITE_NAME)
      ? { absolute: pageTitle }
      : title,
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

/** Cắt mô tả OG ~ Yoast (~155 ký tự). */
export function excerptForOg(text?: string | null, max = 155): string | undefined {
  if (!text) return undefined;
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return undefined;
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trim()}…`;
}

export function absoluteUrl(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
