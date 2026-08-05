import Link from "next/link";
import { CenterCard } from "../../components/CenterCard";
import { JsonLd } from "../../components/JsonLd";
import { SectionTitle } from "../../components/SectionTitle";
import { fetchCenters } from "../../lib/api";
import { REGION_LABELS, REGION_ORDER, groupByRegion } from "../../lib/centers";
import type { CenterRegion } from "../../lib/types";
import { SITE_NAME, SITE_URL, buildMetadata } from "../../lib/seo";

const FILTERS: { id: "" | CenterRegion; label: string }[] = [
  { id: "", label: "Tất cả" },
  { id: "NAM", label: "Miền Nam" },
  { id: "TRUNG", label: "Miền Trung" },
  { id: "BAC", label: "Miền Bắc" },
  { id: "NUOC_NGOAI", label: "Ngoài Nước" },
];

/** Title Yoast kiểu "Lưu trữ … - Tổ Sư Thiền" */
const REGION_SEO_TITLE: Record<CenterRegion, string> = {
  NAM: "Lưu trữ Miền Nam",
  TRUNG: "Lưu trữ Miền Trung",
  BAC: "Lưu trữ Miền Bắc",
  NUOC_NGOAI: "Lưu trữ Ngoài Nước",
};

type Props = {
  searchParams: Promise<{ region?: string }>;
};

export async function generateMetadata({ searchParams }: Props) {
  const params = await searchParams;
  const regionParam = (params.region || "").toUpperCase();
  const region = REGION_ORDER.includes(regionParam as CenterRegion)
    ? (regionParam as CenterRegion)
    : "";

  const title = region
    ? REGION_SEO_TITLE[region]
    : "Lưu trữ Danh Sách Thiền Đường";
  const path = region ? `/thien-duong?region=${region}` : "/thien-duong";

  return buildMetadata({
    title,
    path,
    type: "article",
    image: "/wp/header-right.png",
    imageWidth: 512,
    imageHeight: 512,
  });
}

export default async function ThienDuongPage({ searchParams }: Props) {
  const params = await searchParams;
  const regionParam = (params.region || "").toUpperCase();
  const region = REGION_ORDER.includes(regionParam as CenterRegion)
    ? (regionParam as CenterRegion)
    : "";

  const centers = await fetchCenters(region || undefined);
  const groups = groupByRegion(centers);
  const sections = region
    ? ([{ key: region, items: groups[region] }] as const)
    : REGION_ORDER.map((key) => ({ key, items: groups[key] })).filter(
        (s) => s.items.length > 0,
      );

  const seoTitle = region
    ? REGION_SEO_TITLE[region]
    : "Lưu trữ Danh Sách Thiền Đường";
  const pageUrl = region
    ? `${SITE_URL}/thien-duong?region=${region}`
    : `${SITE_URL}/thien-duong`;

  const pageLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": pageUrl,
        url: pageUrl,
        name: `${seoTitle} - ${SITE_NAME}`,
        isPartOf: { "@id": `${SITE_URL}/#website` },
        inLanguage: "vi",
        breadcrumb: { "@id": `${pageUrl}#breadcrumb` },
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
            name: "Danh Sách Thiền Đường",
            item: `${SITE_URL}/thien-duong`,
          },
          ...(region
            ? [
                {
                  "@type": "ListItem",
                  position: 3,
                  name: REGION_LABELS[region],
                },
              ]
            : []),
        ],
      },
    ],
  };

  return (
    <div className="mx-auto max-w-[1080px] px-4 py-10 md:py-14">
      <JsonLd data={pageLd} />
      <header className="mb-8 max-w-3xl">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          Danh sách
        </p>
        <h1 className="text-4xl font-bold text-primary md:text-5xl">
          Thiền đường
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted md:text-lg">
          Các điểm tu Tổ Sư Thiền trong nước và ngoài nước — thông tin trụ trì,
          địa chỉ và lịch khóa tu.
        </p>
      </header>

      <div className="mb-10 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const href = f.id ? `/thien-duong?region=${f.id}` : "/thien-duong";
          const active = (region || "") === f.id;
          return (
            <Link
              key={f.label}
              href={href}
              className={`rounded-[10px] px-4 py-2 text-sm font-medium transition ${
                active
                  ? "bg-primary text-white"
                  : "border border-line bg-white text-ink hover:border-primary"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {centers.length === 0 ? (
        <p className="rounded-[10px] border border-line bg-white p-6 text-muted">
          Chưa có thiền đường trong mục này.
        </p>
      ) : (
        <div className="space-y-12">
          {sections.map((section) => (
            <section key={section.key} id={section.key.toLowerCase()}>
              {!region ? (
                <SectionTitle as="h2" variant="bold-center" tone="danger">
                  {REGION_LABELS[section.key]} ({section.items.length})
                </SectionTitle>
              ) : null}
              <div className="mt-8 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
                {section.items.map((c) => (
                  <CenterCard key={c.id} center={c} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
