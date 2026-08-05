-- Seed: sync WP thiền đường content + missing centers
-- Generated for tosuthien centers table

INSERT INTO centers (
  id, slug, temple_name, region, country_code, province, address, phone,
  abbot_name, main_image_url, detail_content, sort_order, is_published, gallery_images
) VALUES (
  '04073a48-da74-5f65-b031-8ea5d8b5c152'::uuid,
  'chua-thien-quang',
  'Chùa Thiện Quang',
  'NAM',
  'VN',
  'Bà Rịa - Vũng Tàu',
  '6, Phạm Hữu Chí, KP Long An, TT Long Điền, Long Điện, BRVT',
  '',
  NULL,
  $$https://tosuthien.com/wp-content/uploads/2021/11/Luoc-giang-kinh-Lang-Nghiem-4.png$$,
  $$6, Phạm Hữu Chí, KP Long An, TT Long Điền, Long Điện, BRVT$$,
  50,
  true,
  '[]'::jsonb
) ON CONFLICT (slug) DO UPDATE SET
  address = EXCLUDED.address,
  province = EXCLUDED.province,
  region = EXCLUDED.region,
  detail_content = COALESCE(NULLIF(EXCLUDED.detail_content, ''), centers.detail_content),
  main_image_url = COALESCE(centers.main_image_url, EXCLUDED.main_image_url);

INSERT INTO centers (
  id, slug, temple_name, region, country_code, province, address, phone,
  abbot_name, main_image_url, detail_content, sort_order, is_published, gallery_images
) VALUES (
  '39fb9f6b-3e30-57e4-a78a-b5c4f43ce900'::uuid,
  'chua-phuoc-duc',
  'Chùa Phước Đức',
  'TRUNG',
  'VN',
  NULL,
  NULL,
  '',
  NULL,
  $$https://tosuthien.com/wp-content/uploads/2023/06/TU-NGHI-DEN-NGO-1.png$$,
  NULL,
  51,
  true,
  '[]'::jsonb
) ON CONFLICT (slug) DO UPDATE SET
  region = EXCLUDED.region,
  main_image_url = COALESCE(centers.main_image_url, EXCLUDED.main_image_url);

-- Chùa Thiên Trì
UPDATE centers SET detail_content = $$Nói đến những điểm tu Tổ sư thiền tại thành phố Hồ Chí Minh, không thể không nhắc đến Chùa Thiên Trì, ngôi chùa nằm cạnh ngã tư QL50 – đại lộ Nguyễn Văn Linh, xã Bình Hưng, huyện Bình Chánh, Thành phố Hồ Chí Minh.

Khởi nguyên chùa được xây dựng năm 1945 tại làng Tân Phong Hạ, Hạt Chợ Lớn, tỉnh Gia Định (tức ấp 4, xã Bình Hưng, Bình Chánh ngày nay) do Hòa thượng Thích Pháp Chí khai sơn. Đó là vùng chiến tranh nên đến năm 1962, chùa dời ra cạnh Quốc lộ 50 cho đến nay. Ngôi chùa nhỏ với diện tích đất khoảng 1.000m2 được mọc lên khiêm tốn bên cạnh con rạch Lào, phía trước là Quốc lộ 50. Con rạch đã bị đại lộ Nguyễn Văn Linh chắn ngang, sau này các khu dân cư mọc lên và sang lắp dần dần. Đại lão Hòa thượng Thích Pháp Chí, môn đệ của Hòa thượng Huệ Đăng khai sơn Tổ đình Thiên Thai (Long Điền, Long Hải), là người chuyên tu pháp môn Tịnh độ. Nhưng khi nghe danh đức Thiền sư Duy Lực, Hòa thượng đã thỉnh về đây chia sẻ những điểm tinh yếu và các mối liên hệ giữa Thiền và Tịnh độ. Đó là khoảng năm 1994. Hai vị Hòa thượng rất tâm đầu ý hợp.

Năm 1999, khuya 11-8 (mùng 01-7 âl), Hòa thượng Pháp Chí thị tịch sau cơn bệnh nhẹ (thọ thế 96 năm). Hòa thượng Huệ Minh (lúc đó còn là Đại đức) kế vị và được bổ nhiệm Trụ trì vào ngày mùng 1-7 năm Canh Thìn (2000), nhân ngày Húy nhật lần thứ nhất (Tiểu tường cố HT Pháp Chí).

Từ khi đảm nhiệm Trụ trì, thầy Huệ Minh chăm lo tu sửa Chánh điện, Tổ đường, tổ chức tu học cho chư tăng và phật tử bổn tự. Năm 2010, thầy Trụ trì cho phá bỏ toàn bộ các hạng mục cũ vì xuống cấp trầm trọng và xây dựng mới. Năm 2012 việc xây dựng hoàn tất, thầy mở lớp giáo lý cho phật tử sơ cơ, rồi mở khóa tu Bát quan trai. Khi phật tử có kiến thức cơ bản, có niềm tin vững chắc, thầy bắt đầu mở những khóa tu thiền. Tuy nhiên vì không gian quá hạn hẹp, không đáp ứng cho số lượng phật tử ở lại qua đêm, nên thầy không mở Thiền thất mà chỉ mở KHÓA THIỀN CHỦ NHẬT HẰNG TUẦN cho tăng ni, phật tử. Số lượng ban đầu hơn 50 người, nhưng dần về sau, nhất là sau đại dịch Covid-19, số lượng vơi dần. Hiện nay mỗi Chủ nhật, các hành giả về tham dự trung bình khoảng 30 vị.

Dự kiến, vị Trụ trì được chọn để kế vị Hòa thượng Thích Huệ Minh là Thượng tọa Thích Tắc Quang.

Khóa tu ngày Chủ nhật, bắt đầu từ 8:00 sáng đến 4:00 chiều. Đặc biệt, lúc 3:00 đến 4:00 chiều có buổi chia sẻ về Thiền Online trên nền tảng ZOOM và trực tiếp trên Facebook Chùa Thiên Trì.

Thông tin liên hệ

Trụ Trì

Hòa Thượng Thích Huệ Minh

Số Điện Thoại : 0908400155

Thời Khóa Tu Ngày Thường

Khuya: 4:00 – 6:00 AM

Sáng: 8:30 – 11:00 AM

Chiều: 14:30 – 17:00 PM

Tối: 18:30 – 20:30 PM

Địa Chỉ

B15/20 quốc lộ 50, ấp 3A, xã Bình Hưng, huyện Bình Chánh

Giờ mở Của

8:00 AM – 20:00 PM$$ WHERE id = '9122dfbf-efea-5039-88fb-6efc13a39947'::uuid AND (detail_content IS NULL OR detail_content = '');

-- Thiền Viện Duy Lực
UPDATE centers SET detail_content = $$Nằm trong lòng của đồi Phước Khả, tổ 8, ấp 4, xã An Hòa, TP. Biên Hòa, tỉnh Đồng Nai, Thiền Viện Duy Lực như một ngọn hải đăng tinh thần, rọi sáng con đường đi tìm sự giác ngộ cho những hành giả theo Tổ Sư Thiền. Thiền Viện này được lập nên từ năm 1997 bởi Thiền sư Thích Duy Lực. Đầu tiên, nó chỉ là một tịnh xá nhỏ bé, không một chút danh tiếng, nhưng lòng thành tâm và nhiệt huyết của những người tu tập đã tạo nên danh xưng Tịnh xá Ngã 3 Vũng Tàu.

