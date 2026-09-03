import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BookOpenText,
  CalendarDays,
  Flower2,
  UserRound,
  Video,
} from "lucide-react";
import { Reveal } from "./motion/Reveal";
import { CenterGallery } from "./CenterGallery";
import {
  imageUrlsInHtml,
  preferFullPostImageUrl,
  type PostDisplayData,
} from "../lib/postContent";

type SectionCardProps = {
  step: string;
  label: string;
  Icon: LucideIcon;
  children: ReactNode;
  accent?: boolean;
  delay?: number;
};

function SectionCard({
  step,
  label,
  Icon,
  children,
  accent = false,
  delay = 0,
}: SectionCardProps) {
  return (
    <Reveal delay={delay} variant="up" className="h-full">
      <div
        role="listitem"
        className={`post-info-card flex h-full flex-col rounded-[14px] border p-4 sm:p-5 ${
          accent
            ? "post-info-card--accent border-primary/25 bg-gradient-to-br from-paper-warm via-white to-paper"
            : "border-line bg-white"
        }`}
      >
        <div className="mb-3 flex items-center gap-3">
          <span
            className={`post-info-card__icon grid size-12 shrink-0 place-items-center rounded-full text-primary ${
              accent ? "bg-primary/15" : "bg-paper-warm"
            }`}
            aria-hidden
          >
            <Icon className="size-6" strokeWidth={1.85} />
          </span>
          <span className="text-[1.05rem] font-bold uppercase tracking-[0.1em] text-primary md:text-[1.12rem]">
            {/^\d+$/.test(step) ? `${step}. ${label}` : `${step} · ${label}`}
          </span>
        </div>
        <div className="min-w-0 flex-1 text-[1.15rem] leading-relaxed text-ink md:text-[1.2rem]">
          {children}
        </div>
      </div>
    </Reveal>
  );
}

type Props = {
  display: PostDisplayData;
  coverFallback?: string | null;
  publishedLabel?: string;
  authorName?: string | null;
};

