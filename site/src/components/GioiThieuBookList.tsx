import Link from "next/link";
import type { BookEntry } from "../content/gioi-thieu";
import type { MatchedBookIds } from "../lib/library/matchBook";

const P = "mb-[20.8px]";

/**
 * PC (≥850px) → PDF; điện thoại → bản chữ.
 * CSS ẩn/hiện hai link — không cần JS detect thiết bị.
 */
export function BookSmartLink({
  label,
  match,
  className = "",
}: {
  label: string;
  match: MatchedBookIds | null;
  className?: string;
}) {
  const pdfHref = match?.pdfId ? `/kinh-sach/pdf/${match.pdfId}` : null;
  const textHref = match?.textId ? `/kinh-sach/chu/${match.textId}` : null;
  const anyHref = pdfHref || textHref;

  if (!anyHref) {
    return <span className={className}>{label}</span>;
  }

  // Chỉ có một bản → dùng chung mọi thiết bị
  if (pdfHref && !textHref) {
    return (
      <Link href={pdfHref} className={`text-primary underline-offset-2 hover:underline ${className}`}>
        {label}
      </Link>
    );
  }
  if (textHref && !pdfHref) {
    return (
      <Link href={textHref} className={`text-primary underline-offset-2 hover:underline ${className}`}>
        {label}
      </Link>
    );
  }

  return (
    <>
      <Link
        href={pdfHref!}
        className={`hidden text-primary underline-offset-2 hover:underline min-[850px]:inline ${className}`}
      >
        {label}
      </Link>
      <Link
        href={textHref!}
        className={`inline text-primary underline-offset-2 hover:underline min-[850px]:hidden ${className}`}
      >
        {label}
      </Link>
    </>
  );
}

export function GioiThieuBookList({
  books,
  matches,
}: {
  books: BookEntry[];
  matches: Record<string, MatchedBookIds>;
}) {
  return (
    <>
      {books.map((book, i) => (
        <div key={book.title}>
          <p className={`${P} italic`}>
            {`${i + 1}) `}
            <BookSmartLink label={book.title} match={matches[book.title] ?? null} />
          </p>
          {book.items?.map((item) => (
            <p key={item} className={`${P} pl-[3em] italic`}>
              <BookSmartLink
                label={item}
                match={matches[item] ?? matches[book.title] ?? null}
              />
            </p>
          ))}
        </div>
      ))}
    </>
  );
}
