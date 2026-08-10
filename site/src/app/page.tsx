import Link from "next/link";
import { CenterCard } from "../components/CenterCard";
import { HeroSlider, type Slide } from "../components/HeroSlider";
import { JsonLd } from "../components/JsonLd";
import { Reveal } from "../components/motion/Reveal";
import { SectionTitle } from "../components/SectionTitle";
import { THOI_THO_AU } from "../content/gioi-thieu";
import { fetchCenters } from "../lib/api";
import { fetchZoomRooms } from "../lib/classAnnouncements";
import { REGION_ORDER, groupByRegion } from "../lib/centers";
import {
  HOME_SEO_TITLE,
  SITE_URL,
  absoluteUrl,
  buildMetadata,
} from "../lib/seo";

export const metadata = buildMetadata({
  title: HOME_SEO_TITLE,
  absoluteTitle: true,
  path: "/",
  type: "website",
  image: "/wp/header-right.png",
  imageWidth: 512,
  imageHeight: 512,
});

const SLIDES: Slide[] = [
  {
    src: "/wp/slide-1.png",
    href: "/thien-duong/thien-vien-linh-son-thich-minh-hien-1",
    alt: "Thiền viện Linh Sơn",
  },
  {
    src: "/wp/slide-2.jpg",
    href: "/thien-duong/thien-duong-lieu-quan-1-thich-hue-minh-4",
    alt: "Thiền đường Liễu Quán 1",
  },
  {
    src: "/wp/slide-3.png",
    href: "/thien-duong/thien-vien-duy-luc-thich-nu-phap-ngan-41",
    alt: "Thiền viện Duy Lực",
  },
  {
    src: "/wp/slide-4.png",
    href: "/thien-duong/thien-tu-quy-son-thich-nhut-tay-12",
    alt: "Thiền tự Quy Sơn",
  },
  {
    src: "/wp/slide-5.png",
    href: "/thien-duong/chua-phat-da-thich-thien-chon-15",
    alt: "Chùa Phật Đà",
  },
  {
    src: "/wp/slide-6.png",
    href: "/thien-duong/chua-tam-bao-thich-minh-thien-7",
    alt: "Chùa Tam Bảo",
  },
  {
    src: "/wp/slide-7.png",
    href: "/thien-duong/chua-thien-tri-thich-hue-minh-5",
    alt: "Chùa Thiên Trì",
  },
  {
    src: "/wp/slide-8.png",
    href: "/thien-duong/chua-lien-hoa-thich-duy-tran-3",
    alt: "Chùa Liên Hoa",
  },
];

const REGION_HEADINGS: Record<string, string> = {
  NAM: "Miền Nam",
  TRUNG: "Miền Trung",
  BAC: "Miền Bắc",
  NUOC_NGOAI: "Ngoài Nước",
};

/** Classic homepage copy for the two Zoom rooms (merged by meeting ID). */
const ZOOM_ROOM_COPY: Record<string, string[]> = {
  "8196000378": [
    "Lớp Thiền căn bản tối thứ 7 và lớp chuyên đề Thiền căn bản tối thứ 2 hằng tuần từ 19h00-20h00.",
    "Cách 2: ID: 8196000378; pass: phatphap",
  ],
  "2258212697": [
    "Lớp học Chuyên đề Tổ Sư Thiền tối thứ năm từ 19h00-20h00.",
    "Cách 2: ID: 2258212697; pass: thamthien",
  ],
};

const FALLBACK_ZOOM = [
  {
    href: "https://zoom.us/j/8196000378?pwd=akZVV3p4YmVHSytlcTdQY2wvdTd3QT09",
    meetingId: "8196000378",
    lines: ZOOM_ROOM_COPY["8196000378"],
  },
  {
    href: "https://us02web.zoom.us/j/2258212697?pwd=ckp4bVZNbHhnaWFLb0R1cFNhVEk1UT09",
    meetingId: "2258212697",
    lines: ZOOM_ROOM_COPY["2258212697"],
  },
];

function zoomRoomLines(meetingId: string, pass?: string | null): string[] {
  const known = ZOOM_ROOM_COPY[meetingId];
  if (known) return known;
  return [
    "Phòng học trực tuyến Tổ Sư Thiền.",
    `Cách 2: ID: ${meetingId}${pass ? `; pass: ${pass}` : ""}`,
  ];
}

