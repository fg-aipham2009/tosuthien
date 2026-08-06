import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "../../../components/JsonLd";
import {
  fetchPostBySlug,
  fetchAllPostSlugs,
  formatPostDate,
  stripHtml,
} from "../../../lib/posts";
import {
  SITE_NAME,
  SITE_URL,
  absoluteUrl,
  buildMetadata,
  excerptForOg,
} from "../../../lib/seo";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const slugs = await fetchAllPostSlugs();
  return slugs.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const post = await fetchPostBySlug(slug);
  if (!post) {
    return buildMetadata({
      title: "Không tìm thấy tin",
      path: `/tin-tuc/${slug}`,
      noIndex: true,
    });
  }

  const description =
    post.seoDescription ||
    excerptForOg(stripHtml(post.excerpt || post.content));

  return buildMetadata({
    title: post.seoTitle || post.title,
    absoluteTitle: Boolean(post.seoTitle),
    description,
    path: `/tin-tuc/${post.slug}`,
    type: "article",
    image: post.coverImageUrl,
    publishedTime: post.publishedAt || post.createdAt,
    modifiedTime: post.updatedAt || post.publishedAt || post.createdAt,
  });
}

export default async function TinTucDetailPage({ params }: Props) {
  const { slug } = await params;
  const post = await fetchPostBySlug(slug);
  if (!post) notFound();

  const pageUrl = absoluteUrl(`/tin-tuc/${post.slug}`);
  const description =
    post.seoDescription ||
    excerptForOg(stripHtml(post.excerpt || post.content));
  const date = formatPostDate(post.publishedAt);

  const pageLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "NewsArticle",
        "@id": `${pageUrl}#article`,
        headline: post.title,
        description,
        datePublished: post.publishedAt || post.createdAt,
        dateModified: post.updatedAt || post.publishedAt || post.createdAt,
        author: post.authorName
          ? { "@type": "Person", name: post.authorName }
          : { "@type": "Organization", name: SITE_NAME },
        image: post.coverImageUrl ? [post.coverImageUrl] : undefined,
        mainEntityOfPage: pageUrl,
        isPartOf: { "@id": `${SITE_URL}/#website` },
        inLanguage: "vi",
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${pageUrl}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Trang chủ",
            item: SITE_URL,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Tin Tức",
            item: `${SITE_URL}/tin-tuc`,
          },
          { "@type": "ListItem", position: 3, name: post.title },
        ],
      },
    ],
  };

  return (
    <article className="mx-auto w-full max-w-[1080px] px-[15px] py-8 text-base text-black animate-fade-up">
      <JsonLd data={pageLd} />

      <nav className="mb-6 text-sm text-muted">
        <Link href="/" className="link-underline hover:text-primary">
          Trang chủ
        </Link>
        <span className="mx-2">/</span>
        <Link href="/tin-tuc" className="link-underline hover:text-primary">
          Tin Tức
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink">{post.title}</span>
      </nav>

      {post.categories?.length ? (
        <p className="mb-2 text-center text-sm font-semibold uppercase tracking-wide text-muted">
          {post.categories.map((c) => c.name).join(", ")}
        </p>
      ) : null}

      <h1 className="mb-3 text-center text-[1.7rem] leading-[1.3] font-bold text-black">
        {post.title}
      </h1>

      {(date || post.authorName) && (
        <p className="mb-8 text-center text-sm uppercase text-muted">
          {date ? (
            <>
              Đăng vào{" "}
              <time dateTime={post.publishedAt || undefined}>{date}</time>
            </>
          ) : null}
          {date && post.authorName ? " " : null}
          {post.authorName ? <>bởi {post.authorName}</> : null}
        </p>
      )}

      {post.content ? (
        <div
          className="post-content [&_h1]:mb-[20.8px] [&_h1]:text-base [&_h1]:leading-[1.6] [&_h1]:font-normal [&_img]:mx-auto [&_img]:my-4 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-[10px] [&_p]:mb-[20.8px] [&_a]:text-primary [&_a]:underline"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />
      ) : post.coverImageUrl ? (
        <figure className="mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.coverImageUrl}
            alt={post.title}
            className="mx-auto max-h-[520px] w-auto max-w-full rounded-[10px] object-contain"
          />
        </figure>
      ) : null}

      <p className="mt-10 border-t border-line pt-6 text-center">
        <Link href="/tin-tuc" className="font-semibold text-primary hover:underline">
          ← Về danh sách tin tức
        </Link>
      </p>
    </article>
  );
}
