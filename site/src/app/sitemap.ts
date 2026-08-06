import type { MetadataRoute } from "next";
import { API_BASE, fetchCenters } from "../lib/api";
import { fetchAllPostSlugs } from "../lib/posts";
import { SITE_URL } from "../lib/seo";
import type { MediaCategory } from "../lib/library/types";

async function fetchMp3CategorySlugs(): Promise<string[]> {
  try {
    const res = await fetch(`${API_BASE}/media/categories`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const cats = (await res.json()) as MediaCategory[];
    return cats.map((c) => c.slug).filter(Boolean);
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_URL}/gioi-thieu`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/tin-tuc`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/thien-duong`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/thien-duong?region=NAM`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/thien-duong?region=TRUNG`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/thien-duong?region=BAC`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/thien-duong?region=NUOC_NGOAI`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/hoi-dap`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${SITE_URL}/phap-am`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${SITE_URL}/kinh-sach`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${SITE_URL}/lien-he`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];

  let centers: Awaited<ReturnType<typeof fetchCenters>> = [];
  try {
    centers = await fetchCenters();
  } catch {
    centers = [];
  }

  const centerPages: MetadataRoute.Sitemap = centers
    .filter((c) => c.slug)
    .map((c) => ({
      url: `${SITE_URL}/thien-duong/${c.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    }));

  let postSlugs: Awaited<ReturnType<typeof fetchAllPostSlugs>> = [];
  try {
    postSlugs = await fetchAllPostSlugs();
  } catch {
    postSlugs = [];
  }

  const postPages: MetadataRoute.Sitemap = postSlugs.map((p) => ({
    url: `${SITE_URL}/tin-tuc/${p.slug}`,
    lastModified: p.publishedAt ? new Date(p.publishedAt) : now,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  let mp3Slugs: string[] = [];
  try {
    mp3Slugs = await fetchMp3CategorySlugs();
  } catch {
    mp3Slugs = [];
  }

  const mp3Pages: MetadataRoute.Sitemap = mp3Slugs.map((slug) => ({
    url: `${SITE_URL}/phap-am/${slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.75,
  }));

  return [...staticPages, ...centerPages, ...postPages, ...mp3Pages];
}
