import Link from "next/link";
import {
  announcementHeadline,
  formatSessionDate,
  zoomJoinUrl,
  type ClassAnnouncement,
} from "../lib/classAnnouncements";

const POSTER_BG = "/wp/announcements/poster-bg.png";

type Props = {
  announcement: ClassAnnouncement;
  /** compact = card trang chủ; full = trang chi tiết */
  variant?: "compact" | "full";
};

export function ClassAnnouncementCard({
  announcement: a,
  variant = "compact",
}: Props) {
  const joinUrl = zoomJoinUrl(a);
  const photo = a.teacherPhotoUrl || a.teacher?.photoUrl || null;
  const teacher =
    a.teacherNameText ||
    (a.teacher
      ? [a.teacher.rank, a.teacher.name].filter(Boolean).join(" ")
      : null);
  const classLabel =
    a.dharmaClass?.shortName || a.dharmaClass?.name || "Lớp học";
  const dateLabel = formatSessionDate(a.sessionDate);
  const headline = announcementHeadline(a);

  return (
    <article
      className={`overflow-hidden rounded-[14px] border border-line bg-paper shadow-md shadow-primary/10 ${
        variant === "full" ? "max-w-3xl" : ""
      }`}
    >
      <div
        className="relative bg-cover bg-center px-4 py-6 sm:px-6 sm:py-8"
        style={{ backgroundImage: `url(${POSTER_BG})` }}
      >
        <div className="rounded-[12px] bg-[linear-gradient(180deg,rgba(253,248,238,0.88),rgba(253,248,238,0.94))] px-4 py-5 text-center text-ink sm:px-6">
          <p className="text-[0.72rem] font-semibold tracking-[0.12em] text-gold uppercase">
            Thông báo lớp học
          </p>
          <h3 className="mt-1 font-serif text-xl font-bold tracking-tight text-primary sm:text-2xl">
            {a.templeName}
          </h3>
          {a.templeAddress ? (
            <p className="mt-1 text-sm text-muted">{a.templeAddress}</p>
          ) : null}

          <p className="mt-4 text-sm font-semibold text-secondary">{classLabel}</p>
          <p className="mt-2 font-serif text-2xl font-bold text-[#8a6a1f] uppercase sm:text-3xl">
            {a.topicTitle}
          </p>
          {a.formatNote ? (
            <p className="mt-2 text-sm text-muted">{a.formatNote}</p>
          ) : null}

          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              alt={teacher || "Giảng sư"}
              className="mx-auto mt-5 size-28 rounded-full border-[3px] border-[#c4a484] object-cover shadow-lg"
            />
          ) : null}

          {teacher ? (
            <p className="mt-3 text-base font-semibold">
              Chủ giảng: <span className="text-primary">{teacher}</span>
            </p>
          ) : null}

          <div className="mx-auto mt-5 max-w-md rounded-[10px] border border-gold/40 bg-white/80 px-4 py-3 text-left text-sm leading-relaxed">
            {(a.timeText || dateLabel) && (
              <p>
                <span className="font-semibold text-primary">Thời gian:</span>{" "}
                {a.timeText ||
                  (dateLabel
                    ? `${dateLabel}${a.lunarDateText ? ` (${a.lunarDateText})` : ""}`
                    : "")}
              </p>
            )}
            {a.lunarDateText && a.timeText ? (
              <p className="text-muted">Âm lịch: {a.lunarDateText}</p>
            ) : null}
            <p className="mt-2">
              <span className="font-semibold text-primary">Trực tiếp:</span>{" "}
              Tại Trường hạ {a.templeName.replace(/^TRƯỜNG HẠ\s+/i, "")}
            </p>
            {(a.zoomMeetingId || a.zoomPass) && (
              <p className="mt-2">
                <span className="font-semibold text-primary">Tham dự Zoom:</span>{" "}
                ID <span className="font-mono font-bold">{a.zoomMeetingId}</span>
                {a.zoomPass ? (
                  <>
                    {" "}
                    · pass{" "}
                    <span className="font-mono font-bold text-alert">
                      {a.zoomPass}
                    </span>
                  </>
                ) : null}
              </p>
            )}
          </div>

          {joinUrl ? (
            <a
              href={joinUrl}
              target="_blank"
              rel="noreferrer"
              className="hover-lift mt-5 inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-bold tracking-wide text-white shadow-md shadow-primary/25 transition hover:bg-primary-deep"
            >
              Vào phòng học Zoom
            </a>
          ) : null}

          {a.resourcesNote ? (
            <p className="mt-4 text-xs leading-relaxed text-muted">
              {a.resourcesNote}
            </p>
          ) : null}
        </div>
      </div>

      <div className="border-t border-line bg-white px-4 py-4 sm:px-5">
        <p className="text-[0.95rem] leading-relaxed text-ink">{headline}</p>
        <p className="mt-2 text-sm font-semibold text-primary">
          Kính mời Chư Tôn Đức Tăng Ni và Quý Phật tử tham dự.
        </p>
        {variant === "compact" ? (
          <Link
            href={`/thong-bao/${a.id}`}
            className="mt-3 inline-block text-sm font-semibold text-secondary underline-offset-2 hover:underline"
          >
            Xem chi tiết thông báo →
          </Link>
        ) : null}
      </div>
    </article>
  );
}
