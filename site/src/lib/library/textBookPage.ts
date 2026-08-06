import type { TextBookPage } from "./types";

export function isContentPage(p?: TextBookPage | null): boolean {
  return !!p && !p.isBlank && p.text.trim().length > 0;
}

/** OCR running header: label trái, số trang phải — giống portal BookTextView. */
export function parseRunningHeader(raw: string): {
  label: string;
  pageLabel: string;
  body: string;
} | null {
  const text = raw.replace(/\r\n/g, "\n").trimStart();
  if (!text) return null;
  const nl = text.indexOf("\n");
  const first = (nl >= 0 ? text.slice(0, nl) : text).trim();
  const rest = nl >= 0 ? text.slice(nl + 1) : "";

  let m = first.match(
    /^((?:Hòa\s+Thượng\s+)?(?:Biên\s+soạn\s*:?\s*)?(?:Dịch\s+giả\s*:?\s*)?(?:HT\.?\s*)?THÍCH\s+DUY\s+LỰC)\s+(\d{1,4})\s*$/i,
  );
  if (m) {
    return { label: m[1].replace(/\s+/g, " ").trim(), pageLabel: m[2], body: rest };
  }

  m = first.match(
    /^(\d{1,4})\s+((?:Dịch\s+giả\s*:?\s*)?(?:HT\.?\s*)?THÍCH\s+DUY\s+LỰC)\s*$/i,
  );
  if (m) {
    return { label: m[2].replace(/\s+/g, " ").trim(), pageLabel: m[1], body: rest };
  }

  return null;
}

export function reflowBody(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((para) => para.replace(/\n+/g, " ").replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");
}

/** Layout trang — giống portal pageLayout computed. */
export function layoutTextPage(page: TextBookPage | undefined): {
  label: string;
  pageLabel: string;
  body: string;
} {
  const raw =
    page?.text || (page?.isBlank ? "(Trang trống)" : "Không có nội dung");
  const header = parseRunningHeader(raw);
  if (header) {
    return {
      label: header.label,
      pageLabel: header.pageLabel,
      body: reflowBody(header.body),
    };
  }
  return {
    label: "",
    pageLabel: "",
    body: reflowBody(raw),
  };
}

export function mergePageWindows(
  existing: TextBookPage[],
  incoming: TextBookPage[],
): TextBookPage[] {
  const map = new Map(existing.map((p) => [p.page, p]));
  for (const p of incoming) map.set(p.page, p);
  return [...map.values()].sort((a, b) => a.page - b.page);
}
