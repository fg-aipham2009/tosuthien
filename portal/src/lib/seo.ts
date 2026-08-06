/** SEO cho SPA portal (tosuthien.net) — cập nhật thẻ meta theo route. */
export const PORTAL_SITE_URL = (
  import.meta.env.VITE_SITE_URL as string | undefined
)?.replace(/\/$/, "") || "https://tosuthien.net";

export const PORTAL_SITE_NAME = "Tổ Sư Thiền";

const DEFAULT_DESCRIPTION =
  "Hỏi đáp ngữ lục và kinh sách Hòa thượng Thích Duy Lực, pháp âm MP3, thiền đường — Tổ Sư Thiền.";

const ROUTE_SEO: Record<
  string,
  { title: string; description: string; path: string }
> = {
  "/": {
    title: "Hỏi Đáp",
    description:
      "Chatbot hỏi đáp kinh sách, ngữ lục Tổ Sư Thiền — trích dẫn nguồn kinh sách.",
    path: "/",
  },
  "/mp3": {
    title: "Pháp Âm MP3",
    description: "Nghe MP3 khai thị, pháp thoại Tông Phong Tổ Sư Thiền.",
    path: "/mp3",
  },
  "/kinh-sach": {
    title: "Kinh Sách",
    description: "Đọc kinh sách bản chữ và PDF gốc Hòa thượng Thích Duy Lực.",
    path: "/kinh-sach",
  },
  "/thien-duong": {
    title: "Thiền Đường",
    description: "Danh sách thiền đường, chùa trong Tông Phong Tổ Sư Thiền.",
    path: "/thien-duong",
  },
};

function matchRoute(path: string) {
  if (path.startsWith("/mp3/")) {
    return {
      title: "Album Pháp Âm",
      description: ROUTE_SEO["/mp3"].description,
      path,
    };
  }
  if (path.startsWith("/kinh-sach/pdf/")) {
    return {
      title: "Đọc PDF",
      description: ROUTE_SEO["/kinh-sach"].description,
      path,
    };
  }
  if (path.startsWith("/kinh-sach/chu/")) {
    return {
      title: "Đọc Chữ",
      description: ROUTE_SEO["/kinh-sach"].description,
      path,
    };
  }
  if (path.startsWith("/thien-duong/")) {
    return {
      title: "Chi Tiết Thiền Đường",
      description: ROUTE_SEO["/thien-duong"].description,
      path,
    };
  }
  return ROUTE_SEO[path] ?? ROUTE_SEO["/"];
}

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  if (typeof document === "undefined") return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel: string, href: string) {
  if (typeof document === "undefined") return;
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export function applyPortalSeo(pathname: string) {
  const meta = matchRoute(pathname);
  const pageTitle = `${meta.title} · ${PORTAL_SITE_NAME}`;
  const url = `${PORTAL_SITE_URL}${meta.path === pathname ? meta.path : pathname}`;

  document.title = pageTitle;
  upsertMeta("name", "description", meta.description);
  upsertMeta("property", "og:type", "website");
  upsertMeta("property", "og:locale", "vi_VN");
  upsertMeta("property", "og:site_name", PORTAL_SITE_NAME);
  upsertMeta("property", "og:title", pageTitle);
  upsertMeta("property", "og:description", meta.description);
  upsertMeta("property", "og:url", url);
  upsertMeta("property", "og:image", `${PORTAL_SITE_URL}/icons/icon-512.png`);
  upsertMeta("name", "twitter:card", "summary_large_image");
  upsertMeta("name", "twitter:title", pageTitle);
  upsertMeta("name", "twitter:description", meta.description);
  upsertMeta("name", "twitter:image", `${PORTAL_SITE_URL}/icons/icon-512.png`);
  upsertLink("canonical", url);
}

export { DEFAULT_DESCRIPTION };
