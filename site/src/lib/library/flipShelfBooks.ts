/**
 * Snapshot of FlipHTML5 bookcase `smonj` (TỔ SƯ THIỀN).
 * Source page is behind Cloudflare, so we mirror bookData here for a same-origin embed.
 * Update this list when books are added/removed on FlipHTML5.
 */
export type FlipShelfBook = {
  id: number;
  title: string;
  description: string;
  url: string;
  coverimg: string;
  price: number;
  pages: number;
  newTime: string;
  isNew: number;
  categoryid: number;
  categoryname: string;
  bLink: string;
  label: number;
};

export const FLIP_SHELF_META = {
  title: "TỔ SƯ THIỀN",
  name: "TỔSƯTHIÊN",
  uLink: "vgypb",
  uId: "23481993",
  bookcaseLink: "smonj",
  accountLogo: "https://online.fliphtml5.com/vgypb/accountlogo.jpg",
  updateTime: "1684482971",
} as const;

export const FLIP_SHELF_BOOKS: FlipShelfBook[] = [
  {
    id: 34594161,
    title: "Tham Thiền Phổ Thuyết",
    description: "",
    url: "https://online.fliphtml5.com/vgypb/wzjq/",
    coverimg: "https://online.fliphtml5.com/vgypb/wzjq/files/shot.jpg",
    price: 0,
    pages: 363,
    newTime: "2024-02-23 20:55:35",
    isNew: 1,
    categoryid: 0,
    categoryname: "None",
    bLink: "wzjq",
    label: 0,
  },
  {
    id: 88893345,
    title: "Góp Nhặt Lời Phật Tổ và Thánh Hiền",
    description: "Dịch giả : HT.Thích Duy Lực",
    url: "https://online.fliphtml5.com/vgypb/zmqn/",
    coverimg: "https://online.fliphtml5.com/vgypb/zmqn/files/shot.jpg",
    price: 0,
    pages: 262,
    newTime: "2024-02-23 20:37:16",
    isNew: 1,
    categoryid: 0,
    categoryname: "None",
    bLink: "zmqn",
    label: 0,
  },
  {
    id: 30910231,
    title: "Đại Thừa Tuyệt Đối Luận -Tín Tâm Minh Tịch Nghĩa Giải",
    description: "",
    url: "https://online.fliphtml5.com/vgypb/hexe/",
    coverimg: "https://online.fliphtml5.com/vgypb/hexe/files/shot.jpg",
    price: 0,
    pages: 177,
    newTime: "2023-09-11 09:52:04",
    isNew: 1,
    categoryid: 0,
    categoryname: "None",
    bLink: "hexe",
    label: 0,
  },
  {
    id: 94920408,
    title: "Đường Lối Thực Hành Tham Tổ Sư Thiền HT.Thích Duy Lực",
    description: "",
    url: "https://online.fliphtml5.com/vgypb/sgty/",
    coverimg: "https://online.fliphtml5.com/vgypb/sgty/files/shot.jpg",
    price: 0,
    pages: 25,
    newTime: "2023-05-18 22:14:16",
    isNew: 1,
    categoryid: 0,
    categoryname: "None",
    bLink: "sgty",
    label: 0,
  },
  {
    id: 12473906,
    title: "Lược Giảng Kinh Kim Cang",
    description: "",
    url: "https://online.fliphtml5.com/vgypb/snjl/",
    coverimg: "https://online.fliphtml5.com/vgypb/snjl/files/shot.jpg",
    price: 0,
    pages: 134,
    newTime: "2023-05-18 23:20:53",
    isNew: 1,
    categoryid: 0,
    categoryname: "None",
    bLink: "snjl",
    label: 0,
  },
  {
    id: 73025070,
    title: "Kinh Lăng Nghiêm - HT.Thích Duy Lực",
    description: "",
    url: "https://online.fliphtml5.com/vgypb/xcqc/",
    coverimg: "https://online.fliphtml5.com/vgypb/xcqc/files/shot.jpg",
    price: 0,
    pages: 305,
    newTime: "2023-05-18 22:58:04",
    isNew: 1,
    categoryid: 0,
    categoryname: "None",
    bLink: "xcqc",
    label: 0,
  },
  {
    id: 46086611,
    title: "Kinh Lăng Già HT.Thích Duy Lực",
    description: "",
    url: "https://online.fliphtml5.com/vgypb/tyik/",
    coverimg: "https://online.fliphtml5.com/vgypb/tyik/files/shot.jpg",
    price: 0,
    pages: 249,
    newTime: "2023-05-18 22:39:32",
    isNew: 1,
    categoryid: 0,
    categoryname: "None",
    bLink: "tyik",
    label: 0,
  },
  {
    id: 78603241,
    title: "Triệu Luận Lược Giải",
    description: "",
    url: "https://online.fliphtml5.com/vgypb/ozks/",
    coverimg: "https://online.fliphtml5.com/vgypb/ozks/files/shot.jpg",
    price: 0,
    pages: 112,
    newTime: "2023-05-21 21:29:31",
    isNew: 1,
    categoryid: 0,
    categoryname: "None",
    bLink: "ozks",
    label: 0,
  },
  {
    id: 97700930,
    title: "Danh Từ Thiền Học (Chú Giải) -HT Thích Duy Lực",
    description: "",
    url: "https://online.fliphtml5.com/vgypb/gxoz/",
    coverimg: "https://online.fliphtml5.com/vgypb/gxoz/files/shot.jpg",
    price: 0,
    pages: 30,
    newTime: "2023-05-21 21:07:49",
    isNew: 1,
    categoryid: 0,
    categoryname: "None",
    bLink: "gxoz",
    label: 0,
  },
];
