import { Fragment } from "react";
import { GioiThieuBookList } from "../../components/GioiThieuBookList";
import { JsonLd } from "../../components/JsonLd";
import {
  INTRO,
  KINH_SACH,
  KINH_SACH_HEADING,
  KINH_SACH_INTRO,
  KINH_SACH_OUTRO,
  KY_TEN,
  SECTIONS,
  SECTIONS_CUOI,
  type Section,
} from "../../content/gioi-thieu";
import { fetchPdfs, fetchTextBooks } from "../../lib/library/api";
import { matchBookIds, type MatchedBookIds } from "../../lib/library/matchBook";
import {
  SITE_NAME,
  SITE_URL,
  absoluteUrl,
  buildMetadata,
} from "../../lib/seo";

const GIOI_THIEU_DESCRIPTION =
  "Tổ Sư Thiền — giới thiệu tông chỉ tham thoại đầu và tiểu sử Hòa thượng Thích Duy Lực, hướng hành giả tu tập theo Tông Phong Thiền Việt Nam.";

export const metadata = buildMetadata({
  title: "Giới Thiệu",
  path: "/gioi-thieu",
  type: "article",
  description: GIOI_THIEU_DESCRIPTION,
  image: "/wp/to-su.jpg",
  imageWidth: 510,
  imageHeight: 765,
});

/** Khoảng cách đoạn của Flatsome: margin-bottom 1.3em (20.8px) */
const P = "mb-[20.8px]";

/** Một đoạn gồm nhiều câu, ngăn nhau bằng <br /> đúng như bản gốc. */
function Para({ lines, className }: { lines: string[]; className?: string }) {
  return (
    <p className={`${P}${className ? ` ${className}` : ""}`}>
      {lines.map((line, i) => (
        <Fragment key={line.slice(0, 32)}>
          {i > 0 ? <br /> : null}
          {line}
        </Fragment>
      ))}
    </p>
  );
}

function Block({ section }: { section: Section }) {
  return (
    <p id={section.id} className={`${P} scroll-mt-24`}>
      <strong>{section.heading}</strong>
      {section.paragraphs.map((line) => (
        <Fragment key={line.slice(0, 32)}>
          <br />
          {line}
        </Fragment>
      ))}
    </p>
  );
}

export default async function GioiThieuPage() {
  const pageLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${SITE_URL}/gioi-thieu`,
        url: `${SITE_URL}/gioi-thieu`,
        name: `Giới Thiệu - ${SITE_NAME}`,
        isPartOf: { "@id": `${SITE_URL}/#website` },
        primaryImageOfPage: {
          "@id": `${SITE_URL}/gioi-thieu#primaryimage`,
        },
        image: { "@id": `${SITE_URL}/gioi-thieu#primaryimage` },
        thumbnailUrl: absoluteUrl("/wp/to-su.jpg"),
        description: GIOI_THIEU_DESCRIPTION,
        inLanguage: "vi",
        breadcrumb: { "@id": `${SITE_URL}/gioi-thieu#breadcrumb` },
      },
      {
        "@type": "ImageObject",
        inLanguage: "vi",
        "@id": `${SITE_URL}/gioi-thieu#primaryimage`,
        url: absoluteUrl("/wp/to-su.jpg"),
        contentUrl: absoluteUrl("/wp/to-su.jpg"),
        width: 510,
        height: 765,
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${SITE_URL}/gioi-thieu#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Trang chủ",
            item: SITE_URL,
          },
          { "@type": "ListItem", position: 2, name: "Giới Thiệu" },
        ],
      },
    ],
  };

  const [mucA, ...mucBC] = SECTIONS;

  let bookMatches: Record<string, MatchedBookIds> = {};
  try {
    const [pdfs, texts] = await Promise.all([fetchPdfs(), fetchTextBooks()]);
    const titles = new Set<string>();
    for (const b of KINH_SACH) {
      titles.add(b.title);
      b.items?.forEach((t) => titles.add(t));
    }
    bookMatches = Object.fromEntries(
      [...titles].map((t) => [t, matchBookIds(t, pdfs, texts)]),
    );
  } catch {
    bookMatches = {};
  }

  return (
    <article className="mx-auto w-full max-w-[1080px] px-[15px] py-8 text-base text-black animate-fade-up">
      <JsonLd data={pageLd} />

      <p className={P}>
        <strong>{INTRO}</strong>
      </p>

      <h1 className="mb-[13.6px] text-center text-[1.7rem] leading-[1.3] font-bold text-black">
        Tiểu sử Hòa thượng Thích Duy Lực
      </h1>

      <p className={P}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/wp/to-su.jpg"
          alt="Hòa thượng Thích Duy Lực"
          width={303}
          height={455}
          loading="lazy"
          decoding="async"
          className="w-[303px] max-w-full min-[850px]:float-left min-[850px]:mr-[21.6px] min-[850px]:inline"
        />
        <strong>{mucA.heading}</strong>
      </p>

      <Para lines={mucA.paragraphs} />

      {mucBC.map((section) => (
        <Block key={section.id} section={section} />
      ))}

      <p className={P}>
        <strong>{KINH_SACH_HEADING}</strong>
        {KINH_SACH_INTRO.map((line) => (
          <Fragment key={line.slice(0, 32)}>
            <br />
            {line}
          </Fragment>
        ))}
      </p>

      <GioiThieuBookList books={KINH_SACH} matches={bookMatches} />

      <p className={P}>***</p>

      <Para lines={[KINH_SACH_OUTRO]} />

      {SECTIONS_CUOI.map((section) => (
        <Block key={section.id} section={section} />
      ))}

      <p className={`${P} text-right`}>
        <strong>{KY_TEN}</strong>
      </p>
    </article>
  );
}