Đến năm 2000, Thiền sư Thích Duy Lực sang Mỹ và viên tịch, chư Tôn Đức Tăng Ni thay phiên nhau coi sóc tịnh xá, trong đó có Hòa Thượng Thích Minh Hiền và sư cô Diệu Sang. Tuy nhiên, sau một thời gian tông phong giao lại cho chùa Tam Bảo quản lý, Hòa Thượng Thích Minh Thiền trụ trì chùa Tam Bảo cử sư cô Thích Nữ Pháp Ngân ra coi Thiền viện cho đến nay. Sự có mặt của sư cô Thích Nữ Pháp Ngân giúp cho tịnh xá phát triển mạnh mẽ. Sự hỗ trợ từ cộng đồng Phật tử đã giúp cho tịnh xá mở rộng và xây dựng thêm nhiều công trình kiến trúc ấn tượng, biến đổi từ một tịnh xá nhỏ bé thành Thiền Viện Duy Lực của ngày nay.

Thiền Viện Duy Lực hiện nay, tự hào với nhiều công trình kiến trúc mới, trong đó có chánh điện rộng lớn, dùng làm nơi tham thiền và thiền hành, nhà ăn tiện nghi có thể phục vụ cho khoảng 50 người, những khu ở cho tăng, ni, cư sĩ nam, cư sĩ nữ và Phật tử từ xa gần đến tham thiền. Phía sau viện là một ao sen tươi đẹp, nơi nuôi một đàn cá vàng. Cạnh ao là một ngôi nhà mái lá mát mẻ, với một chiếc thuyền nhỏ cho phép du khách thảnh thơi ngắm nhìn ao sen từ trên mặt nước. Bên cạnh đó, Thiền viện còn có vườn rau tự cung cấp cho đại chúng trong viện.

Kính thỉnh chư Tôn Đức Tăng Ni và kính mời các hành giả trong nước và ngoài nước về tham gia khóa tu An cư kiết hạ thực hành pháp môn tham Tổ Sư Thiền “Từ nghi đến ngộ” tại Thiền Viện Duy Lực

Thông tin liên hệ

Trụ Trì

Sư cô Thích Nữ Pháp Ngân

Số Điện Thoại : 0836357624

Thời Khóa Tu Mùa Đông

08/9 – 03/12 (AL) Quý Mão (2023)

Khuya: 4:00 – 6:00 AM

Sáng: 8:00 – 11:00 AM

Chiều: 14:00 – 17:00 PM

Tối: 18:30 – 20:30 PM

Thời Khóa Tu Thiền Thất

28 – 04 (AL) Hàng tháng

Khuya: 4:00 – 6:00 AM

Sáng: 8:00 – 11:00 AM

Chiều: 14:00 – 17:00 PM

Tối: 18:30 – 20:30 PM

Thời Khóa Tu Ngày Thường

Hàng ngày

Khuya: 4:00 – 6:00 AM

Sáng: 8:30 – 11:00 AM

Chiều: 14:30 – 17:00 PM

Tối: 18:30 – 20:30 PM

Địa Chỉ

281G, tổ 8, ấp 4, Phường An Hòa, Thành phố Biên Hòa, Tỉnh Đồng Nai

Giờ mở Của

Cả Ngày$$ WHERE id = '3fe10b9c-e3c8-5420-b7b4-878caceda636'::uuid AND (detail_content IS NULL OR detail_content = '');

-- Thiền Viện Linh Sơn
UPDATE centers SET detail_content = $$Thiền Viện Linh Sơn, ẩn mình giữa thôn 9, xã Lộc Thành, huyện Bảo Lâm, tỉnh Lâm Đồng

, tọa lạc trên ngọn đồi Lai Quả, mang tên của một vị thiền sư nổi tiếng. Chốn tòng lâm hẻo lánh xa xôi này khí hậu ôn hòa và thanh tịnh. Được bao bọc bởi rừng cây uốn lượn không tận, cảnh vật nơi đây như một bức tranh thơ mộng, rất thân thiện và dễ gần. Mặc dù Thiền Viện vẫn còn đang trong giai đoạn xây dựng và hoàn thiện, nhưng qua góc nhìn của nhiều Tăng Ni và hành giả, dễ nhận ra nơi đây sẽ trở thành một trong những thiền viện lớn và uy tín tại địa bàn huyện Bảo Lâm.

Hiện tại, Thiền Viện Linh Sơn đang tổ chức khóa tu mùa an cư kiết hạ kéo dài 3 tháng. Chúng tôi trân trọng kính mời quý vị tham dự, không chỉ trực tiếp tại thiền viện mà còn có thể kết nối từ xa qua ứng dụng Zoom với ID: 2558212697 và mật khẩu: haythamdi hoặc bấm vào đường link này

https://us02web.zoom.us/j/2258212697?pwd=ckp4bVZNbHhnaWFLb0R1cFNhVEk1UT09

.

Hòa Thượng trụ trì nơi đây đã kiến lập nên ngôi tam bảo nhằm mục đích tạo điều kiện cho chư Tăng Ni, hành giả và phật tử chuyên tâm tu tập pháp môn Tham Tổ Sư Thiền.

“Ai ơi đến chốn xa này

Hãy chuyên tu pháp môn Tổ Sư Thiền!”

.

Kính thỉnh chư Tôn Đức Tăng Ni, kính mời các hành giả và phật tử trong và ngoài nước về tham gia khóa tu thường ngày và khóa tu thiền thất thực hành pháp môn tham Tổ Sư Thiền “Từ nghi đến ngộ” tại chùa Thiền viện Linh Sơn.

Thông Tin Liên Hệ

Trụ Trì

Hòa Thượng Thích Minh Hiền

Số Điện Thoại : 0908557867

Thời Khóa Tu Kiết Hạ

05/04 – 08/07 (AL) Giáp Thìn(2024)

Khuya: 4:00 – 5:45 AM

Sáng: 7:30 – 10:45 AM

Chiều: 13:30 – 16:45 PM

Tối: 19:30 – 20:45 PM

Thời Khóa Tu Kiết Đông

01/09 – 25/11 (AL) Giáp Thìn(2024)

Khuya: 4:00 – 5:45 AM

Sáng: 7:30 – 10:45 AM

Chiều: 13:30 – 16:45 PM

Tối: 19:30 – 20:45 PM

Địa Chỉ

Thôn 9, xã Lộc Thành, huyện Bảo Lâm, tỉnh Lâm Đồng

Giờ mở Của

Môi ngày : 8am – 6pm$$ WHERE id = 'eb31722a-814a-5297-ac2c-9fcb85669e82'::uuid AND (detail_content IS NULL OR detail_content = '');

-- Chùa Phật Đà
UPDATE centers SET detail_content = $$Chùa Phật Đà, một biểu tượng tâm linh ấn tượng của Quận 3, Thành phố Hồ Chí Minh, trang nghiêm tọa lạc tại số nhà 362/46, khu Vườn Chuối, đường Nguyễn Đình Chiểu, phường 4,quận 3. Thuộc hệ phái Bắc tông, ngôi chùa này từng được gọi là Chùa Phật Địa.

