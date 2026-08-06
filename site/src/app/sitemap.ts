import type { MetadataRoute } from "next";
import { fetchCenters } from "../lib/api";
import { fetchAllPostSlugs } from "../lib/posts";
import { SITE_URL } from "../lib/seo";

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

  return [...staticPages, ...centerPages, ...postPages];
}
