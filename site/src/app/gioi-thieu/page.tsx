import { Fragment } from "react";
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
import {
  SITE_NAME,
  SITE_URL,
  absoluteUrl,
  buildMetadata,
  excerptForOg,
} from "../../lib/seo";

export const metadata = buildMetadata({
  title: "Giới Thiệu",
  path: "/gioi-thieu",
  type: "article",
  description: excerptForOg(INTRO),
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

export default function GioiThieuPage() {
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
        description: excerptForOg(INTRO),
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

  return (
    <article className="mx-auto w-full max-w-[1080px] px-[15px] py-8 text-[16px] leading-[1.6] text-black">
      <JsonLd data={pageLd} />

      <p className={P}>
        <strong>{INTRO}</strong>
      </p>

      <h1 className="mb-[13.6px] text-center text-[27.2px] leading-[1.3] font-bold text-black">
        Tiểu sử Hòa thượng Thích Duy Lực
      </h1>

      <p className={P}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/wp/to-su.jpg"
          alt="Hòa thượng Thích Duy Lực"
          width={303}
          height={455}
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

      {KINH_SACH.map((book, i) => (
        <Fragment key={book.title}>
          <p className={`${P} italic`}>{`${i + 1}) ${book.title}`}</p>
          {book.items?.map((item) => (
            <p key={item} className={`${P} pl-[3em] italic`}>
              {item}
            </p>
          ))}
        </Fragment>
      ))}

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