Ngôi chùa này ra đời vào năm 1962, nhờ vào sự cống hiến và quyên góp của cụ Lê Đình Nguyên. Trong năm 1963, Thượng toạ Thích Thông Liễu đã được vinh dự làm Trụ trì đầu tiên tại chùa Phật Đà. Đến năm 1970, chùa Phật Đà được cụ Trần Văn Thoại hiến cúng và trùng tu lần thứ hai, sử dụng các loại vật liệu nhẹ.

Vào năm 1980, Hòa thượng Thích Minh Hiền trở thành Trụ trì và đã cống hiến cho chùa suốt 38 năm. Dưới sự dẫn dắt của Hòa Thượng, ngôi chùa cấp 4 đã trở thành một ngôi chùa có tầm cỡ trong Quận 3. Tuy nhiên, vào đầu năm 2019, do tuổi cao sức yếu, Hòa thượng Thích Minh Hiền đã đề nghị Thượng tọa Thích Thiện Chơn tiếp quản và trở thành Trụ trì mới của chùa Phật Đà.

Ngôi chùa hôm nay, với kiến trúc hiện đại và hoành tráng, là kết quả của sự trùng tu năm 1998. Chùa Phật Đà nằm trong một khuôn viên rộng 250m2, bao gồm chính điện, thiền đường và 4 phòng cho chư tăng.

Chùa không chỉ là nơi tu học cho các chư tăng mà còn là nơi thực hành Phật pháp cho cộng đồng. Mỗi tháng, từ ngày 21 đến 27 âm lịch, chùa tổ chức khóa tu thiền thất còn tổ chức khóa tu An Cư Kiết Hạ từ ngày 16/4 – 16 /7 hằng năm. Vào tối mùng 1 âm lịch, thầy Trụ trì giảng giải đạo lý cho các chư tăng và tín đồ Phật tử gần xa.

Không chỉ là trung tâm văn hóa Phật giáo, Chùa Phật Đà còn là nơi tổ chức các hoạt động xã hội. Ngôi chùa đã được người dân trong vùng biết đến như là “địa chỉ đỏ” trong các công tác từ thiện của chính quyền địa phương. Mỗi năm, vào các dịp lễ Phật đản, Vu Lan, tưởng niệm Thiền sư Thích Duy Lực vào ngày 1/12 âm lịch hằng năm chùa thường tổ chức phát chẩn cho những người nghèo trong vùng và cung cấp sự cứu trợ cho những người không có nơi nương tựa.

Lễ tưởng niệm Hòa Thượng Thiền Sư Thích Duy Lực

Bên cạnh những hoạt động nêu trên, Chùa Phật Đà còn tổ chức các lớp học, trong đó có Lớp Thiền Căn Bản. Lớp học diễn ra từ

14h00 đến 16h00 mỗi ngày chủ nhật. Tuy nhiên, do tình hình dịch bệnh, Lớp Thiền Căn Bản và lớp Chuyên đề Thiền Căn Bản đã chuyển sang học trực tuyến mỗi tối thứ hai và thứ bảy từ 19h00-20h00 trên Zoom

(ID: 8196000378, pass: phatphap)

và Đạo tràng Bát Quan Trai .v.v.

Chùa Phật Đà không chỉ là một ngôi chùa tâm linh, mà còn là nơi giáo dục, tạo nền tảng vững chắc cho sự phát triển của Phật giáo và cộng đồng xung quanh.

Thông Tin Liên Hệ

Trụ Trì

Thượng tọa Thích Thiện Chơn

Số điện thoại :

0918251975

Thời Khóa Tu Mùa Hạ

16/4 – 16/7 (AL) Quý Mão

Khuya: 4:00 – 6:00 AM

Sáng: 8:00 – 11:00 AM

Chiều: 14:00 – 17:00 PM

Tối: 18:30 – 20:30 PM

Thời Khóa Tu Thiền Thất

21 – 27 (AL) Hàng tháng

Khuya: 4:00 – 6:00 AM

Sáng: 8:00 – 11:00 AM

Chiều: 13:00 – 17:00 PM

Tối: 18:30 – 20:30 PM

Thời Khóa Tu Ngày Thường

Khuya: 4:00 – 5:00 AM

Tối: 18:00 – 19:00 PM

Địa Chỉ

362/46 Nguyễn Đình Chiểu, Phường 4, Quận 3, Thành phố Hồ Chí Minh

Giờ mở Của

6:00 AM – 20:00 PM hằng ngày$$ WHERE id = 'b1e03556-1500-5ba4-91ad-d79703d19d1f'::uuid AND (detail_content IS NULL OR detail_content = '');
UPDATE centers SET main_image_url = $$https://tosuthien.com/wp-content/uploads/2022/12/anh-10.jpeg$$ WHERE id = 'b1e03556-1500-5ba4-91ad-d79703d19d1f'::uuid AND (main_image_url IS NULL OR main_image_url = '');

-- Tu Viện Thanh Long
UPDATE centers SET detail_content = $$Thông Tin Liên Hệ

Hòa Thượng Thích Minh Hòa

Số Điện Thoại : 0984314739

Thời Khóa Tu Ngày Thường

Khuya: 4:00 – 6:00 AM

Sáng: 8:30 – 11:00 AM

Chiều: 14:30 – 17:00 PM

Tối: 18:30 – 20:30 PM

Thời Khóa Tu Mùa Hạ

10/4 – 5/7 (AL) Quý Mão (2023)

Khuya: 4:00 – 6:00 AM

Sáng: 8:00 – 11:00 AM

Chiều: 14:00 – 17:00 PM

Tối: 18:30 – 20:30 PM

Thời Khóa Tu Mùa Hạ

10/4 – 5/7 (AL) Quý Mão (2023)

Khuya: 4:00 – 6:00 AM

Sáng: 8:00 – 11:00 AM

Chiều: 14:00 – 17:00 PM

Tối: 18:30 – 20:30 PM

Địa Chỉ

K.P. Tân Phú, P.Mỹ Phú, TX Phú Mỹ, BRVT

Giờ mở Của

Cả Ngày$$ WHERE id = '7ade263e-30cf-579c-9ebc-ac2089fae40e'::uuid AND (detail_content IS NULL OR detail_content = '');

-- Chùa Phước Lộc
UPDATE centers SET detail_content = $$Chùa Phước Lộc nằm tại một Thị Trấn nhỏ thuộc tỉnh Tây Ninh cách TP. Hồ Chí Minh 120km về hướng Cửa Khẩu Quốc Tế Xa-Mát

1. Lịch Sử và quản lý

Chùa được khai sơn từ những năm 1990 bởi HT. Thích Diệu Giác. Đến năm 2016 được chính thức thành lập và bắt đầu xây dựng cho đến nay do Đại Đức Thích Nhuận Bình quản lý.

2. Pháp Môn và hoạt động

