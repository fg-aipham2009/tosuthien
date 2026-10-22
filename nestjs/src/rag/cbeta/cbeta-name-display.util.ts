/**
 * Sino-Vietnamese / English display forms for patriarch & lamp master names.
 * VI answers must not leave bare Hán rows mixed into a Vietnamese list.
 */

import { HANVIET_CHAR } from './cbeta-hanviet-chars';

const NAME_VI: Record<string, string> = {
  摩訶迦葉: 'Ma-ha Ca-diếp',
  迦葉: 'Ca-diếp',
  阿難: 'A-nan',
  商那和修: 'Thương-na Hòa-tu',
  優波毱多: 'Ưu-ba-cúc-đa',
  提多迦: 'Đề-đa-ca',
  彌遮迦: 'Di-già-ca',
  婆須蜜: 'Bà-tu-mật',
  佛陀難提: 'Phật-đà Nan-đề',
  伏馱蜜多: 'Phục-đà Mật-đa',
  脅尊者: 'Hiệp Tôn giả',
  富那夜奢: 'Phú-na Dạ-xa',
  馬鳴: 'Mã Minh',
  迦毘摩羅: 'Ca-tỳ-ma-la',
  龍樹: 'Long Thọ',
  迦那提婆: 'Ca-na Đề-bà',
  羅睺羅多: 'La-hầu-la-đa',
  僧伽難提: 'Tăng-già Nan-đề',
  伽耶舍多: 'Già-da Xá-đa',
  鳩摩羅多: 'Cưu-ma-la-đa',
  闍夜多: 'Xà-dạ-đa',
  婆修盤頭: 'Bà-tu Bàn-đầu',
  摩拏羅: 'Ma-nã-la',
  鶴勒那: 'Hạc-lặc-na',
  師子: 'Sư Tử',
  婆舍斯多: 'Bà-xá-tư-đa',
  不如密多: 'Bất-như Mật-đa',
  般若多羅: 'Bát-nhã Đa-la',
  菩提達磨: 'Bồ-đề Đạt-ma',
  達磨: 'Đạt-ma',
  慧可: 'Huệ Khả',
  僧璨: 'Tăng Xán',
  道信: 'Đạo Tín',
  弘忍: 'Hoằng Nhẫn',
  慧能: 'Huệ Năng',
  懷讓: 'Hoài Nhượng',
  南嶽懷讓: 'Nam Nhạc Hoài Nhượng',
  行思: 'Hành Tư',
  青原行思: 'Thanh Nguyên Hành Tư',
  原山行思: 'Thanh Nguyên Hành Tư',
  馬祖道一: 'Mã Tổ Đạo Nhất',
  道一: 'Đạo Nhất',
  大寂道一: 'Đại Tịch Đạo Nhất',
  臨濟義玄: 'Lâm Tế Nghĩa Huyền',
  義玄: 'Nghĩa Huyền',
  南泉普願: 'Nam Tuyển Phổ Nguyện',
  趙州從諗: 'Triệu Châu Tòng Thẩm',
  從諗: 'Tòng Thẩm',
  荷澤神會: 'Hà Trạch Thần Hội',
  神會: 'Thần Hội',
  神秀: 'Thần Tú',
  北宗神秀: 'Bắc Tông Thần Tú',
  洞山良价: 'Động Sơn Lương Giới',
  雲門: 'Vân Môn',
  雲門文偃: 'Vân Môn Văn Yểm',
  溈山靈祐: 'Quy Sơn Linh Hựu',
  仰山慧寂: 'Ngưỡng Sơn Huệ Tịch',
  德山宣鑒: 'Đức Sơn Tuyên Giám',
  黃檗希運: 'Hoàng Bá Hy Vận',
  檗山希運: 'Hoàng Bá Hy Vận',
  藥山惟儼: 'Dược Sơn Duy Nghiễm',
  曹山本寂: 'Tào Sơn Bản Tịch',
  雪峯義存: 'Tuyết Phong Nghĩa Tồn',
  百丈懷海: 'Bách Trượng Hoài Hải',
  懷海: 'Hoài Hải',
  石頭希遷: 'Thạch Đầu Hy Thiên',
  清涼文益: 'Thanh Lương Văn Ích',
  法眼文益: 'Pháp Nhãn Văn Ích',
  玄奘: 'Huyền Trang',
  // Yangqi / Linji Song masters (Ngũ Đăng / Phổ Đăng / Thế Phổ)
  楊岐方會: 'Dương Kỳ Phương Hội',
  白雲守端: 'Bạch Vân Thủ Đoan',
  五祖法演: 'Ngũ Tổ Pháp Diễn',
  法演: 'Pháp Diễn',
  圓悟克勤: 'Viên Ngộ Khắc Cần',
  克勤: 'Khắc Cần',
  佛鑑慧懃: 'Phật Giám Huệ Cần',
  佛眼清遠: 'Phật Nhãn Thanh Viễn',
  大慧宗杲: 'Đại Huệ Tông Cảo',
  大慧普覺: 'Đại Huệ Phổ Giác',
  宗杲: 'Tông Cảo',
  虎丘紹隆: 'Hổ Khâu Thiệu Long',
  育王端裕: 'Dục Vương Đoan Dụ',
  教忠彌光: 'Giáo Trung Di Quang',
  竹庵士珪: 'Trúc Am Sĩ Khuê',
  宏智正覺: 'Hoằng Trí Chính Giác',
  真歇清了: 'Chân Hiết Thanh Liễu',
  自得慧暉: 'Tự Đắc Huệ Huy',
  聞庵嗣宗: 'Văn Am Tự Tông',
  善權法智: 'Thiện Quyền Pháp Trí',
  大洪法為: 'Đại Hồng Pháp Vi',
  懶庵鼎需: 'Lãn Am Đỉnh Nhu',
  棗山光仁: 'Táo Sơn Quang Nhân',
  茂源: 'Mậu Nguyên',
  德山子涓: 'Đức Sơn Tử Quyên',
  妙道: 'Diệu Đạo',
  無著妙總: 'Vô Trước Diệu Tổng',
};

