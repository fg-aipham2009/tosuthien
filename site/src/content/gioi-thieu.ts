/** Nội dung trang Giới Thiệu, lấy từ tosuthien.com/gioi-thieu/ */

export const INTRO =
  "Phật giáo Việt Nam vào cuối thế kỷ 20, Thiền sư Duy Lực đã thắp sáng lại ngọn đèn thiền, tô đậm nét Tông chỉ Tổ Đạt Ma, trải qua hơn 20 năm chuyên hoằng dương Tổ Sư Thiền (dạy tham thiền thoại đầu) ở Việt Nam và các nước trên thế giới.";

/** Bốn đoạn đầu của mục A, cũng dùng làm phần tóm tắt ở trang chủ. */
export const THOI_THO_AU = [
  "Sư họ LA húy DŨ hiệu DUY LỰC, tự GIÁC KHAI, sanh ngày 05 tháng 05 năm 1923 tại làng Long Tuyền, huyện Bình Thủy tỉnh Cần Thơ, Việt Nam. Cha La Xương và mẹ Lưu Thị, làm nghề nông.",
  "Năm lên 7 tuổi, theo cha về quê sống tại làng Long Yên, huyện Phong Thuận phủ Triều Châu tỉnh Quảng Đông Trung Quốc. Sau khi tốt nghiệp phổ thông cấp 1, thì Sư phải nghỉ học theo cha trở lại Việt Nam sinh sống, lúc đó Sư được 16 tuổi (1938). Trú tại tỉnh Cần Thơ.",
  "Sư thường tranh thủ tự học trong lúc rỗi rảnh. Đến năm 26 tuổi (1948), thi đậu bằng giáo viên Hoa văn, từng cộng tác biên soạn cho tờ báo Viễn Đông tiếng Hoa tại Chợ Lớn và được mời dạy ở các trường tiểu học tỉnh Tà-Keo Cao Miên (Nay là Campuchia), trường Khải Trí ở Cần Thơ, Trường Cái Vồn ở Vĩnh Long trong thời gian 10 năm. Năm 1958, sau khi thi lấy bằng Đông y sĩ cấp 1, Sư được mời làm đông y sĩ cho tiệm thuốc Tế Ngươn Đường Cà mau, Minh Nguyệt Cư Sĩ Lâm tỉnh Cần Thơ để khám bệnh miễn phí cho dân trong thời gian 8 năm.",
  "Trong tủ sách của Cư Sĩ Lâm có bộ Kinh Tục Tạng gồm 150 quyển, lúc đầu Sư định đọc hết toàn bộ, nhưng trải qua một năm chỉ xem được 7 quyển, sau quyết định chỉ xem phần Thiền tông. Lúc đó Sư theo Pháp sư DIỆU DUYÊN tham học Tổ Sư Thiền (Ngài Diệu Duyên đã nhiều năm thân cận Lai Quả Thiền Sư và Hư Vân Thiền Sư, và Ngài tịch vào năm 1976 tại Chùa Thảo Đường).",
];

export type Section = {
  id: string;
  heading: string;
  paragraphs: string[];
};