export default async function HomePage() {
  let centers: Awaited<ReturnType<typeof fetchCenters>> = [];
  let zoomRooms: Awaited<ReturnType<typeof fetchZoomRooms>> = [];
  try {
    [centers, zoomRooms] = await Promise.all([
      fetchCenters(),
      fetchZoomRooms(),
    ]);
  } catch {
    centers = [];
    zoomRooms = [];
  }
  const groups = groupByRegion(centers);

  const homeZoomRooms =
    zoomRooms.length > 0
      ? zoomRooms.map((room) => {
          const meetingId = room.meetingId.replace(/\s/g, "");
          const href =
            room.url ||
            (room.pass
              ? `https://zoom.us/j/${meetingId}?pwd=${encodeURIComponent(room.pass)}`
              : `https://zoom.us/j/${meetingId}`);
          return {
            href,
            meetingId,
            lines: zoomRoomLines(meetingId, room.pass),
          };
        })
      : FALLBACK_ZOOM;

  const homeLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${SITE_URL}/`,
        url: SITE_URL,
        name: HOME_SEO_TITLE,
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
      <div className="mx-auto max-w-[1080px] px-4 animate-fade-up">
        <HeroSlider slides={SLIDES} />
      </div>

      <section className="pb-4">
        <Reveal>
          <SectionTitle>Tiểu sử Hòa thượng Thích Duy Lực</SectionTitle>
        </Reveal>
        <div className="mx-auto mt-8 grid max-w-[1080px] grid-cols-1 items-start gap-8 px-4 md:grid-cols-2 md:gap-10 lg:gap-12">
          <Reveal className="flex w-full justify-center md:justify-end">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/wp/to-su.jpg"
              alt="Hòa thượng Thích Duy Lực"
              width={420}
              height={630}
              loading="lazy"
              decoding="async"
              className="h-auto w-full max-w-full object-contain md:max-w-[100%]"
            />
          </Reveal>
          <Reveal delay={100} className="min-w-0 w-full">
            <div className="space-y-4 text-justify text-[1.125rem] leading-relaxed text-black">
              {THOI_THO_AU.map((p) => (
                <p key={p.slice(0, 24)}>{p}</p>
              ))}
            </div>
            <div className="mt-8 flex justify-center lg:justify-start">
              <Link
                href="/gioi-thieu"
                className="hover-lift inline-flex items-center gap-2 rounded-[11px] bg-success px-6 py-3 text-sm font-bold uppercase tracking-wide text-ink transition hover:brightness-95"
              >
                Xem thêm <span className="text-xs">▾</span>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="py-8">
        <Reveal>
          <SectionTitle tone="danger">Link vào phòng học trực tuyến</SectionTitle>
        </Reveal>
        <div className="mx-auto mt-8 grid max-w-[1080px] gap-8 px-4 md:grid-cols-2">
          {homeZoomRooms.map((room, i) => (
            <Reveal key={room.meetingId} delay={i * 90}>
              <a
                href={room.href}
                target="_blank"
                rel="noreferrer"
                className="group block overflow-hidden"
                aria-label="Vào phòng học Zoom"
              >
                <div className="flex aspect-square w-full items-center justify-center bg-paper-warm transition-transform duration-700 ease-out group-hover:scale-[1.03]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/wp/logo.png"
                    alt="Logo Tổ Sư Thiền"
                    loading="lazy"
                    decoding="async"
                    className="h-auto w-[78%] max-w-[420px] object-contain px-4"
                  />
                </div>
              </a>
              {room.lines.map((line) => (
                <p
                  key={line.slice(0, 28)}
                  className="mt-4 text-center font-bold text-black"
                >
                  {line}
                </p>
              ))}
            </Reveal>
          ))}
        </div>
      </section>

      <section className="py-6">
        <Reveal>
          <SectionTitle as="h1" tone="danger-dark">
            Danh sách thiền đường
          </SectionTitle>
        </Reveal>

        {centers.length === 0 ? (
          <p className="mx-auto mt-8 max-w-[1080px] px-4 text-center text-muted">
            Chưa tải được danh sách thiền đường.
          </p>
        ) : (
          REGION_ORDER.filter((region) => groups[region].length > 0).map(
            (region) => (
              <div key={region} className="mt-10">
                <Reveal>
                  <SectionTitle as="h3" variant="bold-center" tone="danger">
                    {REGION_HEADINGS[region]}
                  </SectionTitle>
                </Reveal>
                <div className="mx-auto mt-8 grid max-w-[1080px] gap-x-8 gap-y-10 px-4 md:grid-cols-2 lg:grid-cols-3">
                  {groups[region].map((center, i) => (
                    <Reveal key={center.id} delay={(i % 3) * 70} variant="zoom">
                      <CenterCard
                        center={center}
                        showProvince={region !== "NUOC_NGOAI"}
                      />
                    </Reveal>
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
