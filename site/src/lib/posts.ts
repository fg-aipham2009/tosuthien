import { API_BASE } from "./api";

export type PostCategory = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  sortOrder: number;
};

export type PostImage = {
  id: string;
  role: string;
  url: string;
  altText?: string | null;
  caption?: string | null;
  sortOrder: number;
};

export type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  content?: string | null;
  coverImageUrl?: string | null;
  sourceUrl?: string | null;
  authorName?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  publishedAt?: string | null;
  isPinned: boolean;
  sortOrder: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt?: string;
  categories: PostCategory[];
  images: PostImage[];
};

export type PaginatedPosts = {
  items: Post[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

const REVALIDATE = 300;

export function stripHtml(html?: string | null): string {
  if (!html) return "";
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatPostDate(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export type PostTimeGroup = {
  key: string;
  label: string;
  items: Post[];
};

function postSortInstant(post: Post): Date | null {
  const raw = post.publishedAt || post.createdAt;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function monthGroupKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function formatMonthGroupLabel(key: string): string {
  if (key === "unknown") return "Chưa rõ ngày đăng";
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  const label = d.toLocaleDateString("vi-VN", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Nhóm bài đã sort theo thời gian — mỗi nhóm một tháng (mới → cũ). */
export function groupPostsByMonth(posts: Post[]): PostTimeGroup[] {
  const groups: PostTimeGroup[] = [];
  for (const post of posts) {
    const instant = postSortInstant(post);
    const key = instant ? monthGroupKey(instant) : "unknown";
    const last = groups[groups.length - 1];
    if (last?.key === key) {
      last.items.push(post);
    } else {
      groups.push({
        key,
        label: formatMonthGroupLabel(key),
        items: [post],
      });
    }
  }
  return groups;
}

export async function fetchPosts(params?: {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
}): Promise<PaginatedPosts> {
  const empty: PaginatedPosts = {
    items: [],
    total: 0,
    page: params?.page ?? 1,
    limit: params?.limit ?? 12,
    totalPages: 0,
  };

  try {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.category) qs.set("category", params.category);
    if (params?.search) qs.set("search", params.search);
    const res = await fetch(`${API_BASE}/posts?${qs.toString()}`, {
      next: { revalidate: REVALIDATE },
    });
    if (!res.ok) return empty;
    return res.json();
  } catch {
    return empty;
  }
}

export async function fetchPostBySlug(slug: string): Promise<Post | null> {
  try {
    const res = await fetch(
      `${API_BASE}/posts/slug/${encodeURIComponent(slug)}`,
      { next: { revalidate: REVALIDATE } },
    );
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/** Paginate all published posts for sitemap (best-effort). */
export async function fetchAllPostSlugs(): Promise<
  { slug: string; publishedAt?: string | null }[]
> {
  const out: { slug: string; publishedAt?: string | null }[] = [];
  let page = 1;
  const limit = 100;
  for (;;) {
    const batch = await fetchPosts({ page, limit, category: "tin-tuc" });
    for (const item of batch.items) {
      out.push({ slug: item.slug, publishedAt: item.publishedAt });
    }
    if (!batch.items.length || page >= batch.totalPages) break;
    page += 1;
    if (page > 50) break;
  }
  return out;
}