Hiện tại chùa có các khoá tu ngắn ngày theo Pháp Môn Tổ Sư Thiền do ĐĐ. Thích Nhuận Bình dẫn chúng. Do còn trong quá trình xây dựng nên chùa chưa thuận tiện tổ chức các khoá tu nhiều ngày. Về sau đầy đủ cơ duyên Chùa Phước Lộc sẽ tổ chức thiền thất cố định mõi tháng.

Kính thỉnh chư Tôn Đức Tăng Ni và kính mời quý hành giả hữu duyên về thăm và tham gia các các buổi toạ hương và kinh hành theo Tông Phong Tổ Sư Thiền.

Thông tin liên hệ

Trụ Trì

Đại đức Thích Nhuận Bình

Số Điện Thoại : 0935420304

Địa Chỉ

126 Tôn Thất Tùng, Thị trấn Tân Biên, Tân Biên, Tây Ninh

Giờ mở Của

Cả Ngày$$ WHERE id = '108fa3cc-855b-5cf6-9ffd-5d8ee26b4d50'::uuid AND (detail_content IS NULL OR detail_content = '');
UPDATE centers SET main_image_url = $$https://tosuthien.com/wp-content/uploads/2023/07/chuaphuocloc.jpg$$ WHERE id = '108fa3cc-855b-5cf6-9ffd-5d8ee26b4d50'::uuid AND (main_image_url IS NULL OR main_image_url = '');

-- Thiền Tự Quy Sơn
UPDATE centers SET detail_content = $$Thông tin liên hệ

Trụ Trì

Hòa thượng Thích Nhựt Tây

Số điện thoại : 0984315181

Thời Khóa Thiền thất

15 – 22 (AL) Hằng tháng

Khuya: 4:00 – 6:00 AM

Sáng: 8:00 – 11:00 AM

Trưa:11:30 – 12:00

Chiều: 13:00 – 17:00 PM

Tối: 18:00 – 21:00 PM

Thời Khóa hằng ngày

Khuya: 4:00 – 6:00 AM

Sáng: 8:00 – 11:00 AM

Trưa:11:30 – 12:00

Chiều: 13:00 – 17:00 PM

Tối: 18:00 – 21:00 PM

Phòng tham dự các khóa tu

Cách 1: Bấm vào khung hình này thay cho đường link vào khóa tu

Cách 2: ID: 467 258 8583 – Mật mã: 123456

Địa Chỉ

Xã Tân Hòa, Thị xã Phú Mỹ,Tỉnh Bà Rịa Vũng Tàu

Giờ mở Của

Cả Ngày$$ WHERE id = '634ace86-5183-550b-a077-520a61f74182'::uuid AND (detail_content IS NULL OR detail_content = '');

-- Chùa Pháp Thành
UPDATE centers SET detail_content = $$Thông tin liên hệ

Trụ Trì

Sư cô Thích Nữ An Hữu

Số Điện Thoại : 0978725015

Thời Khóa Tu Thiền Thất

28 – 04 (AL) Hàng tháng

Khuya: 4:00 – 6:00 AM

Sáng: 8:00 – 11:00 AM

Chiều: 14:00 – 17:00 PM

Tối: 18:30 – 20:30 PM

Địa Chỉ

192/32/4 Đ. Phạm Văn Chí, Phường 4, Quận 6, Hồ Chí Minh

Giờ mở Của

Cả Ngày$$ WHERE id = 'efed47d0-c145-5e92-813c-12129e2258e5'::uuid AND (detail_content IS NULL OR detail_content = '');
UPDATE centers SET main_image_url = $$https://tosuthien.com/wp-content/uploads/2024/09/Thiet-ke-chua-co-ten-1400x788.png$$ WHERE id = 'efed47d0-c145-5e92-813c-12129e2258e5'::uuid AND (main_image_url IS NULL OR main_image_url = '');

-- Chùa Liên Hương
UPDATE centers SET detail_content = $$Ấp Tân hòa, xã An Hiệp, Châu Thành, Đồng Tháp

Thông Tin Liên Hệ

Trụ Trì

Hòa Thượng Thích Minh Hiền

Số Điện Thoại : 0908557867

Thời Khóa Tu mùa Hạ

10/4 – 5/7 (AL) Quý Mão(2023)

Khuya: 4:00 – 5:45 AM

Sáng: 7:30 – 10:45 AM

Chiều: 13:30 – 16:45 PM

Tối: 19:30 – 20:45 PM

Địa Chỉ

Thôn 9, xã Lộc Thành, huyện Bảo Lâm, tỉnh Lâm Đồng

Giờ mở Của

Môi ngày : 8am – 6pm$$ WHERE id = 'c8e85203-3b90-51c1-8432-716d21b454c2'::uuid AND (detail_content IS NULL OR detail_content = '');
UPDATE centers SET main_image_url = $$https://tosuthien.com/wp-content/uploads/2023/05/z4391886910767_a990d406fe40955293d849090db4f70b.jpg$$ WHERE id = 'c8e85203-3b90-51c1-8432-716d21b454c2'::uuid AND (main_image_url IS NULL OR main_image_url = '');

-- Chùa Phước Điền
UPDATE centers SET detail_content = $$646A, đường Vòng Núi Sam, P.Núi Sam, An Giang$$ WHERE id = '0e9c7b88-c8de-5400-bc76-34e935bfbfd1'::uuid AND (detail_content IS NULL OR detail_content = '');
UPDATE centers SET main_image_url = $$https://tosuthien.com/wp-content/uploads/2023/05/Richard-1.png$$ WHERE id = '0e9c7b88-c8de-5400-bc76-34e935bfbfd1'::uuid AND (main_image_url IS NULL OR main_image_url = '');

-- Chùa Phật Quang
UPDATE centers SET detail_content = $$Ấp Tân An, xã Tân Bình, Châu Thành, Đồng Tháp$$ WHERE id = 'ec85b7e0-cd5a-5290-ba40-76f55640a43b'::uuid AND (detail_content IS NULL OR detail_content = '');
UPDATE centers SET main_image_url = $$https://tosuthien.com/wp-content/uploads/2021/11/Luoc-giang-kinh-Lang-Nghiem-2.png$$ WHERE id = 'ec85b7e0-cd5a-5290-ba40-76f55640a43b'::uuid AND (main_image_url IS NULL OR main_image_url = '');

-- Chùa Tam Bảo
UPDATE centers SET detail_content = $$Chùa Tam Bảo, nằm yên bình giữa vùng đất phù sa của Đồng bằng Sông Cửu Long, tại xã Tân Nhuận Đông, huyện Châu Thành, tỉnh Đồng Tháp, chỉ cách cầu Mỹ Thuận 7 km, đã trở thành điểm đến quan trọng cho Chư Tăng Ni và hành giả, phật tử từ khắp nơi trên thế giới đến hành hương và tu tập.

1. Lịch sử và quản lý:

Ngôi chùa được thành lập bởi hoà thượng Thích Huệ Phương vào năm 1975. Sau đó, Cố Thượng tọa Thích Phước Chí tiếp quản trụ trì. Hiện nay, Thượng tọa Thích Minh Thiền đang đảm nhận vị trí này. Chùa Tam Bảo đã trải qua nhiều thăng trầm để trở thành một trung tâm thiền quan trọng, nơi tu tập pháp môn thiền Tham thoại đầu – một hình thức thiền độc đáo do cố hoà thượng Thích Duy Lực truyền dạy. Chùa cũng là một trong 5 điểm An cư kiết hạ của tỉnh Đồng Tháp. Đặc biệt chùa Tam Bảo là ngôi chùa Thiền tông chuyên tu thiền Tham thoại đầu ở vùng Đồng bằng Sông Cửu Long.

