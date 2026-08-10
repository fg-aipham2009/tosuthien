#!/usr/bin/env node
/**
 * One-shot: parse legacy WP HTML posts into structured announcement fields,
 * clear redundant HTML content, and dedupe identical post_images URLs.
 *
 * Usage:
 *   API_BASE=https://api.tosuthien.net \
 *   ADMIN_USER=... ADMIN_PASS=... \
 *   node scripts/migrate_posts_announcement_fields.mjs
 *
 * Dry-run (no writes):
 *   DRY_RUN=1 ... node scripts/migrate_posts_announcement_fields.mjs
 */

const API_BASE = (process.env.API_BASE || 'https://api.tosuthien.net').replace(
  /\/$/,
  '',
);
const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
const USER = process.env.ADMIN_USER || process.env.ADMIN_BOOTSTRAP_USERNAME;
const PASS = process.env.ADMIN_PASS || process.env.ADMIN_BOOTSTRAP_PASSWORD;

const POST_FILE_SIZE = /-\d+x\d+(\.(?:png|jpe?g|webp|gif))/gi;
const IMG_SRC = /<img[^>]+src=["']([^"']+)["']/gi;
const POST_LEAD =
  /<h2[^>]*class=["'][^"']*post-lead[^"']*["'][^>]*>([\s\S]*?)<\/h2>/gi;

function preferFullPostImageUrl(url) {
  if (!url) return undefined;
  return url.replace(POST_FILE_SIZE, '$1');
}

function normalizePostHtml(html) {
  if (!html) return '';
  let out = html.replace(
    /https?:\/\/[^"'>\s]+\/files\/images\/posts\/[^"'>\s]+\.(?:png|jpe?g|webp|gif)/gi,
    (url) => preferFullPostImageUrl(url) ?? url,
  );
  out = out.replace(/\s(width|height)=["'][^"']*["']/gi, '');
  out = out.replace(/\sclass=["'][^"']*\bwp-image-\d+[^"']*["']/gi, '');
  out = out.replace(/<h1(\s|>)/gi, '<h2 class="post-lead"$1');
  out = out.replace(/<\/h1>/gi, '</h2>');
  return out;
}

function stripTags(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#8220;|&ldquo;/gi, '“')
    .replace(/&#8221;|&rdquo;/gi, '”')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/[″"]+/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseZoom(text) {
  const idMatch = text.match(
    /(?:zoom\s*id|id\s*zoom|zoom)[:\s]*([0-9][0-9\s]{7,})/i,
  );
  if (!idMatch) return undefined;
  const meetingId = idMatch[1].replace(/\s/g, '');
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

function cleanQuotes(value) {
  return value
    .replace(/^["“]+/, '')
    .replace(/["”]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseAnnouncementSections(rawText) {
  const text = stripTags(rawText);
  if (!text) return {};

  const sections = {};
  const zoom = parseZoom(text);
  if (zoom) sections.zoom = zoom;

  let body = text
    .replace(/(?:kính\s*mời[\s\S]*?)?(?:bấm\s*vào\s*)?zoom[\s\S]*$/i, '')
    .trim();

  const topicMatch = body.match(
    /(?:giảng\s*)?đề\s*tài\s*[:：]\s*["“]?([^"”]+)["”]?/i,
  );
  if (topicMatch) {
    sections.topic = cleanQuotes(topicMatch[1])
      .replace(/\s*kính\s*mời[\s\S]*$/i, '')
      .replace(/\s*bấm\s*vào[\s\S]*$/i, '')
      .replace(/\s*[.。]+\s*$/g, '')
      .trim();
    body = body.replace(topicMatch[0], ' ').trim();
  }

  const teacherMatch = body.match(
    /((?:Hoà|Hòa)\s*thượng\s+Thích\s+[^\s,.]+(?:\s+[^\s,.]+){0,3}|(?:\bHT\.?\s+)?Thích\s+[^\s,.]+(?:\s+[^\s,.]+){0,3})/i,
  );
  if (teacherMatch) {
    sections.teacher = teacherMatch[1]
      .replace(/\s*(?:giảng|đề\s*tài).*$/i, '')
      .trim();
    body = body.replace(teacherMatch[0], ' ').trim();
  }

  body = body
    .replace(/\s*(?:giảng\s*)?đề\s*tài\s*[:：]?\s*$/i, '')
    .replace(/\s*kính\s*mời[\s\S]*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[.\s]+$/g, '')
    .trim();

  if (body) sections.schedule = body;
  return sections;
}

function collectLeadTexts(normalized) {
  const parts = [];
  let m;
  const leadRe = new RegExp(POST_LEAD.source, POST_LEAD.flags);
  while ((m = leadRe.exec(normalized)) !== null) {
    const text = stripTags(m[1]);
    if (text) parts.push(text);
  }
  if (parts.length) return parts.join(' ');
  const withoutImgs = normalized
    .replace(/<p>\s*<img[^>]*>\s*<\/p>/gi, '')
    .replace(/<img[^>]*>/gi, '');
  return stripTags(withoutImgs);
}

function extractPostDisplayData(html) {
  const normalized = normalizePostHtml(html);
  let posterUrl;
  const imgMatch = IMG_SRC.exec(normalized);
  if (imgMatch) posterUrl = preferFullPostImageUrl(imgMatch[1]);
  IMG_SRC.lastIndex = 0;

  const sections = parseAnnouncementSections(collectLeadTexts(normalized));

  let proseHtml = normalized
    .replace(/<p>\s*<img[^>]*>\s*<\/p>/gi, '')
    .replace(/<figure[^>]*>[\s\S]*?<\/figure>/gi, '')
    .replace(POST_LEAD, '')
    .trim();

  if (sections.topic || sections.teacher || sections.schedule || sections.zoom) {
    proseHtml = proseHtml
      .replace(/<p[^>]*>[\s\S]*?(?:zoom\s*id|kính\s*mời)[\s\S]*?<\/p>/gi, '')
      .trim();
  }

  if (!proseHtml.replace(/<[^>]+>/g, '').trim()) proseHtml = '';
  return { posterUrl, proseHtml, sections };
}

function isAnnouncementCandidate(post, display) {
  const s = display.sections;
  if (s.zoom) return true;
  if (s.topic && (s.teacher || s.schedule)) return true;
  const title = (post.title || '').toLowerCase();
  const looksLikeClass =
    title.includes('thông báo lớp') ||
    title.includes('thong bao lop') ||
    title.includes('lớp học chuyên đề') ||
    title.includes('lop hoc chuyen de') ||
    title.includes('lớp thiền') ||
    title.includes('lop thien');
  return looksLikeClass && Boolean(s.topic || s.teacher || s.schedule || s.zoom);
}

async function login() {
  if (!USER || !PASS) {
    throw new Error('Set ADMIN_USER/ADMIN_PASS (or ADMIN_BOOTSTRAP_*)');
  }
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USER, password: PASS }),
  });
  if (!res.ok) {
    throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const token = data.accessToken || data.token;
  if (!token) throw new Error('No accessToken in login response');
  return token;
}

async function fetchAllPosts(token) {
  const items = [];
  let page = 1;
  for (;;) {
    const url = `${API_BASE}/api/posts?all=true&page=${page}&limit=100`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`List posts failed: ${res.status}`);
    const data = await res.json();
    items.push(...(data.items || []));
    if (page >= (data.totalPages || 1)) break;
    page += 1;
  }
  return items;
}

async function updatePost(token, id, payload) {
  const res = await fetch(`${API_BASE}/api/posts/${id}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Update ${id} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function deleteImage(token, postId, imageId) {
  const res = await fetch(`${API_BASE}/api/posts/${postId}/images/${imageId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(
      `Delete image ${imageId} failed: ${res.status} ${await res.text()}`,
    );
  }
}

function pickDedupeDeletes(images) {
  const content = (images || []).filter((i) => i.role !== 'cover');
  const byUrl = new Map();
  for (const img of content) {
    const key = preferFullPostImageUrl(img.url) || img.url;
    const list = byUrl.get(key) || [];
    list.push(img);
    byUrl.set(key, list);
  }
  const toDelete = [];
  for (const list of byUrl.values()) {
    if (list.length <= 1) continue;
    list
      .slice()
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .slice(1)
      .forEach((img) => toDelete.push(img));
  }
  return toDelete;
}

async function main() {
  console.log(`API=${API_BASE} DRY_RUN=${DRY_RUN}`);
  const token = await login();
  const posts = await fetchAllPosts(token);
  console.log(`Loaded ${posts.length} posts`);

  let migrated = 0;
  let skipped = 0;
  let imageDeleted = 0;
  let testCreated = null;

  for (const post of posts) {
    const already =
      post.topicText ||
      post.teacherText ||
      post.scheduleText ||
      post.zoomMeetingId;
    const display = extractPostDisplayData(post.content || '');
    const { sections, proseHtml } = display;

    // Dedupe images even for already-migrated posts.
    const dupes = []; // image dedupe handled by SQL on VPS for speed
    if (dupes.length) {
      console.log(
        `  dedupe ${post.slug}: remove ${dupes.length} duplicate image(s)`,
      );
      if (!DRY_RUN) {
        for (const img of dupes) {
          await deleteImage(token, post.id, img.id);
          imageDeleted += 1;
        }
      } else {
        imageDeleted += dupes.length;
      }
    }

    if (already) {
      skipped += 1;
      continue;
    }

    if (!isAnnouncementCandidate(post, display)) {
      skipped += 1;
      continue;
    }

    if (!sections.topic && !sections.zoom && !sections.teacher) {
      console.log(`  skip (weak parse): ${post.slug}`);
      skipped += 1;
      continue;
    }

    // Avoid wiping ordinary news: require topic or zoom for content clear.
    const clearContent = Boolean(sections.topic || sections.zoom);

    const payload = {
      topicText: sections.topic || '',
      teacherText: sections.teacher || '',
      scheduleText: sections.schedule || '',
      zoomMeetingId: sections.zoom?.meetingId || '',
      zoomPass: sections.zoom?.pass || '',
      zoomUrl: sections.zoom?.joinUrl || '',
      description: proseHtml || '',
      ...(clearContent ? { content: '' } : {}),
    };

    console.log(
      `  migrate ${post.slug} → topic=${payload.topicText || '-'} zoom=${payload.zoomMeetingId || '-'}`,
    );
    if (!DRY_RUN) {
      await updatePost(token, post.id, payload);
    }
    migrated += 1;
  }

  // Smoke-test: create + delete a temporary structured post.
  if (!DRY_RUN) {
    const createRes = await fetch(`${API_BASE}/api/posts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: `[TEST] Thông báo lớp học structured ${Date.now()}`,
        topicText: 'Duy Lực Ngữ Lục TEST',
        teacherText: 'Hoà thượng Thích Minh Hiền',
        scheduleText: 'Tối thứ 2 hằng tuần 19h00-20h00',
        zoomMeetingId: '8196000378',
        zoomPass: 'phatphap',
        description: '',
        isPublished: false,
        categoryIds: posts[0]?.categories?.[0]?.id
          ? [posts[0].categories[0].id]
          : undefined,
      }),
    });
    if (!createRes.ok) {
      throw new Error(`Test create failed: ${createRes.status} ${await createRes.text()}`);
    }
    testCreated = await createRes.json();
    console.log(
      `TEST create ok id=${testCreated.id} topic=${testCreated.topicText} zoom=${testCreated.zoomMeetingId} url=${testCreated.zoomUrl}`,
    );

    const del = await fetch(`${API_BASE}/api/posts/${testCreated.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!del.ok) {
      throw new Error(`Test delete failed: ${del.status}`);
    }
    console.log('TEST delete ok');
  }

  console.log(
    JSON.stringify(
      { migrated, skipped, imageDeleted, dryRun: DRY_RUN },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
