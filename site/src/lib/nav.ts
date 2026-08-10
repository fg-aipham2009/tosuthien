export type NavItem = {
  label: string;
  href: string;
  external?: boolean;
  children?: NavItem[];
};

/** Menu chính — Thư viện dùng API Nest (cùng portal tosuthien.net). */
export const MAIN_NAV: NavItem[] = [
  { label: "Trang Chủ", href: "/" },
  { label: "Giới Thiệu", href: "/gioi-thieu" },
  { label: "Tin Tức", href: "/tin-tuc" },
  {
    label: "Youtube",
    href: "https://www.youtube.com/c/TôngPhongTổSưThiền",
    external: true,
  },
  {
    label: "TikTok",
    href: "https://www.tiktok.com/@tongphongtosuthien",
    external: true,
  },
  {
    label: "FanPage",
    href: "https://www.facebook.com/Nhohoivanhin/",
    external: true,
  },
  {
    label: "Thư Viện",
    href: "/hoi-dap",
    children: [
      { label: "Hỏi Đáp Tổ Sư Thiền", href: "/hoi-dap" },
      { label: "Pháp Âm", href: "/phap-am" },
      { label: "Kinh Sách", href: "/kinh-sach" },
    ],
  },
  {
    label: "Danh Sách Thiền Đường",
    href: "/thien-duong",
    children: [
      {
        label: "Trong Nước",
        href: "/thien-duong",
        children: [
          { label: "Miền Nam", href: "/thien-duong?region=NAM" },
          { label: "Miền Trung", href: "/thien-duong?region=TRUNG" },
          { label: "Miền Bắc", href: "/thien-duong?region=BAC" },
        ],
      },
      { label: "Ngoài Nước", href: "/thien-duong?region=NUOC_NGOAI" },
    ],
  },
  { label: "Liên Hệ", href: "/lien-he" },
];