2. Pháp môn và hoạt động

Nơi đây tập trung tu tập pháp môn tham Tổ Sư Thiền “Từ nghi đến ngộ”. Mỗi tháng, có tổ chức khóa tu Thiền thất từ ngày 14 – 20 âm lich dành cho Chư Tăng Ni, hành giả và phật tử.

3. Khóa tu An Cư Kiết Hạ

Mỗi năm, từ Rằm tháng Tư đến tháng Bảy, Chư Tăng Ni trong nước và ngoài nước hành hương đến chùa Tam Bảo để tham gia khóa An Cư Kiết Hạ. Bên cạnh đó, chùa cũng thường xuyên tổ chức các khóa thiền thất hằng tháng từ ngày 14 – 20 âm lịch cho Chư Tăng Ni và hành giả Tham Tổ Sư Thiền.

4. Phục hồi và truyền bá pháp môn:

Dù pháp môn thiền Tham công án hay Tham thoại đầu đã kém phổ biến sau khi tổ Liễu Quán viên tịch vào năm 1742, nhưng hiện nay, pháp môn này đang được khôi phục và giảng dạy tại nhiều ngôi chùa trong nước và ngoài nước. Ngoài chùa Tam Bảo ở Đồng Tháp, chùa Phật Đà, Pháp Thành I ở Sài Gòn, Thiền đường Pháp Thành II và Liễu Quán I ở Bà Rịa – Vũng Tàu, Thiền viện Duy Lực ở Đồng Nai, Thiền viện Linh Sơn ở Lâm Đồng, Thiền đường Từ Ân và chùa Duy Pháp ở Hoa Kỳ .v.v. Đều có đông đảo Chư Tăng Ni và hành giả phật tử tham gia học và thực hành pháp Tham Thoại Đầu.

Chư Tôn Đức Tăng Ni và hành giả từ khắp nơi đến chùa Tam Bảo, để tu tập pháp môn Tổ Sư Thiền từ “nghi” đến “ngộ”. Hỏi câu thoại và giữ nghi tình miên mật 24/24 là bước đi quan trọng trên con đường tìm kiếm sự giải thoát tự do tự tại khỏi mọi khổ đau.

Kính thỉnh chư Tôn Đức Tăng Ni và kính mời các hành giả trong nước và ngoài nước về tham gia khóa tu thường ngày và khóa tu thiền thất thực hành pháp môn tham Tổ Sư Thiền “Từ nghi đến ngộ” tại chùa Tam Bảo.

Thông Tin Liên Hệ

Trụ Trì

Thượng tọa Thích Minh Thiền

Số điện thoại :

0908535369

Thời Khóa Tu Mùa Đông

13/9 – 13/11 (AL) Quý Mão

Khuya: 4:00 – 6:00 AM

Sáng: 8:00 – 11:00 AM

Chiều: 14:00 – 17:00 PM

Tối: 18:30 – 20:30 PM

Thời Khóa Tu Thiền Thất

14 – 20 (AL) Hàng tháng

Khuya: 4:00 – 6:00 AM

Sáng: 8:00 – 11:00 AM

Chiều: 13:00 – 17:00 PM

Tối: 18:30 – 20:30 PM

Thời Khóa Tu Ngày Thường

Khuya: 4:00 – 6:00 AM

Sáng: 8:30 – 11:00 AM

Chiều: 14:30 – 17:00 PM

Tối: 18:30 – 20:30 PM

Địa Chỉ

Tân Thuận, Tân Nhuận Đông, Châu Thành, Đồng Tháp

Giờ mở Của

Cả Ngày$$ WHERE id = '0c05bdea-86fa-558a-bd6e-b2b6dcea4bb8'::uuid AND (detail_content IS NULL OR detail_content = '');
UPDATE centers SET main_image_url = $$https://tosuthien.com/wp-content/uploads/2023/05/Richard.png$$ WHERE id = '0c05bdea-86fa-558a-bd6e-b2b6dcea4bb8'::uuid AND (main_image_url IS NULL OR main_image_url = '');

-- Thiền Đường Liễu Quán 1
UPDATE centers SET detail_content = $$Nằm ẩn mình dưới những táng cây xanh mát bên chân núi Dinh là ngôi Thiền Đường Liễu Quán I. Ngôi Thiền Đường mọc lên như một nét chấm phá giữa một màu xanh rậm rạp phủ từ trên núi xuống và chạy dọc bao quanh chân núi như một bức tranh thủy mặc xa xưa. Từ Sài gòn đi quốc lộ 51 đến ngã ba Hội Bài, rẽ trái vào khoảng 4 km, cạnh cây xăng bên phải, có con đường nhựa nhỏ dẫn vào tới cuối đường, cổng tam quan lớn hiện ra sừng sững, trang nghiêm như đón chào những người con Phật ghé thăm.

Sở dĩ gọi là Thiền đường vì khi mới thành lập (khoảng 1985, 1986), được sự chỉ dạy của Thiền sư Duy Lực, các thầy chỉ gầy dựng một ngôi Thiền đường, vốn là một trang trại nho nhỏ bằng tranh, tre, nứa đủ để khoảng 20 người ở tu, dưới danh nghĩa là Tổ hợp trồng cây điều mang tên Đồng Tâm để xin khai khẩn đất hoang. Lúc bấy giờ hoàn cảnh cơ cực, thiếu thốn nên mọi người không nghĩ đến việc xây dựng quy mô một ngôi thiền viện. Đến ngày 18-8-1987 (24-7-Đinh Mão), sau khi được cấp phép xây dựng, Hòa thượng Thiện Đức mới tiến hành làm lễ Đặt đá và đặt tên là Thiềng Đường Liễu Quán I (vì cách đó khoảng 4 cây số có một ngôi Thiền đường trước đó được xây năm 1984. Sau này ngôi Thiền đường đó cũng mang tên Thiền đường Liễu Quán II dành cho chư ni). Liễu Quán là pháp hiệu của một Thiền sư kiến tánh (1670-1742) người Phú Yên, nối pháp Thiền sư Minh Hoằng – Tử Dung (người Hoa), Trụ trì chùa Ấn Tôn (chùa Từ Đàm, Huế ngày nay) thuộc nhánh Thiền Dương Kỳ Phương Hội (thuộc dòng Lâm Tế). Chọn tên cho Thiền đường là Liễu Quán nhằm nhắc lại công hạnh của một thiền sư Việt Nam cũng tu pháp tham thoại đầu mà được kiến tánh (Ngài tham câu “Muôn pháp về một, một về chỗ nào?” – Vạn pháp quy nhất, nhất quy hà xứ?).

