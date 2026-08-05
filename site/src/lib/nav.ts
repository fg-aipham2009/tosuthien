export type NavItem = {
  label: string;
  href: string;
  external?: boolean;
  children?: NavItem[];
};

/** Menu chính, giữ nguyên cấu trúc của tosuthien.com. */
export const MAIN_NAV: NavItem[] = [
  { label: "Trang Chủ", href: "/" },
  { label: "Giới Thiệu", href: "/gioi-thieu" },
  { label: "Tin Tức", href: "/tin-tuc" },
  {
    label: "Youtube",
    href: "https://www.youtube.com/c/TôngPhongTổSưThiền",
    external: true,
    children: [
      {
        label: "Youtube Tông Phong",
        href: "https://www.youtube.com/c/TôngPhongTổSưThiền",
        external: true,
      },
      { label: "Ban Giáo Thọ", href: "/ban-giao-tho" },
    ],
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
    label: "Kinh Sách",
    href: "/kinh-sach",
    children: [
      { label: "Chatbox AI vấn đáp Tổ Sư Thiền", href: "/chatbox-ai" },
      { label: "Media Vấn Đáp HT Thích Duy Lực", href: "/media-van-dap" },
      { label: "Kinh Sách Mobile", href: "/kinh-sach-mobile" },
      { label: "Ebook sách HT Thích Duy Lực", href: "/ebook" },
      { label: "Kinh Sách Liên Quan", href: "/kinh-sach-lien-quan" },
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
  { label: "Hình Ảnh", href: "/hinh-anh" },
];