const NAME_EN: Record<string, string> = {
  摩訶迦葉: 'Mahākāśyapa',
  迦葉: 'Kāśyapa',
  阿難: 'Ānanda',
  商那和修: 'Śāṇavāsa',
  優波毱多: 'Upagupta',
  提多迦: 'Dhītika',
  彌遮迦: 'Miccaka',
  婆須蜜: 'Vasumitra',
  佛陀難提: 'Buddhanandi',
  伏馱蜜多: 'Buddhamitra',
  脅尊者: 'Pārśva',
  富那夜奢: 'Puṇyayaśas',
  馬鳴: 'Aśvaghoṣa',
  迦毘摩羅: 'Kapimala',
  龍樹: 'Nāgārjuna',
  迦那提婆: 'Kāṇadeva',
  羅睺羅多: 'Rāhulata',
  僧伽難提: 'Saṅghanandi',
  伽耶舍多: 'Gayāśata',
  鳩摩羅多: 'Kumārata',
  闍夜多: 'Jayata',
  婆修盤頭: 'Vasubandhu',
  摩拏羅: 'Manorhita',
  鶴勒那: 'Haklenayaśas',
  師子: 'Siṃha',
  婆舍斯多: 'Basiasita',
  不如密多: 'Puṇyamitra',
  般若多羅: 'Prajñātāra',
  菩提達磨: 'Bodhidharma',
  達磨: 'Bodhidharma',
  慧可: 'Huike',
  僧璨: 'Sengcan',
  道信: 'Daoxin',
  弘忍: 'Hongren',
  慧能: 'Huineng',
  懷讓: 'Huairang',
  南嶽懷讓: 'Nanyue Huairang',
  行思: 'Xingsi',
  青原行思: 'Qingyuan Xingsi',
  原山行思: 'Qingyuan Xingsi',
  馬祖道一: 'Mazu Daoyi',
  道一: 'Daoyi',
  大寂道一: 'Daji Daoyi',
  臨濟義玄: 'Linji Yixuan',
  義玄: 'Yixuan',
  南泉普願: 'Nanquan Puyuan',
  趙州從諗: 'Zhaozhou Congshen',
  從諗: 'Congshen',
  荷澤神會: 'Heze Shenhui',
  神會: 'Shenhui',
  神秀: 'Shenxiu',
  北宗神秀: 'Northern school Shenxiu',
  洞山良价: 'Dongshan Liangjie',
  雲門: 'Yunmen',
  雲門文偃: 'Yunmen Wenyan',
  溈山靈祐: 'Weishan Lingyou',
  仰山慧寂: 'Yangshan Huiji',
  德山宣鑒: 'Deshan Xuanjian',
  黃檗希運: 'Huangbo Xiyun',
  檗山希運: 'Huangbo Xiyun',
  藥山惟儼: 'Yaoshan Weiyan',
  曹山本寂: 'Caoshan Benji',
  雪峯義存: 'Xuefeng Yicun',
  百丈懷海: 'Baizhang Huaihai',
  懷海: 'Huaihai',
  石頭希遷: 'Shitou Xiqian',
  清涼文益: 'Qingliang Wenyi',
  法眼文益: 'Fayan Wenyi',
  玄奘: 'Xuanzang',
  楊岐方會: 'Yangqi Fanghui',
  白雲守端: 'Baiyun Shouduan',
  五祖法演: 'Wuzu Fayan',
  法演: 'Fayan',
  圓悟克勤: 'Yuanwu Keqin',
  克勤: 'Keqin',
  佛鑑慧懃: 'Fojian Huiqin',
  佛眼清遠: 'Foyan Qingyuan',
  大慧宗杲: 'Dahui Zonggao',
  大慧普覺: 'Dahui Pujue',
  宗杲: 'Zonggao',
  虎丘紹隆: 'Huqiu Shaolong',
  育王端裕: 'Yuwang Duanyu',
  教忠彌光: 'Jiaozhong Miguang',
  竹庵士珪: "Zhu'an Shigui",
  宏智正覺: 'Hongzhi Zhengjue',
  真歇清了: 'Zhenxie Qingliao',
  自得慧暉: 'Zide Huihui',
  聞庵嗣宗: "Wen'an Sizong",
  善權法智: 'Shanquan Fazhi',
  大洪法為: 'Dahong Fawei',
  懶庵鼎需: "Lan'an Dingxu",
  棗山光仁: 'Zaoshan Guangren',
  茂源: 'Maoyuan',
  德山子涓: 'Deshan Zijuan',
  妙道: 'Miaodao',
  無著妙總: 'Wuzhuo Miaozong',
};