Tổng diện tích Thiền Đường Liễu Quán 1 gần 13 héc-ta, cộng thêm hơn 4.500m2 đất trồng rừng, do chư tăng khai khẩn đất hoang. Mặc dù gọi là Thiền Đường, nhưng quy mô hiện nay không khác gì một ngôi thiền viện. (Thiền đường chỉ là một hạng mục trong tổng thể của một thiền viện dành cho thiền giả tọa thiền). Thiền Đường Liễu Quán 1 được chia thành hai khu, khu bên cạnh núi dành cho chư Tăng, khu phía ngoài dành cho chư ni. Hai khu cách nhau một con đường cắt ngang có rào chắn. Khu dành cho chư tăng được xây dựng các hạng mục gồm: Chính điện, Trai đường nối các phòng tăng. Bên phải từ ngoài nhìn vào là Thiền đường với sức chứa hơn 100 hành giả có thể tọa thiền hoặc thiền hành. Nơi đây thường được dùng làm chỗ tu tập của chư hành giả khi tổ chức các khóa tu như Thiền thất, khóa tu Mùa hạ, Mùa đông, thường có trên cả trăm hành giả. Điều khiến cho nhiều hành giả thích thú là khung cảnh mát mẽ, thanh u dễ chịu.

Khu vực bên ni cũng không kém phần yên tịnh và mát mẽ nhà những tàng cây rọp bóng. Bao quanh là vườn cây ăn trái như xoài, sa po, mít cùng nhiều loại cây khác bốn mùa cho hoa trái.

Vị Trụ trì đầu tiên nơi đây là Hòa thượng Thích Thiện Đức, người Sài Gòn nhưng đã rời gia đình đi tu từ 14 tuổi. Quá trình cầu đạo cho đến khi gặp Thiền sư Duy Lực, rồi dựng lập Thiền đường là cả một câu chuyện dài đầy gian truân trắc trở và thú vị. Ngày 09-4-2022 (09-3-Nhâm Dần), Hòa thượng thu thần thị tịch, người kế vị là Hòa thượng Thích Huệ Minh, Tổng thư ký Tông phong Tổ sư thiền.

Theo đường lối tu hành của Thiền sư Duy Lực, nơi đây chuyên dụng công Tham thoại đầu, là một trong những pháp tu của Tổ sư thiền. Thiền sư Duy Lực đã từng đặt chân đến đây để sách tấn, chỉ dạy pháp tu cũng như tổ chức đời sống thiền đường. Mỗi ngày chư tăng, ni và cư sĩ hành giả tuân thủ giờ giấc nghiêm mật như:

03:30 thức chúng

04:00 – 05:40 Chấp tác (làm vệ sinh chung quanh)

06:00 – 10: 50 Tọa thiền – thiền hành

11:00 Thọ trai (cơm trưa) – thiền trà

12:00 – 13:30 Chỉ tịnh – thức chúng

14:00 – 17:00 Tọa thiền – thiền hành

17:00 – 18:30 Công việc cá nhân

Chủ nhật: buổi sáng từ 07:00 – đến 09:00 lao động tập thể

Mỗi tháng có họp chúng 1 lần vào 15:00 ngày 29 âm lịch. (Hình thức như tiệc trà nhưng có chủ đề nhằm xây dựng đời sống cộng trú)

CÁC NGÀY LỄ HẰNG NĂM:

Lễ Húy nhựt Hòa thượng Thích Thiện Đức, Đệ nhất trụ trì: Mùng 8-9/3 âm lịch.

Lễ Phật đản (nội bộ): Rằm tháng Tư âm lịch.

Lễ Kỷ niệm chu niên ngày Thành lập Thiền Đường Liễu Quán I: 23-24/7 âm lịch.

Lễ Húy nhựt Hòa thượng Khai sơn (Thiền sư Thích Duy Lực).

Xuân Di Lặc: Mùng 1 tháng Giêng âm lịch: chư hành giả được nghỉ tu từ 08:00 đến 17:00 (buổi khuya và tối vẫn tu mỗi buổi 2 tiếng).

Số hành giả thường xuyên có thay đổi, khi thì khoảng 30 vị, khi thì chưa tới 20 vị (cả tăng, ni và cư sĩ). Hiện nay Thiền Đường Liễu Quán 1 vẫn thường xuyên duy trì các khóa tu cũng như thời khóa hằng ngày. Đây là một trong những trú xứ có không khí tu hành ổn định tại thị xã Phú Mỹ, tỉnh Bà Rịa – Vũng Tàu.

Thông Tin Liên Hệ

Trụ Trì

Hòa Thượng Thích Huệ Minh

Số Điện Thoại : 0377676990

Thời Khóa Tu Mùa Hạ

8/4 – 8/7 (AL) Quý Mão

Khuya: 4:00 – 6:00 AM

Sáng: 8:00 – 11:00 AM

Chiều: 14:00 – 17:00 PM

Tối: 18:30 – 20:30 PM

Thời Khóa Tu Ngày Thường

Khuya: 4:00 – 6:00 AM

Sáng: 8:30 – 11:00 AM

Chiều: 14:30 – 17:00 PM

Tối: 18:30 – 20:30 PM

Địa Chỉ

Thôn Phước Thành, xã Tân Hòa, thị xã Phú Mỹ, tỉnh Bà Rịa Vũng Tàu

Giờ mở Của

Cả Ngày$$ WHERE id = 'bac0c6f9-9c79-592e-bf08-064f6af2a377'::uuid AND (detail_content IS NULL OR detail_content = '');

-- Chùa Liên Hoa
UPDATE centers SET detail_content = $$236/31/4, Thái Phiên, P8, Q11, Tp.HCM

Thông Tin Liên Hệ

Trụ Trì

Hòa Thượng Thích Minh Hiền

Số Điện Thoại : 0908557867

Thời Khóa Tu mùa Hạ

10/4 – 5/7 (AL) Quý Mão(2023)

Khuya: 4:00 – 5:45 AM

Sáng: 7:30 – 10:45 AM

Chiều: 13:30 – 16:45 PM

Tối: 19:30 – 20:45 PM

Địa Chỉ

Thôn 9, xã Lộc Thành, huyện Bảo Lâm, tỉnh Lâm Đồng

Giờ mở Của

Môi ngày : 8am – 6pm$$ WHERE id = '4844d1f9-9834-5039-b28f-ff54d28589ca'::uuid AND (detail_content IS NULL OR detail_content = '');
UPDATE centers SET main_image_url = $$https://tosuthien.com/wp-content/uploads/2021/11/2017-11-17.jpg$$ WHERE id = '4844d1f9-9834-5039-b28f-ff54d28589ca'::uuid AND (main_image_url IS NULL OR main_image_url = '');

-- Chùa Liên Hoa
UPDATE centers SET detail_content = $$Chùa Liên Hoa tọa lạc số 58 (số cũ B8/255B), đường Ông Niệm, xã Phong Phú, Bình Chánh, TP.HCM, không chỉ là một ngôi chùa Phật giáo thông thường, mà còn là một trung tâm tâm linh đắc lực, với mục tiêu chính là bồi dưỡng và phát triển đời sống tâm linh cho cộng đồng Phật tử. Ngôi chùa nằm yên bình giữa cảnh quan thơ mộng của miền quê, trở thành biểu tượng văn hóa và trí tuệ của Đạo Phật.

1. Lịch sử và quản lý:

Chùa Liên Hoa được thành lập năm 1999 bởi sư cô Thích Nữ Truyền Lộc. Tiếp nối trách nhiệm Sư cô Thích Nữ Bửu Nhựt quản lý và trùng tu chùa từ năm 2010. Đến năm 2022, do tuổi cao sức yếu, Sư cô đã mời Đại đức Thích Pháp Hiện tiếp tục quản lý chùa.

2. Pháp môn và hoạt động:

Nơi đây tập trung tu tập pháp môn tham Tổ Sư Thiền “Từ nghi đến ngộ”. Mỗi tuần, có hoạt động dành riêng cho Phật tử vào thứ 7 và cho học sinh vào chủ nhật.

3. Vai trò trong cộng đồng Phật tử:

Chùa Liên Hoa là trung tâm tâm linh quan trọng, nơi thờ phụng Tam Bảo, giữ gìn giá trị văn hóa và tri thức Phật giáo. Thư viện của chùa lưu giữ nhiều bộ kinh sách quý, tài liệu lịch sử.

4. Du lịch văn hóa:

Chùa Liên Hoa cũng là điểm du lịch văn hóa phong cảnh miền quê thơ mộng nơi Phật tử thập phương có thể trải nghiệm sự yên bình, hiểu biết sâu hơn về Đạo Phật và văn hóa Phật giáo. Chùa còn tổ chức phát cơm chay 2 lần trong tháng gồm 1200 phần cho người nghèo và bệnh nhân trong bênh viện. Chùa gần bờ kênh và có xuồng thích hợp cho Phật tử phóng sanh.

Kính thỉnh chư Tôn Đức Tăng Ni và kính mời các hành giả trong nước và ngoài nước về tham gia khóa tu hàng tuần, thực hành pháp môn tham Tổ Sư Thiền “Từ nghi đến ngộ” tại chùa Liên Hoa.

Thông tin liên hệ

Trụ Trì

Sư Cô Thích Nữ Bửu Nhựt

Số Điện Thoại : 0907274882

Thời Khóa Tu Hàng Tuần

Thứ 7 và Chủ nhật

Khuya: 4:00 – 5:300 AM

Sáng: 8:00 – 10:45 AM

Chiều: 13:30 – 16:45 PM

Tối: 18:30 – 20:30 PM

Địa Chỉ

58 (số cũ B8/255)B, đường Ông Niệm/Tổ 8 Ấp 2, Phong Phú, Bình Chánh, Thành phố Hồ Chí Minh

Giờ mở Của

Môi ngày : 6:00 AM – 20:00 PM$$ WHERE id = '0a641660-5645-51dd-9260-b2c08c4f27bb'::uuid AND (detail_content IS NULL OR detail_content = '');

-- Chùa Sơn Hải
UPDATE centers SET detail_content = $$Chùa Sơn Hải

, thường được người dân địa phương biết đến với tên gọi chùa Ninh Đảo, là một ngôi chùa mang ý nghĩa tinh thần sâu sắc, nằm cheo leo trên hải đảo

thôn Ninh Đảo, xã Vạn Thanh, huyện Vạn Ninh, tỉnh Khánh Hòa

. Với sự lịch sử phong phú và vị trí độc đáo, Chùa Sơn Hải không chỉ là một nơi thực hành Phật giáo, mà còn là biểu tượng của lòng kiên trì và niềm tin.

Là một trong những địa điểm thiền môn tổ sư thiền, Chùa Sơn Hải nằm cách thành phố Nha Trang hơn 60 km về phía Bắc. Quãng đường tới chùa đầy thách thức nhưng cũng đầy thú vị, vượt qua các thị trấn như Ninh Hòa, Van Ninh và Vạn Giã, rồi đi qua dòng sông rộng lớn bằng phà, hành trình kéo dài hơn hai giờ trong cảnh quan mênh mông của biển cả và núi non hùng vĩ.

Được khởi xây dựng từ năm 1972 bởi Thượng tọa Thích Toàn Thiện, Chùa Sơn Hải đã trở thành một phần không thể thiếu của cộng đồng ngư dân địa phương, nơi họ tìm đến để tìm kiếm sự an ủi, bình yên trước những chuyến ra khơi đầy nguy hiểm. Ngôi chùa đã trải qua hai lần trùng tu trong suốt nửa thế kỷ tồn tại, mỗi lần đều chứng tỏ sự kiên trì và lòng tin của cộng đồng Phật giáo.

Ngôi chùa đã gặp nhiều khó khăn, đặc biệt là về tài chính, và vì vậy, việc tìm được một người trụ trì lâu dài cho chùa đã trở nên khó khăn. Tuy nhiên, vào năm 2010, một bước ngoặt quan trọng đã xảy ra khi Đại đức Thích Tịnh Trí đã nhận lời trụ trì tại Chùa Sơn Hải. Điều này đã đem lại niềm vui vô bờ bến cho cộng đồng Phật giáo địa phương và mở ra một chương mới trong lịch sử của Chùa Sơn Hải.

Hôm nay, Chùa Sơn Hải vẫn tiếp tục là một ngọn đèn soi sáng cho những người theo đuổi con đường Phật giáo, một biểu tượng của lòng kiên trì và niềm tin. Trong không khí trang nghiêm và tĩnh lặng của chùa, mọi người không chỉ tìm thấy sự bình yên, mà còn được nhắc nhở về giá trị của sự kiên nhẫn, lòng biết ơn và tinh thần không ngừng nỗ lực.

Thông Tin Liên Hệ

Trụ Trì

Thương tọa Thích Tịnh Trí

Số Điện Thoại: 0365 488 810

Thời Khóa Tu

Ngày 2/2 – 9/2 ; 2/8 – 8/8 (AL)

Khuya: 4:00 – 6:00 AM

Sáng: 8:00 – 11:00 AM

Chiều: 14:00 – 17:00 PM

Tối: 19:30 – 21:00 PM

Địa Chỉ

thôn Ninh Đảo, xã Vạn Thanh, huyện Vạn Ninh, tỉnh Khánh Hòa

Giờ mở Cửa

Hàng ngày : 8:00 AM – 18:00 PM

>$$ WHERE id = '839f93fd-4b50-54b0-8cef-0e58cbe0ad25'::uuid AND (detail_content IS NULL OR detail_content = '');

-- Chùa Quan Nhân
UPDATE centers SET detail_content = $$Chùa Quan Nhân

, một di tích kiến trúc Phật giáo quan trọng, tọa lạc tại phường Nhân Chính, quận Thanh Xuân, Hà Nội. Chùa không chỉ là nơi thờ Phật, mà còn giữ vẹn nhiều giá trị tinh thần, văn hóa và lịch sử của người Việt.

Chùa Quan Nhân nằm trong làng cổ Quan Nhân, một phần của vùng Kẻ Mọc xưa, nằm cùng với các làng Giáp Nhất, Cự Lộc, Chính Kinh. Kể từ cuối năm 1996, làng và chùa Quan Nhân thuộc phường Nhân Chính, quận Thanh Xuân, thành phố Hà Nội.