export function PostArticleBody({
  display,
  coverFallback,
  publishedLabel,
}: Props) {
  const { topic, teacher, schedule, zoom } = display.sections;
  const isClassNotice =
    display.kind === "class" || Boolean(teacher || schedule);
  const isCenterNotice = display.kind === "center";
  /** Class/center show poster banner on detail; news cover is list-only. */
  const showPosterGallery = isClassNotice || isCenterNotice;
  const postersAll =
    display.posterUrls?.length
      ? display.posterUrls
      : display.posterUrl
        ? [display.posterUrl]
        : showPosterGallery && coverFallback
          ? [coverFallback]
          : [];
  const coverNorm = coverFallback
    ? preferFullPostImageUrl(coverFallback) || coverFallback
    : null;
  const inline = new Set(
    imageUrlsInHtml(display.proseHtml).map(
      (url) => preferFullPostImageUrl(url) || url,
    ),
  );
  const posters = postersAll.filter((src) => {
    const full = preferFullPostImageUrl(src) || src;
    if (inline.has(full)) return false;
    if (!showPosterGallery && coverNorm && full === coverNorm) return false;
    return true;
  });
  const hasClassCards = Boolean(topic || teacher || schedule || zoom);

  return (
    <div className="mx-auto max-w-[860px] space-y-8">
      {publishedLabel ? (
        <Reveal variant="fade" className="animate-fade-in">
          <ul className="post-meta-chips flex flex-wrap justify-center gap-2">
            <li className="post-meta-chip">
              <CalendarDays
                className="size-4 shrink-0 text-primary"
                strokeWidth={1.85}
              />
              <span>{publishedLabel}</span>
            </li>
            <li className="post-meta-chip">
              <Flower2
                className="size-4 shrink-0 text-primary"
                strokeWidth={1.85}
              />
              <span>Tông Phong Tổ Sư Thiền</span>
            </li>
          </ul>
        </Reveal>
      ) : null}

      {isClassNotice && hasClassCards ? (
        <section aria-label="Thông tin lớp học">
          <Reveal delay={40} variant="fade">
            <p className="mb-4 text-center text-xs font-bold uppercase tracking-[0.18em] text-primary">
              Thông báo lớp học
            </p>
          </Reveal>
          <div
            role="list"
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4"
          >
            {topic ? (
              <SectionCard
                step="1"
                label="Đề tài"
                Icon={BookOpenText}
                delay={80}
              >
                <p className="font-semibold text-primary">{topic}</p>
              </SectionCard>
            ) : null}

            {teacher ? (
              <SectionCard
                step="2"
                label="Giảng sư"
                Icon={UserRound}
                delay={140}
              >
                <p className="font-medium">{teacher}</p>
              </SectionCard>
            ) : null}

            {schedule ? (
              <SectionCard
                step="3"
                label="Thời gian"
                Icon={CalendarDays}
                delay={200}
              >
                <p>{schedule}</p>
              </SectionCard>
            ) : null}

            {zoom ? (
              <SectionCard
                step="4"
                label="Zoom"
                Icon={Video}
                accent
                delay={260}
              >
                <p>
                  ID:{" "}
                  <span className="font-mono font-semibold tracking-wide">
                    {zoom.meetingId}
                  </span>
                  {zoom.pass ? (
                    <>
                      {" "}
                      · Pass:{" "}
                      <span className="font-semibold">{zoom.pass}</span>
                    </>
                  ) : null}
                </p>
                <Link
                  href={zoom.joinUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hover-lift mt-4 inline-flex items-center gap-2 rounded-[11px] bg-primary px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-white shadow-md shadow-primary/20 transition hover:brightness-110"
                >
                  <Video className="size-4" strokeWidth={2} />
                  Vào phòng Zoom
                </Link>
              </SectionCard>
            ) : null}
          </div>
        </section>
      ) : null}

      {!isClassNotice ? (
        <>
          {topic ? (
            <p className="text-center text-lg font-semibold text-primary md:text-xl">
              {topic}
            </p>
          ) : null}

          {display.proseHtml ? (
            <Reveal delay={140} variant="fade">
              <div
                className="post-content [&_a]:text-primary [&_a]:underline"
                dangerouslySetInnerHTML={{ __html: display.proseHtml }}
              />
            </Reveal>
          ) : null}

          {posters.length === 1 ? (
            <Reveal delay={200} variant="zoom">
              <figure className="post-poster overflow-hidden rounded-[14px] border border-line bg-paper-warm p-2 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={posters[0]}
                  alt=""
                  loading="eager"
                  decoding="async"
                  className="mx-auto max-h-[min(520px,70vh)] w-auto max-w-full rounded-[10px] object-contain"
                />
              </figure>
            </Reveal>
          ) : posters.length > 1 ? (
            <CenterGallery urls={posters} templeName="Tin tức" />
          ) : null}

          {zoom ? (
            <SectionCard
              step="Zoom"
              label="Phòng họp"
              Icon={Video}
              accent
              delay={200}
            >
              <p>
                ID:{" "}
                <span className="font-mono font-semibold tracking-wide">
                  {zoom.meetingId}
                </span>
                {zoom.pass ? (
                  <>
                    {" "}
                    · Pass: <span className="font-semibold">{zoom.pass}</span>
                  </>
                ) : null}
              </p>
              <Link
                href={zoom.joinUrl}
                target="_blank"
                rel="noreferrer"
                className="hover-lift mt-4 inline-flex items-center gap-2 rounded-[11px] bg-primary px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-white shadow-md shadow-primary/20 transition hover:brightness-110"
              >
                <Video className="size-4" strokeWidth={2} />
                Vào phòng Zoom
              </Link>
            </SectionCard>
          ) : null}
        </>
      ) : (
        <>
          {posters.length ? (
            <div className="space-y-4">
              {posters.map((src, index) => (
                <Reveal key={`${src}-${index}`} delay={320 + index * 40} variant="zoom">
                  <figure className="post-poster overflow-hidden rounded-[14px] border border-line bg-paper-warm p-2 shadow-sm">
                    {zoom ? (
                      <a
                        href={zoom.joinUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="group block"
                        aria-label="Vào phòng Zoom"
                        title="Bấm ảnh để vào Zoom"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={src}
                          alt=""
                          loading={index === 0 ? "eager" : "lazy"}
                          decoding="async"
                          className="mx-auto max-h-[min(640px,75vh)] w-auto max-w-full rounded-[10px] object-contain transition duration-700 ease-out group-hover:scale-[1.015]"
                        />
                      </a>
                    ) : (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={src}
                          alt=""
                          loading={index === 0 ? "eager" : "lazy"}
                          decoding="async"
                          className="mx-auto max-h-[min(640px,75vh)] w-auto max-w-full rounded-[10px] object-contain transition duration-700 ease-out hover:scale-[1.015]"
                        />
                      </>
                    )}
                  </figure>
                </Reveal>
              ))}
            </div>
          ) : null}

          {display.proseHtml ? (
            <Reveal delay={380} variant="fade">
              <div
                className="post-content [&_a]:text-primary [&_a]:underline"
                dangerouslySetInnerHTML={{ __html: display.proseHtml }}
              />
            </Reveal>
          ) : null}
        </>
      )}
    </div>
  );
}
