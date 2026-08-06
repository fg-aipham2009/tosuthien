import Link from "next/link";
import { JsonLd } from "../../components/JsonLd";
import { SectionTitle } from "../../components/SectionTitle";
import { fetchCenterBySlug } from "../../lib/api";
import type { Center } from "../../lib/types";
import { SITE_NAME, SITE_URL, buildMetadata } from "../../lib/seo";

export const metadata = buildMetadata({
  title: "Liên Hệ",
  path: "/lien-he",
  type: "article",
  image: "/wp/header-right.png",
  imageWidth: 512,
  imageHeight: 512,
});

const TOA_SOAN_SLUG = "chua-thien-tri-thich-hue-minh-5";
const VAN_PHONG_SLUG = "chua-phat-da-thich-thien-chon-15";

const SOCIAL = [
  {
    label: "Youtube Tông Phong Tổ Sư Thiền",
    href: "https://www.youtube.com/c/TôngPhongTổSưThiền",
  },
  { label: "TikTok", href: "https://www.tiktok.com/@tongphongtosuthien" },
  { label: "FanPage Facebook", href: "https://www.facebook.com/Nhohoivanhin/" },
];

function mapEmbed(center: Center | null): string | null {
  if (!center?.lat || !center?.lng) return null;
  return `https://www.google.com/maps?q=${center.lat},${center.lng}&hl=vi&z=16&output=embed`;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-line py-2.5 last:border-0 sm:flex-row sm:gap-3">
      <span className="w-[150px] shrink-0 text-sm font-semibold uppercase tracking-wide text-primary">
        {label}
      </span>
      <span className="text-base leading-7 text-black">{children}</span>
    </div>
  );
}

function Card({
  title,
  children,
  embed,
  mapsUrl,
}: {
  title: string;
  children: React.ReactNode;
  embed: string | null;
  mapsUrl?: string | null;
}) {
  return (
    <section className="overflow-hidden rounded-[10px] border border-line">
      <h2 className="bg-primary px-5 py-3 text-base font-bold uppercase tracking-wide text-white">
        {title}
      </h2>
      <div className="px-5 py-3">{children}</div>
      {embed ? (
        <div className="border-t border-line">
          <iframe
            src={embed}
            title={`Bản đồ ${title}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="h-[300px] w-full border-0"
          />
        </div>
      ) : null}
      {mapsUrl ? (
        <div className="px-5 py-3">
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex rounded-[11px] bg-success px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-ink transition hover:brightness-95"
          >
            Chỉ đường
          </a>
        </div>
      ) : null}
    </section>
  );
}

export default async function LienHePage() {
  const [toaSoan, vanPhong] = await Promise.all([
    fetchCenterBySlug(TOA_SOAN_SLUG).catch(() => null),
    fetchCenterBySlug(VAN_PHONG_SLUG).catch(() => null),
  ]);

  const pageLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ContactPage",
        "@id": `${SITE_URL}/lien-he`,
        url: `${SITE_URL}/lien-he`,
        name: `Liên Hệ - ${SITE_NAME}`,
        isPartOf: { "@id": `${SITE_URL}/#website` },
        inLanguage: "vi",
        breadcrumb: { "@id": `${SITE_URL}/lien-he#breadcrumb` },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${SITE_URL}/lien-he#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Trang chủ",
            item: SITE_URL,
          },
          { "@type": "ListItem", position: 2, name: "Liên Hệ" },
        ],
      },
    ],
  };

  return (
    <div className="py-10">
      <JsonLd data={pageLd} />
      <SectionTitle as="h1">Liên hệ</SectionTitle>

      <div className="mx-auto mt-10 grid max-w-[1080px] gap-8 px-4 lg:grid-cols-2">
        <Card
          title="Tổ Sư Thiền"
          embed={mapEmbed(toaSoan)}
          mapsUrl={toaSoan?.googleMapsUrl}
        >
          <Row label="Cố vấn">HT Thích Minh Hiền</Row>
          <Row label="Tổng biên tập">HT Thích Huệ Minh</Row>
          <Row label="Địa chỉ">
            B15/20, Quốc Lộ 50, xã Bình Hưng, Tp.HCM
          </Row>
          <Row label="Điện thoại">
            <a href="tel:0908400155" className="text-primary hover:underline">
              0908 400 155
            </a>
          </Row>
          <Row label="Email">
            <a
              href="mailto:thoaidau1980@gmail.com"
              className="text-primary hover:underline"
            >
              thoaidau1980@gmail.com
            </a>
          </Row>
        </Card>

        <Card
          title="Văn phòng liên lạc"
          embed={mapEmbed(vanPhong)}
          mapsUrl={vanPhong?.googleMapsUrl}
        >
          <Row label="Địa điểm">Chùa Phật Đà</Row>
          <Row label="Địa chỉ">
            362/46, Nguyễn Đình Chiểu, phường Bàn Cờ, Tp.HCM
          </Row>
          <Row label="Chịu trách nhiệm">HT Thích Huệ Minh</Row>
          <Row label="Trang tin">Trang tin điện tử Tổ Sư Thiền</Row>
          {vanPhong?.phone ? (
            <Row label="Điện thoại">
              <a
                href={`tel:${vanPhong.phone}`}
                className="text-primary hover:underline"
              >
                {vanPhong.phone}
              </a>
            </Row>
          ) : null}
        </Card>
      </div>

      <div className="mx-auto mt-10 grid max-w-[1080px] gap-8 px-4 md:grid-cols-2">
        <section className="rounded-[10px] border border-line p-5">
          <h2 className="mb-3 text-base font-bold uppercase tracking-wide text-primary">
            Kênh chính thức
          </h2>
          <ul className="space-y-2 text-base leading-7">
            {SOCIAL.map((s) => (
              <li key={s.href}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-black underline-offset-4 hover:text-primary hover:underline"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-[10px] border border-line p-5">
          <h2 className="mb-3 text-base font-bold uppercase tracking-wide text-primary">
            Liên hệ thiền đường
          </h2>
          <p className="text-base leading-7 text-black">
            Mỗi thiền đường trong Tông Phong đều có địa chỉ, số điện thoại trụ
            trì và bản đồ riêng.
          </p>
          <Link
            href="/thien-duong"
            className="mt-4 inline-flex rounded-[11px] bg-primary px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-white transition hover:brightness-110"
          >
            Xem danh sách thiền đường
          </Link>
        </section>
      </div>
    </div>
  );
}