export const SECTIONS: Section[] = [
  {
    id: "thoi-tho-au",
    heading: "A.THỜI THƠ ẤU",
    paragraphs: THOI_THO_AU,
  },
  {
    id: "xuat-gia",
    heading: "B. THỜI KỲ XUẤT GIA HỌC ĐẠO",
    paragraphs: [
      "Vào Mùng 08 tháng 02 năm 1973, Sư được Hòa Thượng HOẰNG TU cho xuất gia tu học tại Chùa Từ Ân Quận 11 Chợ Lớn. Tháng 05 năm 1974, Sư thọ giới Tam Đàn Cụ Túc tại Chùa Cực Lạc Malaysia.",
      "Từ đó Sư chuyên tham câu thoại đầu “Khi chưa có trời đất ta là cái gì?”. Trải qua nhiều năm, một hôm do đọc quyển Trung Quán Luận đến câu: “Do có nghĩa KHÔNG nên thành tựu tất cả pháp” đốn ngộ ý chỉ “TỪ KHÔNG HIỂN DỤNG”, lại tỏ ngộ câu “KHÔNG sanh nơi đại giác, như biển nổi hòn bọt, vô số nước hữu lậu, đều từ KHÔNG sanh khởi” trong Kinh Lăng Nghiêm, với ý “Lấy VÔ TRỤ làm gốc” của Ngài Lục Tổ; “Từ gốc VÔ TRỤ lập tất cả pháp” của Ngài Duy Ma Cật vốn cùng một ý chỉ.",
      "VÔ TRỤ tức TÁNH KHÔNG, thể Chơn Như vốn KHÔNG mà tự hiển bày sự dụng; thể và dụng của Chư Phật với chúng sanh vốn chẳng hai chẳng khác, cùng khắp không gian thời gian, nơi thánh chẳng thêm, nơi phàm chẳng bớt, dù là phàm phu mà sức dụng của Phật Tánh chẳng kém hơn Phật, cũng chẳng từng gián đoạn, chỉ vì chúng sanh ứng dụng hàng ngày mà chẳng tự biết.",
    ],
  },
  {
    id: "hoang-phap",
    heading: "C. THỜI KỲ HOẰNG PHÁP",
    paragraphs: [
      "Ngày mùng 02 tháng 04 năm 1977, thừa lệnh Hòa Thượng Bổn sư (Hòa Thượng Thích Hoằng Tu), Sư ra hoằng pháp Tổ Sư Thiền tại Chùa Từ Ân đường Hùng Vương Quận 11 TP.HCM. Đến năm 1983, tứ chúng quy tụ ngày càng đông, Phật tử theo tu học pháp Tổ Sư Thiền hơn 4000 người, mỗi lần tham dự thiền thất đều vượt trên 300 người.",
      "Từ những năm 1990, Hòa Thượng thường đi giảng Thiền ở nhiều nơi trên thế giới. Đến thiền đường học đạo có người Tây, Âu và Á Châu, trong đó người Việt Nam là đông nhất. Những năm cuối đời, Sư thường được thỉnh đến giảng tại các nước trên thế giới như: Chùa Chánh Giác ở Toronto Canada, Chùa Quan Âm ở Brisbane Australia, Tịnh xá Đại Bi ở Đài Loan và một số chùa ở Hồng Kông. Nhất là các thiền đường ở Mỹ để giảng dạy pháp Tổ Sư Thiền và thính chúng lui tới tu học đông đảo.",
    ],
  },
];

export const KINH_SACH_HEADING = "D. CÁC KINH SÁCH SƯ TRƯỚC TÁC VÀ PHIÊN DỊCH";

export const KINH_SACH_INTRO = [
  "Ngoài ra Sư còn trước tác và dịch thuật từ tiếng Hán sang tiếng Việt hơn 20 loại kinh điển và ngữ lục. Lượng sách phát hành tại Việt Nam trên mấy mươi ngàn quyển.",
  "* Các Kinh sách được phát hành bao gồm:",
];

export type BookEntry = {
  title: string;
  items?: string[];
};