Mục đích chính của chùa là thờ Phật, giúp con người giải thoát khỏi bể khổ trầm luân và mang lại sự an lạc về tinh thần. Đồng thời, chùa Quan Nhân cũng thờ Mẫu theo tín ngưỡng bản địa của người Việt, bao gồm thờ Tổ, thờ Mẫu, thờ Đức Thánh Trần và tục thờ Hậu.

Trong suốt lịch sử, chùa đã chứng kiến nhiều sự kiện lịch sử quan trọng, đặc biệt trong thời kỳ cách mạng – kháng chiến. Trước và sau năm 1945, chùa đã trở thành nơi ẩn náu bí mật của các cán bộ Việt Minh. Một trong những đóng góp nổi bật của chùa trong giai đoạn này là sự hy sinh của Thầy Thích Đàm Tỵ, người đã hy sinh trong khi thực hiện nhiệm vụ ngày 24-2-1949 tại chùa và đã được Nhà nước truy tặng Bằng “Tổ Quốc ghi công”.

Chưa có cứ liệu chính xác để xác định niên đại hình thành chùa Quan Nhân, nhưng dựa vào truyền thuyết lưu truyền và nội dung tấm bia có niên đại Chính Hoà 22 (1701), chúng ta có thể đoán rằng chùa có từ thế kỷ XVII. Kiến trúc chùa hiện còn có nhiều dấu ấn của thế kỷ XIX.

Năm 2002, chùa Quan Nhân được Ủy ban nhân dân thành phố Hà Nội công nhận là Di tích lịch sử kiến trúc nghệ thuật. Năm 2005, chùa lại được gắn biển Di tích cách mạng – kháng chiến. Chào mừng Đại lễ kỷ niệm 1000 năm Thăng Long – Hà Nội, chùa tiếp tục được quan tâm và đầu tư để tôn tạo các công trình kiến trúc.Dưới sự tiếp nối của Ni sư Trụ trì Thích Nữ Đàm Chí chùa Quan Nhân được phát triến cho đến nay.

Chùa Quan Nhân tu pháp môn Tổ Sư Thiền, mang đến cho người tu hành một con đường từ “Nghi” đến “Ngộ” bằng cách hỏi câu thoại và nhìn thoại đầu đi, đứng, nằm, ngồi đều hỏi và nhìn miên mật 24/24 thì hành giả sắp kiến tánh được giải thoát tất cả khổ đó là mục đích của pháp môn tham Tổ Sư Thiền.

Kính thỉnh chư Tôn Đức Tăng Ni và kính mời các hành giả trong nước và ngoài nước về tham gia khóa tu thường ngày và khóa tu thiền thất thực hành pháp môn tham Tổ Sư Thiền “Từ nghi đến ngộ” tại chùa Quan Nhân.

Thông tin liên hệ

Trụ Trì

Sư cô Thích Nữ Đàm Trí

Số Điện Thoại : 0386466874

Thời Khóa Tu Thiền Thất

3 – 9 (AL) Hàng tháng

Khuya: 4:00 – 6:00 AM

Sáng: 8:00 – 11:00 AM

Chiều: 13:00 – 16:00 PM

Tối: 18:00 – 20:00 PM

Địa Chỉ

ngõ 144 Quan Nhân,Nhân Chính, Thanh Xuân , Hà Nội

Giờ mở Của

Hàng ngày : 4:00 AM – 20:00 PM$$ WHERE id = '27413d0b-3a57-55be-8f3b-ce3a41084897'::uuid AND (detail_content IS NULL OR detail_content = '');

-- Chùa Thượng
UPDATE centers SET detail_content = $$Chùa Thượng nằm trong khu dân cư Bến Vượng, phường Thắng Lợi, trên bờ sông tĩnh lặng của thành phố Sông Công, tỉnh Thái Nguyên, Chùa Thượng trải dài với vẻ đẹp cổ kính và linh thiêng.

Được khởi sự và xây dựng vào những năm 1930, chùa ban đầu chỉ là một ngôi miếu nhỏ bé rộng 70 mét vuông, hướng mặt ra mảnh đồng lúa xanh mát của làng. Đây là điểm tâm linh mà đa số cư dân trong vùng tìm đến để cầu nguyện, và nơi diễn ra các lễ hội hàng năm như lễ hội đầu Xuân, lễ hội cầu mùa, lễ cơm mới, cầu khấn cho Quốc thái, dân an, mưa thuận, gió hoà. Dù đã phải trải qua biến động của thời gian và lịch sử, khiến chùa bị hư hại, nhưng tinh thần của nó vẫn còn đó.

Đến năm 2017, sau những biến cố và thăng trầm của lịch sử, chùa không còn phù hợp với nhu cầu sinh hoạt của tăng ni và phật tử. Để đáp ứng tình hình này, ngày 29/11/2017, UBND tỉnh Thái Nguyên đã cấp giấy phép xây dựng cho Chùa Thượng để xây dựng Đại Hùng Bảo Điện rộng 1.507 mét vuông (2 sàn) với độ cao 19,4m. Hiện nay, chùa đang tiếp tục công trình xây dựng khu Đại Hùng Bảo Điện.

Năm 2019, chùa Thượng đã tổ chức một lễ đúc chuông đồng chung, thu hút sự chứng kiến của nhiều thiền đức, tăng ni, phật tử và cư dân địa phương. Trụ trì chùa Thượng đã phác thảo lịch sử hình thành và phát triển của chùa, và giải thích ý nghĩa của việc đúc chuông. Theo ông, mỗi lần tiếng chuông vang lên, nó mang theo những ước nguyện cao quý của những người đã đóng chuông và tiếng chuông lan tỏa trong không gian. Tiếng chuông thấm sâu vào lòng người, vào tâm thức của chúng sinh và thay đổi tiềm thức bí mật của họ.

Việc phục hồi lại Chùa Thượng đã giáo dục các thế hệ trẻ về tình yêu quê hương và lòng biết ơn. Qua đạo lý “Uống nước nhớ nguồn, ăn quả nhớ kẻ trồng cây”, việc tái thiết chùa cũng góp phần vào sự phát triển của quê hương ngày càng văn minh và tươi đẹp.

Thông tin liên hệ

Upload Image...

Trụ Trì

Đại Đức Thích Thanh An

Số Điện Thoại : 0967746777

Upload Image...

Upload Image...

Địa Chỉ

ngõ 144 Quan Nhân,Nhân Chính, Thanh Xuân , Hà Nội

Giờ mở Của

Hàng ngày : 6:00 AM – 20:00 PM$$ WHERE id = 'a6ffb7eb-6bdb-599b-b5f4-708c83d22df4'::uuid AND (detail_content IS NULL OR detail_content = '');
UPDATE centers SET main_image_url = $$https://tosuthien.com/wp-content/uploads/2023/07/z4474760869795_e6d4888ac158be3b75beccb989c2f8fe.jpg$$ WHERE id = 'a6ffb7eb-6bdb-599b-b5f4-708c83d22df4'::uuid AND (main_image_url IS NULL OR main_image_url = '');

-- Fix: Chùa Phật Đà dùng địa chỉ văn phòng liên lạc theo bản gốc WP
UPDATE centers
SET address = '362/46 Nguyễn Đình Chiểu, phường Bàn Cờ, TP.HCM'
WHERE slug = 'chua-phat-da-thich-thien-chon-15';