export type NameDisplayLang = 'vi' | 'en' | 'zh';

/** Char-by-char Hán-Việt reading; null if any syllable is unknown. */
export function sinoVietReading(nameZh: string): string | null {
  const zh = (nameZh || '').trim();
  if (!zh) return null;
  const parts: string[] = [];
  for (const ch of zh) {
    const syl = HANVIET_CHAR[ch];
    if (!syl) return null;
    parts.push(syl);
  }
  return parts.join(' ');
}

/** Drop Vietnamese diacritics for a Latin fallback line in EN answers. */
function latinFallback(viOrReading: string): string {
  // Use explicit combining-mark range (not \p{M}) so compiled Nest/ES targets work.
  return viOrReading
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/** True when VI/EN can show a localized form (curated or full Hán-Việt). */
export function hasMasterDisplayName(
  nameZh: string,
  lang: NameDisplayLang = 'vi',
): boolean {
  const zh = (nameZh || '').trim();
  if (!zh) return false;
  if (lang === 'zh') return true;
  // EN: curated English, or same coverage as VI (Latin fallback from Hán-Việt).
  if (lang === 'en') {
    return Boolean(NAME_EN[zh] || NAME_VI[zh] || sinoVietReading(zh));
  }
  return Boolean(NAME_VI[zh] || sinoVietReading(zh));
}

/**
 * One list line for the answer language.
 * VI: always localized name + Hán in parentheses (never bare Hán alone).
 * EN: curated English when mapped; else Latinized Hán-Việt + Hán (fuller lists).
 * ZH: Hán only.
 */
export function formatMasterDisplayName(
  nameZh: string,
  lang: NameDisplayLang,
): string {
  const zh = (nameZh || '').trim();
  if (!zh) return '';
  if (lang === 'zh') return zh;
  if (lang === 'en') {
    const mapped = NAME_EN[zh];
    if (mapped) return `${mapped} (${zh})`;
    const vi = NAME_VI[zh] || sinoVietReading(zh);
    if (vi) return `${latinFallback(vi)} (${zh})`;
    return zh;
  }
  const curated = NAME_VI[zh];
  if (curated) return `${curated} (${zh})`;
  const reading = sinoVietReading(zh);
  if (reading) return `${reading} (${zh})`;
  // Should be filtered out of VI appendix; keep Hán only as last resort.
  return zh;
}