export const KINH_SACH: BookEntry[] = [
  { title: "Đường Lối Thực Hành Tham Tổ Sư Thiền" },
  { title: "Kinh Lăng Nghiêm" },
  { title: "Kinh Lăng Già" },
  { title: "Kinh Pháp Bảo Đàn" },
  { title: "Triệu Luận" },
  { title: "Tham Thiền Phổ Thuyết" },
  { title: "Danh Từ Thiền Học" },
  { title: "Cội Nguồn Truyền Thừa – Thiền Thất Khai Thị Lục" },
  { title: "Phật Pháp và Khoa học" },
  { title: "Nam Tuyền Ngữ Lục – Bửu Tạng Luận" },
  { title: "Lâm Tế Ngữ Lục – Trung Phong Pháp Ngữ" },
  { title: "Lược Giảng Kinh Lăng Nghiêm" },
  {
    title: "Chư Kinh Tập Yếu",
    items: [
      "Kinh Kim Cang",
      "Bát Nhã Tâm Kinh lược giải",
      "Yếu Chỉ Kinh Pháp Hoa",
      "Yếu Chỉ Kinh Hoa Nghiêm",
      "Kinh Duy-ma-cật",
      "Kinh Viên Giác",
    ],
  },
  { title: "Đại Thừa Tuyệt Đối Luận" },
  { title: "Tín Tâm Minh tịch nghĩa giải" },
  {
    title: "Góp Nhặt Lời Phật Tổ và Thánh Hiền",
    items: [
      "Góp Nhặt Lời Phật Tổ và Thánh Hiền",
      "Công án của Phật Thích Ca và Tổ Đạt Ma",
      "Bá Trượng Quảng Lục và Ngữ Lục",
      "Truyền Tâm Pháp Yếu",
    ],
  },
  {
    title: "Vũ Trụ Quan Thế Kỷ XXI",
    items: ["Yếu Chỉ Phật Pháp", "Yếu Chỉ Trung Quán Luận"],
  },
  {
    title: "Phật Pháp với Thiền Tông",
    items: ["Đại Huệ Ngữ Lục", "Tham Thiền Cảnh Ngữ"],
  },
  { title: "Đường lối thực hành Tham Tổ Sư Thiền (bản tiếng Anh)" },
  { title: "Duy Lực Ngữ Lục (Thượng – Hạ)" },
  { title: "Duy Lực Ngữ Lục (Tiếng Hoa)" },
];

export const KINH_SACH_OUTRO =
  "Dù ở cương vị nào và bất cứ nơi đâu, Sư đều tùy duyên giảng dạy, như: Đả Thiền Thất tại Chùa Từ Ân Quận 11; Chùa Hưng Phước đường Cách Mạng Tháng 8 quận 3; Chùa Pháp Thành Quận 6; Chùa Sùng Đức Quận 6; Chùa Huệ Quang quận Tân Bình; và tại các tỉnh Long An; Đồng Tháp; Sóc Trăng; Tây Ninh; Đại Tòng Lâm Bà Rịa Vũng Tàu; tỉnh Khánh Hòa; Bình Định v.v…";

export const SECTIONS_CUOI: Section[] = [
  {
    id: "phat-su-giao-hoi",
    heading: "Đ. THỜI KỲ THAM GIA PHẬT SỰ GIÁO HỘI",
    paragraphs: [
      "Đến năm 1998, Sư đã được Ban Hoằng Pháp Trung ương Giáo Hội Phật giáo Việt Nam mời thỉnh vào Ban Hoằng Pháp Trung Ương. Với cương vị Ủy viên Ban Hoằng Pháp Trung ương, Sư đã được Giáo hội phân thỉnh giảng tại các Khóa Bồi Dưỡng Hoằng pháp ngắn hạn cho các tỉnh miền Trung tổ chức tại Bình Định, cho các tỉnh Miền Đông, TP. Hồ Chí Minh và Miền Nam tại Văn Phòng 2 Trung Ương Giáo Hội.",
    ],
  },
  {
    id: "vien-tich",
    heading: "E. THỜI KỲ VIÊN TỊCH",
    paragraphs: [
      "Sư biện tài vô ngại, tùy duyên hóa độ và tận tụy với Hoằng pháp lợi sanh, chẳng kể gian lao, không từ khó nhọc. Người xưa có nói “Bồ Tát dĩ lợi sanh vi bổn hoài”, thật khế hợp với Sư biết bao.",
      "Hóa duyên ký tất, Sư thâu thần thị tịch lúc 01 giờ 30 giờ Việt Nam, ngày 02 tháng 12 năm Kỷ Mão (08/01/2000). Trụ thế 77 năm.",
    ],
  },
];

export const KY_TEN = "Môn nhơn đồng bái soạn";
