/** WordPress often embeds -523x400.png with width="1053" — upscales and looks blurry. */

const POST_FILE_SIZE = /-\d+x\d+(\.(?:png|jpe?g|webp|gif))/gi;
const IMG_SRC = /<img[^>]+src=["']([^"']+)["']/gi;
const POST_LEAD = /<h2[^>]*class=["'][^"']*post-lead[^"']*["'][^>]*>([\s\S]*?)<\/h2>/gi;

export type PostZoomInfo = {
  meetingId: string;
  pass?: string;
  joinUrl: string;
};

/** Four fixed announcement slots for class notices. */
export type PostAnnouncementSections = {
  topic?: string;
  teacher?: string;
  schedule?: string;
  zoom?: PostZoomInfo;
};

export type PostDisplayData = {
  posterUrl?: string;
  /** All poster/gallery images under the announcement cards. */
  posterUrls?: string[];
  proseHtml: string;
  sections: PostAnnouncementSections;
};

export function preferFullPostImageUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  return url.replace(POST_FILE_SIZE, "$1");
}

export function normalizePostHtml(html?: string | null): string {
  if (!html) return "";

  let out = html.replace(
    /https?:\/\/[^"'>\s]+\/files\/images\/posts\/[^"'>\s]+\.(?:png|jpe?g|webp|gif)/gi,
    (url) => preferFullPostImageUrl(url) ?? url,
  );

  out = out.replace(/\s(width|height)=["'][^"']*["']/gi, "");
  out = out.replace(/\sclass=["'][^"']*\bwp-image-\d+[^"']*["']/gi, "");

  out = out.replace(/<h1(\s|>)/gi, '<h2 class="post-lead"$1');
  out = out.replace(/<\/h1>/gi, "</h2>");

  return out;
}

function stripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#8220;|&ldquo;/gi, "“")
    .replace(/&#8221;|&rdquo;/gi, "”")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/[″"]+/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function parseZoom(text: string): PostZoomInfo | undefined {
  const idMatch = text.match(
    /(?:zoom\s*id|id\s*zoom|zoom)[:\s]*([0-9][0-9\s]{7,})/i,
  );
  if (!idMatch) return undefined;
  const meetingId = idMatch[1].replace(/\s/g, "");
  const passMatch = text.match(
    /(?:pass|mật\s*khẩu|password)[:\s]*([A-Za-z0-9_-]+)/i,
  );
  const pass = passMatch?.[1]?.trim();
  return {
    meetingId,
    pass,
    joinUrl: pass
      ? `https://zoom.us/j/${meetingId}?pwd=${encodeURIComponent(pass)}`
      : `https://zoom.us/j/${meetingId}`,
  };
}

function cleanQuotes(value: string): string {
  return value
    .replace(/^["“]+/, "")
    .replace(/["”]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parse class-notice text into: topic, teacher, schedule, zoom.
 * Example WP blob:
 * Lớp học chuyên đề … tối thứ 2 … Ngày … Hoà thượng … giảng đề tài: “…”
 * Kính mời … zoom ID: …, pass: …
 */
export function parseAnnouncementSections(rawText: string): PostAnnouncementSections {
  const text = stripTags(rawText);
  if (!text) return {};

  const sections: PostAnnouncementSections = {};
  const zoom = parseZoom(text);
  if (zoom) sections.zoom = zoom;

  let body = text
    .replace(
      /(?:kính\s*mời[\s\S]*?)?(?:bấm\s*vào\s*)?zoom[\s\S]*$/i,
      "",
    )
    .trim();

  const topicMatch = body.match(
    /(?:giảng\s*)?đề\s*tài\s*[:：]\s*["“]?([^"”]+)["”]?/i,
  );
  if (topicMatch) {
    sections.topic = cleanQuotes(topicMatch[1])
      .replace(/\s*kính\s*mời[\s\S]*$/i, "")
      .replace(/\s*bấm\s*vào[\s\S]*$/i, "")
      .replace(/\s*[.。]+\s*$/g, "")
      .trim();
    body = body.replace(topicMatch[0], " ").trim();
  }

  const teacherMatch = body.match(
    /((?:Hoà|Hòa)\s*thượng\s+Thích\s+[^\s,.]+(?:\s+[^\s,.]+){0,3}|(?:\bHT\.?\s+)?Thích\s+[^\s,.]+(?:\s+[^\s,.]+){0,3})/i,
  );
  if (teacherMatch) {
    sections.teacher = teacherMatch[1]
      .replace(/\s*(?:giảng|đề\s*tài).*$/i, "")
      .trim();
    body = body.replace(teacherMatch[0], " ").trim();
  }

  body = body
    .replace(/\s*(?:giảng\s*)?đề\s*tài\s*[:：]?\s*$/i, "")
    .replace(/\s*kính\s*mời[\s\S]*$/i, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[.\s]+$/g, "")
    .trim();

  if (body) {
    sections.schedule = body;
  }

  return sections;
}

function collectLeadTexts(normalized: string): string {
  const parts: string[] = [];
  let m: RegExpExecArray | null;
  const leadRe = new RegExp(POST_LEAD.source, POST_LEAD.flags);
  while ((m = leadRe.exec(normalized)) !== null) {
    const text = stripTags(m[1]);
    if (text) parts.push(text);
  }
  if (parts.length) return parts.join(" ");

  // Fallback: whole body text (minus images)
  const withoutImgs = normalized
    .replace(/<p>\s*<img[^>]*>\s*<\/p>/gi, "")
    .replace(/<img[^>]*>/gi, "");
  return stripTags(withoutImgs);
}

/** Split WP HTML into poster + 4 announcement slots + remaining prose. */
export function extractPostDisplayData(html: string): PostDisplayData {
  const normalized = normalizePostHtml(html);
  let posterUrl: string | undefined;
  const imgMatch = IMG_SRC.exec(normalized);
  if (imgMatch) {
    posterUrl = preferFullPostImageUrl(imgMatch[1]);
  }
  IMG_SRC.lastIndex = 0;

  const leadBlob = collectLeadTexts(normalized);
  const sections = parseAnnouncementSections(leadBlob);

  let proseHtml = normalized
    .replace(/<p>\s*<img[^>]*>\s*<\/p>/gi, "")
    .replace(/<figure[^>]*>[\s\S]*?<\/figure>/gi, "")
    .replace(POST_LEAD, "")
    .trim();

  // If we successfully structured the notice, drop leftover invite lines from prose.
  if (sections.topic || sections.teacher || sections.schedule || sections.zoom) {
    proseHtml = proseHtml
      .replace(/<p[^>]*>[\s\S]*?(?:zoom\s*id|kính\s*mời)[\s\S]*?<\/p>/gi, "")
      .trim();
  }

  if (!proseHtml.replace(/<[^>]+>/g, "").trim()) {
    proseHtml = "";
  }

  return { posterUrl, proseHtml, sections };
}

type StructuredPostInput = {
  topicText?: string | null;
  teacherText?: string | null;
  scheduleText?: string | null;
  zoomMeetingId?: string | null;
  zoomPass?: string | null;
  zoomUrl?: string | null;
  description?: string | null;
  content?: string | null;
  coverImageUrl?: string | null;
  images?: Array<{ role: string; url: string; sortOrder?: number }>;
};

function hasStructuredAnnouncement(post: StructuredPostInput): boolean {
  return Boolean(
    post.topicText?.trim() ||
      post.teacherText?.trim() ||
      post.scheduleText?.trim() ||
      post.zoomMeetingId?.trim(),
  );
}

function pickPosterUrls(post: StructuredPostInput): string[] {
  const images = [...(post.images ?? [])].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
  );
  const fromImages = images
    .filter((img) => img.role === "poster" || img.role === "content")
    .map((img) => preferFullPostImageUrl(img.url))
    .filter((url): url is string => Boolean(url));
  if (fromImages.length) return fromImages;
  const cover = preferFullPostImageUrl(post.coverImageUrl);
  return cover ? [cover] : [];
}

function buildZoomFromFields(post: StructuredPostInput): PostZoomInfo | undefined {
  const meetingId = post.zoomMeetingId?.replace(/\s/g, "").trim();
  if (!meetingId) return undefined;
  const pass = post.zoomPass?.trim() || undefined;
  const joinUrl =
    post.zoomUrl?.trim() ||
    (pass
      ? `https://zoom.us/j/${meetingId}?pwd=${encodeURIComponent(pass)}`
      : `https://zoom.us/j/${meetingId}`);
  return { meetingId, pass, joinUrl };
}

/**
 * Prefer structured admin fields; fall back to legacy WP HTML parsing.
 */
export function buildPostDisplayData(post: StructuredPostInput): PostDisplayData {
  if (hasStructuredAnnouncement(post)) {
    const sections: PostAnnouncementSections = {};
    const topic = post.topicText?.trim();
    const teacher = post.teacherText?.trim();
    const schedule = post.scheduleText?.trim();
    if (topic) sections.topic = topic;
    if (teacher) sections.teacher = teacher;
    if (schedule) sections.schedule = schedule;
    const zoom = buildZoomFromFields(post);
    if (zoom) sections.zoom = zoom;

    const desc = post.description?.trim();
    const posterUrls = pickPosterUrls(post);
    return {
      posterUrl: posterUrls[0],
      posterUrls,
      proseHtml: desc ? normalizePostHtml(desc) : "",
      sections,
    };
  }

  const fromHtml = extractPostDisplayData(post.content || "");
  const posterUrls = pickPosterUrls(post);
  const mergedPoster = posterUrls[0] || fromHtml.posterUrl;
  return {
    ...fromHtml,
    posterUrl: mergedPoster,
    posterUrls: posterUrls.length
      ? posterUrls
      : fromHtml.posterUrl
        ? [fromHtml.posterUrl]
        : [],
    proseHtml: post.description?.trim()
      ? normalizePostHtml(post.description)
      : fromHtml.proseHtml,
  };
}
