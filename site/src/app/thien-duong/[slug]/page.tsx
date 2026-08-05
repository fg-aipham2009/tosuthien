import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "../../../components/JsonLd";
import { fetchCenterBySlug, fetchCenters } from "../../../lib/api";
import {
  abbotLine,
  addressLine,
  courseScheduleLabel,
  courseTypeLabel,
  galleryUrls,
  regionLabel,
} from "../../../lib/centers";
import {
  SITE_NAME,
  SITE_URL,
  buildMetadata,
  excerptForOg,
} from "../../../lib/seo";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  try {
    const centers = await fetchCenters();
    return centers
      .filter((c) => c.slug)
      .map((c) => ({ slug: c.slug as string }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const center = await fetchCenterBySlug(slug);
  if (!center) return buildMetadata({ title: "Không tìm thấy", path: `/thien-duong/${slug}`, noIndex: true });

  // Yoast kiểu: "Chùa Thiên Trì – Bình Chánh - Tổ Sư Thiền"
  const headline = center.province
    ? `${center.templeName} – ${center.province}`
    : center.templeName;

  return buildMetadata({
    title: headline,
    path: `/thien-duong/${slug}`,
    type: "article",
    description: excerptForOg(
      center.detailContent || addressLine(center) || `Thiền đường ${center.templeName}`,
    ),
    image: center.mainImageUrl,
  });
}

export default async function CenterDetailPage({ params }: Props) {
  const { slug } = await params;
  const center = await fetchCenterBySlug(slug);
  if (!center) notFound();

  const abbot = abbotLine(center);
  const address = addressLine(center);
  const gallery = galleryUrls(center);
  const courses = [...(center.courses ?? [])].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
  );

  const headline = center.province
    ? `${center.templeName} – ${center.province}`
    : center.templeName;
  const pageUrl = `${SITE_URL}/thien-duong/${slug}`;
  const desc = excerptForOg(
    center.detailContent || addressLine(center) || `Thiền đường ${center.templeName}`,
  );

  const pageLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${pageUrl}#article`,
        isPartOf: { "@id": pageUrl },
        headline,
        description: desc,
        mainEntityOfPage: { "@id": pageUrl },
        publisher: { "@id": `${SITE_URL}/#organization` },
        image: center.mainImageUrl
          ? { "@id": `${pageUrl}#primaryimage` }
          : undefined,
        thumbnailUrl: center.mainImageUrl || undefined,
        articleSection: [regionLabel(center.region)],
        inLanguage: "vi",
      },
      {
        "@type": "WebPage",
        "@id": pageUrl,
        url: pageUrl,
        name: `${headline} - ${SITE_NAME}`,
        isPartOf: { "@id": `${SITE_URL}/#website` },
        primaryImageOfPage: center.mainImageUrl
          ? { "@id": `${pageUrl}#primaryimage` }
          : undefined,
        inLanguage: "vi",
        breadcrumb: { "@id": `${pageUrl}#breadcrumb` },
      },
      ...(center.mainImageUrl
        ? [
            {
              "@type": "ImageObject",
              inLanguage: "vi",
              "@id": `${pageUrl}#primaryimage`,
              url: center.mainImageUrl,
              contentUrl: center.mainImageUrl,
            },
          ]
        : []),
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
            name: "Danh Sách Thiền Đường",
            item: `${SITE_URL}/thien-duong`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: regionLabel(center.region),
            item: `${SITE_URL}/thien-duong?region=${center.region ?? ""}`,
          },
          { "@type": "ListItem", position: 4, name: center.templeName },
        ],
      },
      {
        "@type": "Place",
        "@id": `${pageUrl}#place`,
        name: center.templeName,
        address: {
          "@type": "PostalAddress",
          streetAddress: center.address || undefined,
          addressLocality: center.province || undefined,
          addressCountry: center.countryCode || "VN",
        },
        geo:
          center.lat != null && center.lng != null
            ? {
                "@type": "GeoCoordinates",
                latitude: center.lat,
                longitude: center.lng,
              }
            : undefined,
        telephone: center.phone || undefined,
      },
    ],
  };

  return (
    <article className="mx-auto max-w-5xl px-4 py-10 md:px-6 md:py-14">
      <JsonLd data={pageLd} />
      <nav className="mb-6 text-sm text-muted">
        <Link href="/thien-duong" className="hover:text-primary">
          Thiền đường
        </Link>
        <span className="mx-2">/</span>
        <span>{regionLabel(center.region)}</span>
      </nav>

      <header className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          {regionLabel(center.region)}
          {center.province ? ` · ${center.province}` : ""}
        </p>
        <h1 className="text-4xl font-bold text-primary md:text-5xl">
          {center.templeName}
        </h1>
        {abbot ? <p className="mt-3 text-lg text-muted">{abbot}</p> : null}
      </header>

      {center.mainImageUrl ? (
        <div className="mb-8 overflow-hidden rounded-[10px] border border-line bg-paper-warm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={center.mainImageUrl}
            alt={center.templeName}
            className="max-h-[480px] w-full rounded-none object-cover"
          />
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[1.4fr_0.9fr]">
        <div className="space-y-8">
          {center.detailContent ? (
            <section>
              <h2 className="mb-3 text-2xl font-bold text-primary-deep">
                Giới thiệu
              </h2>
              <div className="whitespace-pre-wrap rounded-[10px] border border-line bg-white p-5 text-justify text-[1.05rem] leading-8 text-black md:p-6">
                {center.detailContent}
              </div>
            </section>
          ) : null}

          {gallery.length > 0 ? (
            <section>
              <h2 className="mb-3 text-2xl font-bold text-primary-deep">
                Hình ảnh
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {gallery.map((url) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={url}
                    src={url}
                    alt=""
                    className="aspect-[4/3] w-full rounded-[10px] border border-line object-cover"
                  />
                ))}
              </div>
            </section>
          ) : null}

          {courses.length > 0 ? (
            <section>
              <h2 className="mb-3 text-2xl font-bold text-primary-deep">
                Khóa tu
              </h2>
              <ul className="space-y-3">
                {courses.map((course) => (
                  <li
                    key={course.id}
                    className="rounded-[10px] border border-line bg-white px-4 py-3"
                  >
                    <p className="font-medium text-ink">
                      {courseTypeLabel(course)}
                    </p>
                    <p className="text-sm text-muted">
                      {courseScheduleLabel(course)}
                    </p>
                    {course.description ? (
                      <p className="mt-1 text-sm text-ink/80">
                        {course.description}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="h-fit space-y-4 rounded-[10px] border border-line bg-white p-5 lg:sticky lg:top-24">
          <h2 className="text-xl font-bold text-primary">Thông tin liên hệ</h2>
          {address ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Địa chỉ
              </p>
              <p className="mt-1 text-sm leading-relaxed">{address}</p>
            </div>
          ) : null}
          {center.phone ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Điện thoại
              </p>
              <a
                href={`tel:${center.phone.replace(/\s+/g, "")}`}
                className="mt-1 block text-sm font-medium text-primary hover:underline"
              >
                {center.phone}
              </a>
            </div>
          ) : null}
          {center.activityHours ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Thời khóa
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                {center.activityHours}
              </p>
            </div>
          ) : null}
          {center.googleMapsUrl ? (
            <a
              href={center.googleMapsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex rounded-[11px] bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-deep"
            >
              Xem bản đồ
            </a>
          ) : null}
        </aside>
      </div>
    </article>
  );
}
