import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CenterGallery } from "../../../components/CenterGallery";
import { JsonLd } from "../../../components/JsonLd";
import { Reveal } from "../../../components/motion/Reveal";
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
  if (!center)
    return buildMetadata({
      title: "Không tìm thấy",
      path: `/thien-duong/${slug}`,
      noIndex: true,
    });

  const headline = center.province
    ? `${center.templeName} – ${center.province}`
    : center.templeName;

  return buildMetadata({
    title: headline,
    path: `/thien-duong/${slug}`,
    type: "article",
    description: excerptForOg(
      center.detailContent ||
        addressLine(center) ||
        `Thiền đường ${center.templeName}`,
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
    center.detailContent ||
      addressLine(center) ||
      `Thiền đường ${center.templeName}`,
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
    <article className="pb-16 md:pb-24">
      <JsonLd data={pageLd} />

      {/* Full-bleed hero */}
      {center.mainImageUrl ? (
        <div className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 overflow-hidden">
          <div className="relative aspect-[16/10] max-h-[min(72vh,620px)] w-full min-h-[240px] overflow-hidden bg-paper-warm md:aspect-[21/9]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={center.mainImageUrl}
              alt={center.templeName}
              className="animate-ken-burns h-full w-full rounded-none object-cover"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#1a0f0a]/55 via-[#1a0f0a]/10 to-transparent" />
          </div>
        </div>
      ) : null}

      <div className="mx-auto max-w-5xl px-4 md:px-6">
        <nav className="animate-fade-up pt-6 text-sm text-muted md:pt-8">
          <Link href="/thien-duong" className="link-underline hover:text-primary">
            Thiền đường
          </Link>
          <span className="mx-2 text-line">/</span>
          <Link
            href={`/thien-duong?region=${center.region ?? ""}`}
            className="link-underline hover:text-primary"
          >
            {regionLabel(center.region)}
          </Link>
        </nav>

        <header className="animate-fade-up mt-6 max-w-3xl md:mt-8" style={{ animationDelay: "80ms" }}>
          <p className="mb-3 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-accent">
            {regionLabel(center.region)}
            {center.province ? ` · ${center.province}` : ""}
          </p>
          <h1 className="text-[2rem] font-bold leading-[1.15] tracking-tight text-primary md:text-5xl">
            {center.templeName}
          </h1>
          <div className="ornament-line mt-5" aria-hidden />
          {abbot ? (
            <p className="mt-5 text-lg leading-relaxed text-muted md:text-xl">
              {abbot}
            </p>
          ) : null}
        </header>

        <div className="mt-10 grid gap-12 lg:mt-14 lg:grid-cols-[minmax(0,1.45fr)_minmax(260px,0.85fr)] lg:gap-14">
          <div className="min-w-0 space-y-12">
            {center.detailContent ? (
              <Reveal>
                <section>
                  <h2 className="mb-4 text-xl font-bold tracking-wide text-primary-deep md:text-2xl">
                    Giới thiệu
                  </h2>
                  <div className="whitespace-pre-wrap text-justify text-[1.125rem] leading-[1.85] text-ink">
                    {center.detailContent}
                  </div>
                </section>
              </Reveal>
            ) : null}

            {gallery.length > 0 ? (
              <section>
                <Reveal>
                  <h2 className="mb-5 text-xl font-bold tracking-wide text-primary-deep md:text-2xl">
                    Hình ảnh
                  </h2>
                </Reveal>
                <CenterGallery urls={gallery} templeName={center.templeName} />
              </section>
            ) : null}

            {courses.length > 0 ? (
              <Reveal delay={80}>
                <section>
                  <h2 className="mb-5 text-xl font-bold tracking-wide text-primary-deep md:text-2xl">
                    Khóa tu
                  </h2>
                  <ul className="divide-y divide-line border-y border-line">
                    {courses.map((course) => (
                      <li key={course.id} className="py-4 first:pt-5 last:pb-5">
                        <p className="font-semibold text-ink">
                          {courseTypeLabel(course)}
                        </p>
                        <p className="mt-1 text-sm text-muted">
                          {courseScheduleLabel(course)}
                        </p>
                        {course.description ? (
                          <p className="mt-2 text-sm leading-relaxed text-ink/80">
                            {course.description}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </section>
              </Reveal>
            ) : null}
          </div>

          <Reveal delay={120} className="lg:pt-1">
            <aside className="relative overflow-hidden border border-line/80 bg-white/70 p-6 backdrop-blur-sm lg:sticky lg:top-24">
              <div
                className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gold/15 blur-2xl"
                aria-hidden
              />
              <h2 className="relative text-lg font-bold text-primary">
                Thông tin liên hệ
              </h2>
              <div className="relative mt-5 space-y-5">
                {address ? (
                  <div>
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted">
                      Địa chỉ
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink">
                      {address}
                    </p>
                  </div>
                ) : null}
                {center.phone ? (
                  <div>
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted">
                      Điện thoại
                    </p>
                    <a
                      href={`tel:${center.phone.replace(/\s+/g, "")}`}
                      className="link-underline mt-1.5 inline-block text-sm font-semibold text-primary"
                    >
                      {center.phone}
                    </a>
                  </div>
                ) : null}
                {center.activityHours ? (
                  <div>
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted">
                      Thời khóa
                    </p>
                    <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-ink">
                      {center.activityHours}
                    </p>
                  </div>
                ) : null}
              </div>
              {center.googleMapsUrl ? (
                <a
                  href={center.googleMapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hover-lift relative mt-7 inline-flex w-full items-center justify-center bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-deep"
                >
                  Xem bản đồ
                </a>
              ) : null}
            </aside>
          </Reveal>
        </div>

        <Reveal className="mt-14 border-t border-line pt-8">
          <Link
            href="/thien-duong"
            className="link-underline text-sm font-medium text-muted hover:text-primary"
          >
            ← Về danh sách thiền đường
          </Link>
        </Reveal>
      </div>
    </article>
  );
}
