import Link from "next/link";
import { JsonLd } from "../../components/JsonLd";
import { Reveal } from "../../components/motion/Reveal";
import { SectionTitle } from "../../components/SectionTitle";
import {
  fetchPosts,
  formatPostDate,
  groupPostsByMonth,
  stripHtml,
} from "../../lib/posts";
import {
  SITE_NAME,
  SITE_URL,
  buildMetadata,
  excerptForOg,
} from "../../lib/seo";
import { preferFullPostImageUrl } from "../../lib/postContent";

export const metadata = buildMetadata({
  title: "Lưu trữ Tin Tức",
  path: "/tin-tuc",
  type: "article",
  description:
    "Tin tức và thông báo Tông Phong Tổ Sư Thiền — tosuthien.com.",
  image: "/wp/header-right.png",
  imageWidth: 512,
  imageHeight: 512,
});

type Props = {
  searchParams: Promise<{ page?: string }>;
};

const PAGE_SIZE = 12;

export default async function TinTucPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);
  const data = await fetchPosts({
    page,
    limit: PAGE_SIZE,
    category: "tin-tuc",
  });
  const groups = groupPostsByMonth(data.items);

  const pageLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${SITE_URL}/tin-tuc`,
        url: `${SITE_URL}/tin-tuc`,
        name: `Lưu trữ Tin Tức - ${SITE_NAME}`,
        isPartOf: { "@id": `${SITE_URL}/#website` },
        inLanguage: "vi",
        breadcrumb: { "@id": `${SITE_URL}/tin-tuc#breadcrumb` },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${SITE_URL}/tin-tuc#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Trang chủ",
            item: SITE_URL,
          },
          { "@type": "ListItem", position: 2, name: "Tin Tức" },
        ],
      },
    ],
  };

  return (
    <div className="py-8">
      <JsonLd data={pageLd} />
      <SectionTitle as="h1" variant="bold-center" size="lg">
        Tin Tức
      </SectionTitle>

      <div className="mx-auto max-w-[1080px] px-[15px]">
        {data.items.length === 0 ? (
          <p className="py-16 text-center text-base text-ink">
            Chưa có tin tức.
          </p>
        ) : (
          <div className="space-y-12">
            {groups.map((group) => (
              <section
                key={group.key}
                id={group.key !== "unknown" ? `thang-${group.key}` : undefined}
                aria-labelledby={`heading-${group.key}`}
              >
                <h2
                  id={`heading-${group.key}`}
                  className="mb-6 border-b border-line pb-2 text-2xl font-bold tracking-tight text-black md:text-[1.75rem]"
                >
                  {group.label}
                </h2>
                <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
                  {group.items.map((post, i) => {
                    const excerpt = excerptForOg(
                      stripHtml(post.excerpt || post.content),
                      140,
                    );
                    const date = formatPostDate(post.publishedAt);
                    const coverSrc =
                      preferFullPostImageUrl(post.coverImageUrl) ||
                      "/wp/header-right.png";
                    return (
                      <Reveal key={post.id} delay={(i % 3) * 60}>
                      <article className="flex flex-col">
                        <Link
                          href={`/tin-tuc/${post.slug}`}
                          className="group block overflow-hidden rounded-[10px] border border-line bg-paper-warm"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={coverSrc}
                            alt={post.title}
                            className="aspect-[4/3] w-full rounded-none object-contain p-1 transition duration-500 ease-out group-hover:opacity-95"
                          />
                        </Link>
                        <div className="mt-4 flex flex-1 flex-col">
                          {date ? (
                            <time className="mb-1 flex items-center gap-1.5 text-sm text-muted">
                              <svg viewBox="0 0 24 24" aria-hidden className="size-4 shrink-0 text-primary/80" fill="none">
                                <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.75" />
                                <path d="M8 3v4M16 3v4M3 10h18" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                              </svg>
                              {date}
                            </time>
                          ) : null}
                          <h3 className="text-xl leading-snug font-bold tracking-tight text-black md:text-[1.4rem]">
                            <Link
                              href={`/tin-tuc/${post.slug}`}
                              className="link-underline transition-colors hover:text-primary"
                            >
                              {post.title}
                            </Link>
                          </h3>
                          {excerpt ? (
                            <p className="mt-2 line-clamp-3 text-base leading-6 text-ink">
                              {excerpt}
                            </p>
                          ) : null}
                          <Link
                            href={`/tin-tuc/${post.slug}`}
                            className="mt-3 text-sm font-semibold text-primary link-underline"
                          >
                            Xem tiếp →
                          </Link>
                        </div>
                      </article>
                      </Reveal>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        {data.totalPages > 1 ? (
          <nav
            className="mt-12 flex flex-wrap items-center justify-center gap-2"
            aria-label="Phân trang tin tức"
          >
            {page > 1 ? (
              <Link
                href={page === 2 ? "/tin-tuc" : `/tin-tuc?page=${page - 1}`}
                className="rounded border border-line px-3 py-1.5 text-sm text-black hover:bg-paper"
              >
                « Trước
              </Link>
            ) : null}
            {Array.from({ length: data.totalPages }, (_, i) => i + 1)
              .filter((p) => {
                if (data.totalPages <= 7) return true;
                return (
                  p === 1 ||
                  p === data.totalPages ||
                  Math.abs(p - page) <= 2
                );
              })
              .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                if (idx > 0) {
                  const prev = arr[idx - 1];
                  if (typeof prev === "number" && p - prev > 1) acc.push("…");
                }
                acc.push(p);
                return acc;
              }, [])
              .map((p, idx) =>
                p === "…" ? (
                  <span key={`e${idx}`} className="px-1 text-muted">
                    …
                  </span>
                ) : (
                  <Link
                    key={p}
                    href={p === 1 ? "/tin-tuc" : `/tin-tuc?page=${p}`}
                    className={`min-w-9 rounded px-3 py-1.5 text-center text-sm ${
                      p === page
                        ? "bg-primary text-white"
                        : "border border-line text-black hover:bg-paper"
                    }`}
                    aria-current={p === page ? "page" : undefined}
                  >
                    {p}
                  </Link>
                ),
              )}
            {page < data.totalPages ? (
              <Link
                href={`/tin-tuc?page=${page + 1}`}
                className="rounded border border-line px-3 py-1.5 text-sm text-black hover:bg-paper"
              >
                Sau »
              </Link>
            ) : null}
          </nav>
        ) : null}

        <p className="mt-6 text-center text-sm text-muted">
          {data.total > 0
            ? `Hiển thị trang ${data.page}/${data.totalPages} · ${data.total} tin`
            : null}
        </p>
      </div>
    </div>
  );
}
