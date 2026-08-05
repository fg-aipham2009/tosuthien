import Link from "next/link";
import { CenterCard } from "../components/CenterCard";
import { HeroSlider, type Slide } from "../components/HeroSlider";
import { JsonLd } from "../components/JsonLd";
import { SectionTitle } from "../components/SectionTitle";
import { THOI_THO_AU } from "../content/gioi-thieu";
import { fetchCenters } from "../lib/api";
import { REGION_ORDER, groupByRegion } from "../lib/centers";
import {
  SITE_NAME,
  SITE_URL,
  absoluteUrl,
  buildMetadata,
} from "../lib/seo";

export const metadata = buildMetadata({
  title: `Trang Chủ - ${SITE_NAME}`,
  absoluteTitle: true,
  path: "/",
  type: "website",
  image: "/wp/header-right.png",
  imageWidth: 512,
  imageHeight: 512,
});

const SLIDES: Slide[] = [
  { src: "/wp/slide-1.png", href: "/thien-duong", alt: "Thiền viện Linh Sơn" },
  { src: "/wp/slide-2.jpg", href: "/thien-duong", alt: "Thiền đường Liễu Quán 1" },
  { src: "/wp/slide-3.png", href: "/thien-duong", alt: "Thiền viện Duy Lực" },
  { src: "/wp/slide-4.png", href: "/thien-duong", alt: "Thiền tự Quy Sơn" },
  { src: "/wp/slide-5.png", href: "/thien-duong", alt: "Chùa Phật Đà" },
  { src: "/wp/slide-6.png", href: "/thien-duong", alt: "Chùa Tam Bảo" },
  { src: "/wp/slide-7.png", href: "/thien-duong", alt: "Chùa Thiên Trì" },
  { src: "/wp/slide-8.png", href: "/thien-duong", alt: "Chùa Liên Hoa" },
];

const ZOOM_ROOMS = [
  {
    href: "https://zoom.us/j/8196000378?pwd=akZVV3p4YmVHSytlcTdQY2wvdTd3QT09",
    lines: [
      "Lớp Thiền căn bản tối thứ 7 và lớp chuyên đề Thiền căn bản tối thứ 2 hằng tuần từ 19h00-20h00. Kính mời quý vị bấm vào hình trên là vào lớp học hoặc",
      "Cách 2: ID: 8196000378; pass: phatphap",
    ],
  },
  {
    href: "https://us02web.zoom.us/j/2258212697?pwd=ckp4bVZNbHhnaWFLb0R1cFNhVEk1UT09",
    lines: [
      "Lớp học Chuyên đề Tổ Sư Thiền tối thứ năm từ 19h00-20h00. Quý vị tham gia lớp học bấm vào hình trên này là vào lớp học hoặc",
      "Cách 2: ID: 2258212697; pass: thamthien",
    ],
  },
];

const REGION_HEADINGS: Record<string, string> = {
  NAM: "Miền Nam",
  TRUNG: "Miền Trung",
  BAC: "Miền Bắc",
  NUOC_NGOAI: "Ngoài Nước",
};

export default async function HomePage() {
  let centers: Awaited<ReturnType<typeof fetchCenters>> = [];
  try {
    centers = await fetchCenters();
  } catch {
    centers = [];
  }
  const groups = groupByRegion(centers);

  const homeLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${SITE_URL}/`,
        url: SITE_URL,
        name: `Trang Chủ - ${SITE_NAME}`,
        isPartOf: { "@id": `${SITE_URL}/#website` },
        about: { "@id": `${SITE_URL}/#organization` },
        primaryImageOfPage: { "@id": `${SITE_URL}/#primaryimage` },
        image: { "@id": `${SITE_URL}/#primaryimage` },
        thumbnailUrl: absoluteUrl("/wp/header-right.png"),
        inLanguage: "vi",
        breadcrumb: { "@id": `${SITE_URL}/#breadcrumb` },
      },
      {
        "@type": "ImageObject",
        inLanguage: "vi",
        "@id": `${SITE_URL}/#primaryimage`,
        url: absoluteUrl("/wp/header-right.png"),
        contentUrl: absoluteUrl("/wp/header-right.png"),
        width: 512,
        height: 512,
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${SITE_URL}/#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Trang chủ" },
        ],
      },
    ],
  };

  return (
    <div className="py-8">
      <JsonLd data={homeLd} />
      <div className="mx-auto max-w-[1080px] px-4">
        <HeroSlider slides={SLIDES} />
      </div>

      <section className="mx-auto max-w-[1080px] px-4 pb-4">
        <div className="flex flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/wp/to-su.jpg"
            alt="Hòa thượng Thích Duy Lực"
            className="mb-6 w-1/2 max-w-[420px]"
          />
          <SectionTitle className="!px-0">
            Tiểu sử Hòa thượng Thích Duy Lực
          </SectionTitle>
          <div className="mt-6 space-y-4 text-justify text-[1.05rem] leading-relaxed text-black">
            {THOI_THO_AU.map((p) => (
              <p key={p.slice(0, 24)}>{p}</p>
            ))}
          </div>
          <Link
            href="/gioi-thieu"
            className="mt-8 inline-flex items-center gap-2 rounded-[11px] bg-success px-6 py-3 text-[13px] font-bold uppercase tracking-wide text-ink transition hover:brightness-95"
          >
            Xem thêm <span className="text-[10px]">▾</span>
          </Link>
        </div>
      </section>

      <section className="py-8">
        <SectionTitle tone="danger">Link vào phòng học trực tuyến</SectionTitle>
        <div className="mx-auto mt-8 grid max-w-[1080px] gap-8 px-4 md:grid-cols-2">
          {ZOOM_ROOMS.map((room) => (
            <div key={room.href}>
              <a href={room.href} target="_blank" rel="noreferrer" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/wp/zoom.jpg"
                  alt="Phòng học trực tuyến"
                  className="w-full transition-transform duration-500 hover:scale-[1.03]"
                />
              </a>
              {room.lines.map((line) => (
                <p
                  key={line.slice(0, 20)}
                  className="mt-4 text-center font-bold text-black"
                >
                  {line}
                </p>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="py-6">
        <SectionTitle as="h1" tone="danger-dark">
          Danh sách thiền đường
        </SectionTitle>

        {centers.length === 0 ? (
          <p className="mx-auto mt-8 max-w-[1080px] px-4 text-center text-muted">
            Chưa tải được danh sách thiền đường.
          </p>
        ) : (
          REGION_ORDER.filter((region) => groups[region].length > 0).map(
            (region) => (
              <div key={region} className="mt-10">
                <SectionTitle as="h3" variant="bold-center" tone="danger">
                  {REGION_HEADINGS[region]}
                </SectionTitle>
                <div className="mx-auto mt-8 grid max-w-[1080px] gap-x-8 gap-y-10 px-4 md:grid-cols-2 lg:grid-cols-3">
                  {groups[region].map((center) => (
                    <CenterCard
                      key={center.id}
                      center={center}
                      showProvince={region !== "NUOC_NGOAI"}
                    />
                  ))}
                </div>
              </div>
            ),
          )
        )}
      </section>
    </div>
  );
}
