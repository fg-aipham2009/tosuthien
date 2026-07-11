-- Normalized seed: danh sách trụ trì (chạy trực tiếp trên DB)
-- Xóa centers/courses rồi import lại. Cần đã có cột region/type/... (009a)
BEGIN;


-- 1. Thiền Viện Linh Sơn | HT Thích Minh Hiển
INSERT INTO centers (id, slug, temple_name, abbot_name, abbot_rank, abbot_title, org_role, gender_section, region, country_code, province, address, phone, abbot_phone, sort_order, is_published, gallery_images) VALUES ('eb31722a-814a-5297-ac2c-9fcb85669e82', 'thien-vien-linh-son-thich-minh-hien-1', 'Thiền Viện Linh Sơn', 'Thích Minh Hiển', 'HT', 'Trụ trì', 'Chứng minh', 'TANG', 'TRUNG', 'VN', 'Lâm Đồng', 'Xã Bảo Lâm 3, tỉnh Lâm Đồng', '0908557867', '0908557867', 1, true, '[]'::jsonb);
INSERT INTO courses (id, title, type, recurrence, day_start, day_end, weekday, schedule_text, center_id, sort_order) VALUES ('c5c77cad-4346-5574-835e-1a635ef4fa59', 'Khóa tu thiền thất', 'REGULAR', 'SELF_PRACTICE', NULL, NULL, NULL, 'Tự tu', 'eb31722a-814a-5297-ac2c-9fcb85669e82', 1);
INSERT INTO courses (id, title, type, recurrence, day_start, day_end, weekday, schedule_text, center_id, sort_order) VALUES ('97970b4b-1a6e-5dd9-b5ab-a19cabbdf7af', 'Khóa tu mùa đông', 'WINTER', 'YEARLY', NULL, NULL, NULL, 'Khóa tu mùa đông', 'eb31722a-814a-5297-ac2c-9fcb85669e82', 2);
INSERT INTO courses (id, title, type, recurrence, start_date, end_date, schedule_text, center_id, sort_order) VALUES ('96f7eeb5-df83-5a43-9781-797524d98a48', 'An cư', 'AN_CU', 'YEARLY', '2026-04-08'::date, '2026-07-04'::date, '8/4-4/7', 'eb31722a-814a-5297-ac2c-9fcb85669e82', 3);

-- 2. Tịnh Xá Ngọc Hòa | HT Thích Giác Điệp
INSERT INTO centers (id, slug, temple_name, abbot_name, abbot_rank, abbot_title, org_role, gender_section, region, country_code, province, address, phone, abbot_phone, sort_order, is_published, gallery_images) VALUES ('240c071f-0c61-50b2-bcbb-5f9addfa1712', 'tinh-xa-ngoc-hoa-thich-giac-diep-2', 'Tịnh Xá Ngọc Hòa', 'Thích Giác Điệp', 'HT', 'Trụ trì', 'Chứng minh', 'TANG', 'NAM', 'VN', 'Cần Thơ', 'Khu vực Thới Hưng, phường Thới Long, TP. Cần Thơ', '0907883578', '0907883578', 2, true, '[]'::jsonb);
INSERT INTO courses (id, title, type, recurrence, day_start, day_end, weekday, schedule_text, center_id, sort_order) VALUES ('5aa6b40e-bc90-58d5-95ba-402bc1492177', 'Khóa tu thiền thất', 'REGULAR', 'MONTHLY_RANGE', 10, 16, NULL, '10-16', '240c071f-0c61-50b2-bcbb-5f9addfa1712', 1);
INSERT INTO courses (id, title, type, recurrence, start_date, end_date, schedule_text, center_id, sort_order) VALUES ('78cca970-d92c-5104-95f9-dd47ff9399d9', 'An cư', 'AN_CU', 'YEARLY', '2026-04-11'::date, '2026-07-11'::date, '11/4-11/7', '240c071f-0c61-50b2-bcbb-5f9addfa1712', 2);

-- 3. Chùa Liên Hoa | HT Thích Duy Trần
INSERT INTO centers (id, slug, temple_name, abbot_name, abbot_rank, abbot_title, org_role, gender_section, region, country_code, province, address, phone, abbot_phone, sort_order, is_published, gallery_images) VALUES ('4844d1f9-9834-5039-b28f-ff54d28589ca', 'chua-lien-hoa-thich-duy-tran-3', 'Chùa Liên Hoa', 'Thích Duy Trần', 'HT', 'Trụ trì', NULL, 'TANG', 'NAM', 'VN', 'TP.HCM', '236/31/4 Thái Phiên, phường Bình Thới, TP.HCM', '0903924772', '0903924772', 3, true, '[]'::jsonb);
INSERT INTO courses (id, title, type, recurrence, day_start, day_end, weekday, schedule_text, center_id, sort_order) VALUES ('d3f5a70b-39ce-5451-bfea-861b269f822f', 'Khóa tu thiền thất', 'REGULAR', 'WEEKLY', NULL, NULL, 0, 'CN/Tuần', '4844d1f9-9834-5039-b28f-ff54d28589ca', 1);
INSERT INTO courses (id, title, type, recurrence, start_date, end_date, schedule_text, center_id, sort_order) VALUES ('55a8a0fe-e50c-507a-ab91-aadf664a330c', 'An cư', 'AN_CU', 'YEARLY', '2026-04-13'::date, '2026-07-13'::date, '13/4-13/7', '4844d1f9-9834-5039-b28f-ff54d28589ca', 2);

-- 4. Thiền Đường Liễu Quán 1 | HT Thích Huệ Minh
INSERT INTO centers (id, slug, temple_name, abbot_name, abbot_rank, abbot_title, org_role, gender_section, region, country_code, province, address, phone, abbot_phone, sort_order, is_published, gallery_images) VALUES ('bac0c6f9-9c79-592e-bf08-064f6af2a377', 'thien-duong-lieu-quan-1-thich-hue-minh-4', 'Thiền Đường Liễu Quán 1', 'Thích Huệ Minh', 'HT', 'Trụ trì', 'Phó', 'TANG', 'NAM', 'VN', 'TP.HCM', 'Thôn Phước Thành, phường Tân Hải, TP.HCM', '0908400155', '0908400155', 4, true, '[]'::jsonb);
INSERT INTO courses (id, title, type, recurrence, day_start, day_end, weekday, schedule_text, center_id, sort_order) VALUES ('e491072e-f51d-56c2-bad1-416e1d4808a7', 'Khóa tu thiền thất', 'REGULAR', 'MONTHLY_RANGE', 1, 7, NULL, '01-07', 'bac0c6f9-9c79-592e-bf08-064f6af2a377', 1);

-- 5. Chùa Thiên Trì | HT Thích Huệ Minh
INSERT INTO centers (id, slug, temple_name, abbot_name, abbot_rank, abbot_title, org_role, gender_section, region, country_code, province, address, phone, abbot_phone, sort_order, is_published, gallery_images) VALUES ('9122dfbf-efea-5039-88fb-6efc13a39947', 'chua-thien-tri-thich-hue-minh-5', 'Chùa Thiên Trì', 'Thích Huệ Minh', 'HT', 'Viện chủ', 'TBTK', 'TANG', 'NAM', 'VN', 'TP.HCM', 'Xã Bình Hưng, TP.HCM', '0908400155', '0908400155', 5, true, '[]'::jsonb);
INSERT INTO courses (id, title, type, recurrence, day_start, day_end, weekday, schedule_text, center_id, sort_order) VALUES ('682266b3-1c58-58e9-8836-ccb32873de4a', 'Khóa tu thiền thất', 'REGULAR', 'MONTHLY_RANGE', 14, 20, NULL, '14-20', '9122dfbf-efea-5039-88fb-6efc13a39947', 1);

-- 6. Chùa Huyền Trang | HT Thích Huệ Minh
INSERT INTO centers (id, slug, temple_name, abbot_name, abbot_rank, abbot_title, org_role, gender_section, region, country_code, province, address, phone, abbot_phone, sort_order, is_published, gallery_images) VALUES ('5d4c792d-63ab-5156-af2c-585048148ae4', 'chua-huyen-trang-thich-hue-minh-6', 'Chùa Huyền Trang', 'Thích Huệ Minh', 'HT', 'Trưởng Ban QT', NULL, 'TANG', 'NAM', 'VN', 'TP.HCM', '2056/39 Huỳnh Tấn Phát, xã Nhà Bè, TP.HCM', '0918666239', '0918666239', 6, true, '[]'::jsonb);

-- 7. Chùa Tam Bảo | HT Thích Thiện Tài
INSERT INTO centers (id, slug, temple_name, abbot_name, abbot_rank, abbot_title, org_role, gender_section, region, country_code, province, address, phone, abbot_phone, sort_order, is_published, gallery_images) VALUES ('0c05bdea-86fa-558a-bd6e-b2b6dcea4bb8', 'chua-tam-bao-thich-thien-tai-7', 'Chùa Tam Bảo', 'Thích Thiện Tài', 'HT', 'Trụ trì', NULL, 'TANG', 'NAM', 'VN', 'Đồng Tháp', 'Ấp Tân Thuận, xã Tân Nhuận Đông, Đồng Tháp', '0908535369', '0908535369', 7, true, '[]'::jsonb);
INSERT INTO courses (id, title, type, recurrence, day_start, day_end, weekday, schedule_text, center_id, sort_order) VALUES ('586740ce-fd49-5430-ae84-40b5f67510f2', 'Khóa tu mùa đông', 'WINTER', 'YEARLY', NULL, NULL, NULL, 'Khóa tu mùa đông', '0c05bdea-86fa-558a-bd6e-b2b6dcea4bb8', 1);

-- 8. Chùa Phật Quang | HT Thích Minh Hòa
INSERT INTO centers (id, slug, temple_name, abbot_name, abbot_rank, abbot_title, org_role, gender_section, region, country_code, province, address, phone, abbot_phone, sort_order, is_published, gallery_images) VALUES ('ec85b7e0-cd5a-5290-ba40-76f55640a43b', 'chua-phat-quang-thich-minh-hoa-8', 'Chùa Phật Quang', 'Thích Minh Hòa', 'HT', 'Trụ trì', NULL, 'TANG', 'NAM', 'VN', 'Đồng Tháp', 'Ấp Tân An, xã Tân Phú Trung, Đồng Tháp', '0764666841', '0764666841', 8, true, '[]'::jsonb);

-- 9. Chùa Phước Điền | HT Thích Minh Ngọc
INSERT INTO centers (id, slug, temple_name, abbot_name, abbot_rank, abbot_title, org_role, gender_section, region, country_code, province, address, phone, abbot_phone, sort_order, is_published, gallery_images) VALUES ('0e9c7b88-c8de-5400-bc76-34e935bfbfd1', 'chua-phuoc-dien-thich-minh-ngoc-9', 'Chùa Phước Điền', 'Thích Minh Ngọc', 'HT', 'Trụ trì', NULL, 'TANG', 'NAM', 'VN', 'An Giang', '646A đường Vòng Núi Sam, phường Núi Sam, An Giang', '0773133777', '0773133777', 9, true, '[]'::jsonb);

-- 10. Tu Viện Thanh Long | HT Thích Nhựt Tây
INSERT INTO centers (id, slug, temple_name, abbot_name, abbot_rank, abbot_title, org_role, gender_section, region, country_code, province, address, phone, abbot_phone, sort_order, is_published, gallery_images) VALUES ('7ade263e-30cf-579c-9ebc-ac2089fae40e', 'tu-vien-thanh-long-thich-nhut-tay-10', 'Tu Viện Thanh Long', 'Thích Nhựt Tây', 'HT', NULL, NULL, 'TANG', 'NUOC_NGOAI', 'US', NULL, 'Santa Ana, CA, USA', '001(714)5896571', '001(714)5896571', 10, true, '[]'::jsonb);

-- 11. Từ Ân Thiền Đường | HT Thích Minh Thọ
INSERT INTO centers (id, slug, temple_name, abbot_name, abbot_rank, abbot_title, org_role, gender_section, region, country_code, province, address, phone, abbot_phone, sort_order, is_published, gallery_images) VALUES ('c35a7af0-35fa-546a-889a-618c87712512', 'tu-an-thien-duong-thich-minh-tho-11', 'Từ Ân Thiền Đường', 'Thích Minh Thọ', 'HT', 'Trụ trì', NULL, 'TANG', 'NAM', 'VN', 'TP.HCM', 'Khu phố Phước Thành, phường Tân Hòa, TP.HCM', '0984314739', '0984314739', 11, true, '[]'::jsonb);

-- 12. Thiền Tự Quy Sơn | TT Thích Thiện Phẩm
INSERT INTO centers (id, slug, temple_name, abbot_name, abbot_rank, abbot_title, org_role, gender_section, region, country_code, province, address, phone, abbot_phone, sort_order, is_published, gallery_images) VALUES ('634ace86-5183-550b-a077-520a61f74182', 'thien-tu-quy-son-thich-thien-pham-12', 'Thiền Tự Quy Sơn', 'Thích Thiện Phẩm', 'TT', NULL, 'TTLL', 'TANG', 'NAM', 'VN', 'Đồng Nai', 'Ấp Tân Bình, phường Bửu Hòa, TP. Biên Hòa, Đồng Nai', '0984315181', '0984315181', 12, true, '[]'::jsonb);
INSERT INTO courses (id, title, type, recurrence, day_start, day_end, weekday, schedule_text, center_id, sort_order) VALUES ('c5f019bb-8087-590e-84f0-56918eb6ff0f', 'Khóa tu thiền thất', 'REGULAR', 'MONTHLY_RANGE', 16, 22, NULL, '16-22', '634ace86-5183-550b-a077-520a61f74182', 1);
INSERT INTO courses (id, title, type, recurrence, day_start, day_end, weekday, schedule_text, center_id, sort_order) VALUES ('6f4b7ded-9a1e-5092-9c84-1be50d5bb72b', 'Khóa tu mùa xuân', 'SPRING', 'YEARLY', NULL, NULL, NULL, 'Khóa tu mùa xuân', '634ace86-5183-550b-a077-520a61f74182', 2);
INSERT INTO courses (id, title, type, recurrence, start_date, end_date, schedule_text, center_id, sort_order) VALUES ('12ef3d83-adf5-55fe-a94a-2cbdf6097987', 'An cư', 'AN_CU', 'YEARLY', '2026-04-16'::date, '2026-07-11'::date, '16/4-11/7', '634ace86-5183-550b-a077-520a61f74182', 3);

-- 13. Tổ Đình Long Thiền | TT Thích Tắc Quang
INSERT INTO centers (id, slug, temple_name, abbot_name, abbot_rank, abbot_title, org_role, gender_section, region, country_code, province, address, phone, abbot_phone, sort_order, is_published, gallery_images) VALUES ('9d35ad96-dbf0-5c84-bea3-fce16c7d16f3', 'to-dinh-long-thien-thich-tac-quang-13', 'Tổ Đình Long Thiền', 'Thích Tắc Quang', 'TT', NULL, 'TTLL', 'TANG', 'NAM', 'VN', 'An Giang', 'Ấp Núi Két, phường Thới Sơn, An Giang', '0918575774', '0918575774', 13, true, '[]'::jsonb);
INSERT INTO courses (id, title, type, recurrence, day_start, day_end, weekday, schedule_text, center_id, sort_order) VALUES ('ebda1a50-41c6-5b81-8a55-c74c89b97416', 'Khóa tu thiền thất', 'REGULAR', 'MONTHLY_RANGE', 21, 27, NULL, '21-27', '9d35ad96-dbf0-5c84-bea3-fce16c7d16f3', 1);

-- 14. Chùa Thới Hưng | TT Thích Nhuận Thuận
INSERT INTO centers (id, slug, temple_name, abbot_name, abbot_rank, abbot_title, org_role, gender_section, region, country_code, province, address, phone, abbot_phone, sort_order, is_published, gallery_images) VALUES ('9d27f59f-8688-5599-a5a2-ec87614bf641', 'chua-thoi-hung-thich-nhuan-thuan-14', 'Chùa Thới Hưng', 'Thích Nhuận Thuận', 'TT', 'Trụ trì', NULL, 'TANG', 'NAM', 'VN', 'TP.HCM', 'B15/20, xã Bình Hưng, TP.HCM', '0976207061', '0976207061', 14, true, '[]'::jsonb);

-- 15. Chùa Thiên Trì | TT Thích Trung Duệ
INSERT INTO centers (id, slug, temple_name, abbot_name, abbot_rank, abbot_title, org_role, gender_section, region, country_code, province, address, phone, abbot_phone, sort_order, is_published, gallery_images) VALUES ('b1e03556-1500-5ba4-91ad-d79703d19d1f', 'chua-thien-tri-thich-trung-due-15', 'Chùa Thiên Trì', 'Thích Trung Duệ', 'TT', 'Trụ trì', NULL, 'TANG', 'NAM', 'VN', 'TP.HCM', '524/28 Nguyễn Đình Chiểu, phường Bàn Cờ, TP.HCM', '0908901842', '0908901842', 15, true, '[]'::jsonb);
INSERT INTO courses (id, title, type, recurrence, day_start, day_end, weekday, schedule_text, center_id, sort_order) VALUES ('dd1e1ef9-e61d-58e9-a6db-1be4914658ff', 'Khóa tu thiền thất', 'REGULAR', 'MONTHLY_RANGE', 6, 12, NULL, '06-12', 'b1e03556-1500-5ba4-91ad-d79703d19d1f', 1);

-- 16. Chùa Huê Quang | TT Thích Thiện Chơn
INSERT INTO centers (id, slug, temple_name, abbot_name, abbot_rank, abbot_title, org_role, gender_section, region, country_code, province, address, phone, abbot_phone, sort_order, is_published, gallery_images) VALUES ('ced4e6ba-ce2c-5265-8211-2611a62687d6', 'chua-hue-quang-thich-thien-chon-16', 'Chùa Huê Quang', 'Thích Thiện Chơn', 'TT', 'Trụ trì', NULL, 'TANG', 'NUOC_NGOAI', 'US', NULL, '14851 Wilson St, Midway City, CA 92655, USA', '001(714)6229307', '001(714)6229307', 16, true, '[]'::jsonb);

-- 17. Chùa Duy Pháp | TT Thích Huệ Trí
INSERT INTO centers (id, slug, temple_name, abbot_name, abbot_rank, abbot_title, org_role, gender_section, region, country_code, province, address, phone, abbot_phone, sort_order, is_published, gallery_images) VALUES ('f92eb867-4efd-5dd7-9dbd-8a0c0e48f3f6', 'chua-duy-phap-thich-hue-tri-17', 'Chùa Duy Pháp', 'Thích Huệ Trí', 'TT', 'Trụ trì', 'Nhiếp ảnh', 'TANG', 'NAM', 'VN', 'TP.HCM', '362/46 Nguyễn Đình Chiểu, phường Bàn Cờ, TP.HCM', '0918251975', '0918251975', 17, true, '[]'::jsonb);
INSERT INTO courses (id, title, type, recurrence, day_start, day_end, weekday, schedule_text, center_id, sort_order) VALUES ('42c75c4f-3f24-5048-be79-209607f0caa8', 'Khóa tu thiền thất', 'REGULAR', 'MONTHLY_RANGE', 6, 12, NULL, '06-12', 'f92eb867-4efd-5dd7-9dbd-8a0c0e48f3f6', 1);
INSERT INTO courses (id, title, type, recurrence, start_date, end_date, schedule_text, center_id, sort_order) VALUES ('80fcfe40-5eca-53f5-b9d8-fee6a1ef9ec5', 'An cư', 'AN_CU', 'YEARLY', '2026-04-16'::date, '2026-07-16'::date, '16/4-16/7', 'f92eb867-4efd-5dd7-9dbd-8a0c0e48f3f6', 2);

-- 18. Chùa Long Sơn | TT Thích Quảng Phúc
INSERT INTO centers (id, slug, temple_name, abbot_name, abbot_rank, abbot_title, org_role, gender_section, region, country_code, province, address, phone, abbot_phone, sort_order, is_published, gallery_images) VALUES ('0e437f39-be53-518f-8b3d-c69601814536', 'chua-long-son-thich-quang-phuc-18', 'Chùa Long Sơn', 'Thích Quảng Phúc', 'TT', 'Trụ trì', NULL, 'TANG', 'NAM', 'VN', 'An Giang', 'Ấp Núi Két, phường Thới Sơn, An Giang', '0985116649', '0985116649', 18, true, '[]'::jsonb);
INSERT INTO courses (id, title, type, recurrence, day_start, day_end, weekday, schedule_text, center_id, sort_order) VALUES ('56710b1f-03a2-5a90-9a83-e897c301b0b6', 'Khóa tu thiền thất', 'REGULAR', 'MONTHLY_RANGE', 10, 16, NULL, '10-16', '0e437f39-be53-518f-8b3d-c69601814536', 1);

-- 19. Chùa An Phước | TT Thích Lệ Đạo
INSERT INTO centers (id, slug, temple_name, abbot_name, abbot_rank, abbot_title, org_role, gender_section, region, country_code, province, address, phone, abbot_phone, sort_order, is_published, gallery_images) VALUES ('6f8079c1-4dc2-5ab8-9d72-00f5458eb3d7', 'chua-an-phuoc-thich-le-dao-19', 'Chùa An Phước', 'Thích Lệ Đạo', 'TT', 'Trụ trì', NULL, 'TANG', 'NAM', 'VN', 'An Giang', 'Ấp An Ninh, xã Hội An, An Giang', '0919726186', '0919726186', 19, true, '[]'::jsonb);
INSERT INTO courses (id, title, type, recurrence, day_start, day_end, weekday, schedule_text, center_id, sort_order) VALUES ('fd2c5d26-7c25-58eb-88b6-bca8622f1f4a', 'Khóa tu thiền thất', 'REGULAR', 'MONTHLY_RANGE', 1, 7, NULL, '01-07', '6f8079c1-4dc2-5ab8-9d72-00f5458eb3d7', 1);
INSERT INTO courses (id, title, type, recurrence, start_date, end_date, schedule_text, center_id, sort_order) VALUES ('30aad29b-5079-55dd-b085-1ac36b54092f', 'An cư', 'AN_CU', 'YEARLY', '2026-04-10'::date, '2026-07-10'::date, '10/4-10/7', '6f8079c1-4dc2-5ab8-9d72-00f5458eb3d7', 2);

-- 20. Chùa Long Đức | ĐĐ Thích Thiện Quang
INSERT INTO centers (id, slug, temple_name, abbot_name, abbot_rank, abbot_title, org_role, gender_section, region, country_code, province, address, phone, abbot_phone, sort_order, is_published, gallery_images) VALUES ('d7c0e706-f291-577c-af02-adcf47ccd929', 'chua-long-duc-thich-thien-quang-20', 'Chùa Long Đức', 'Thích Thiện Quang', 'ĐĐ', 'Trụ trì', NULL, 'TANG', 'TRUNG', 'VN', 'Lâm Đồng', 'Xã Trà Tân, tỉnh Lâm Đồng', '0909079425', '0909079425', 20, true, '[]'::jsonb);

-- 21. Chùa Phật Quang | ĐĐ Thích Tịnh Trí
INSERT INTO centers (id, slug, temple_name, abbot_name, abbot_rank, abbot_title, org_role, gender_section, region, country_code, province, address, phone, abbot_phone, sort_order, is_published, gallery_images) VALUES ('de22a415-b4d1-557e-ab5f-5431bbe4c3fb', 'chua-phat-quang-thich-tinh-tri-21', 'Chùa Phật Quang', 'Thích Tịnh Trí', 'ĐĐ', 'Trụ trì', NULL, 'TANG', 'NAM', 'VN', 'Cần Thơ', 'Ấp Trường Thuận, xã Trường Long, TP. Cần Thơ', '0388565642', '0388565642', 21, true, '[]'::jsonb);
INSERT INTO courses (id, title, type, recurrence, day_start, day_end, weekday, schedule_text, center_id, sort_order) VALUES ('13c2e7e8-0b37-5825-be73-475653f61f8b', 'Khóa tu thiền thất', 'REGULAR', 'MONTHLY_RANGE', 8, 14, NULL, '08-14', 'de22a415-b4d1-557e-ab5f-5431bbe4c3fb', 1);

-- 22. Chùa Sơn Hải | ĐĐ Thích Đức Sơn
INSERT INTO centers (id, slug, temple_name, abbot_name, abbot_rank, abbot_title, org_role, gender_section, region, country_code, province, address, phone, abbot_phone, sort_order, is_published, gallery_images) VALUES ('839f93fd-4b50-54b0-8cef-0e58cbe0ad25', 'chua-son-hai-thich-duc-son-22', 'Chùa Sơn Hải', 'Thích Đức Sơn', 'ĐĐ', 'Trụ trì', NULL, 'TANG', 'TRUNG', 'VN', 'Khánh Hòa', 'Thôn Ninh Đảo, xã Đại Lãnh, Khánh Hòa', '0365488810', '0365488810', 22, true, '[]'::jsonb);
INSERT INTO courses (id, title, type, recurrence, day_start, day_end, weekday, schedule_text, center_id, sort_order) VALUES ('5aba33f8-4d42-51d2-9c81-b4f55b4343ec', 'Khóa tu thiền thất', 'REGULAR', 'MONTHLY_RANGE', 21, 27, NULL, '21-27', '839f93fd-4b50-54b0-8cef-0e58cbe0ad25', 1);
INSERT INTO courses (id, title, type, recurrence, start_date, end_date, schedule_text, center_id, sort_order) VALUES ('a1e791d7-7505-5800-99d5-c635c970656d', 'An cư', 'AN_CU', 'YEARLY', '2026-04-06'::date, '2026-07-06'::date, '6/4-6/7', '839f93fd-4b50-54b0-8cef-0e58cbe0ad25', 2);

-- 23. Chùa Phước Quang | ĐĐ Thích Nhuận Nguyên
INSERT INTO centers (id, slug, temple_name, abbot_name, abbot_rank, abbot_title, org_role, gender_section, region, country_code, province, address, phone, abbot_phone, sort_order, is_published, gallery_images) VALUES ('7ca14a0e-c4f8-54cd-92b5-6f46f17160ee', 'chua-phuoc-quang-thich-nhuan-nguyen-23', 'Chùa Phước Quang', 'Thích Nhuận Nguyên', 'ĐĐ', 'Trụ trì', NULL, 'TANG', 'NAM', 'VN', 'Bà Rịa - Vũng Tàu', 'KP Tân Phú, phường Phú Mỹ, Bà Rịa - Vũng Tàu', '0932653153', '0932653153', 23, true, '[]'::jsonb);

-- 24. Chùa Phú Thọ | ĐĐ Thích Giác Tiến
INSERT INTO centers (id, slug, temple_name, abbot_name, abbot_rank, abbot_title, org_role, gender_section, region, country_code, province, address, phone, abbot_phone, sort_order, is_published, gallery_images) VALUES ('09b5da1d-0daa-5392-afe7-9259cacbeb9d', 'chua-phu-tho-thich-giac-tien-24', 'Chùa Phú Thọ', 'Thích Giác Tiến', 'ĐĐ', 'Trụ trì', NULL, 'TANG', 'TRUNG', 'VN', 'Lâm Đồng', 'Thôn 3, xã Hàm Liêm, tỉnh Lâm Đồng', '0845950943', '0845950943', 24, true, '[]'::jsonb);

-- 25. Chùa Huyền Trang | ĐĐ Thích Minh Phú
INSERT INTO centers (id, slug, temple_name, abbot_name, abbot_rank, abbot_title, org_role, gender_section, region, country_code, province, address, phone, abbot_phone, sort_order, is_published, gallery_images) VALUES ('e3dc7685-add7-54ab-a324-2f75c75a4508', 'chua-huyen-trang-thich-minh-phu-25', 'Chùa Huyền Trang', 'Thích Minh Phú', 'ĐĐ', NULL, NULL, 'TANG', 'NAM', 'VN', 'TP.HCM', '2056/39 Huỳnh Tấn Phát, phường Nhà Bè, TP.HCM', '0886997243', '0886997243', 25, true, '[]'::jsonb);

-- 26. Chùa Liên Hoa | ĐĐ Thích Pháp Hiện
INSERT INTO centers (id, slug, temple_name, abbot_name, abbot_rank, abbot_title, org_role, gender_section, region, country_code, province, address, phone, abbot_phone, sort_order, is_published, gallery_images) VALUES ('3a7311f6-6cd1-5547-8a5f-2b6ae0b6a4f7', 'chua-lien-hoa-thich-phap-hien-26', 'Chùa Liên Hoa', 'Thích Pháp Hiện', 'ĐĐ', NULL, 'TTLL', 'TANG', 'NAM', 'VN', 'TP.HCM', 'Số 58 đường Ông Niệm, xã Bình Hưng, TP.HCM', '0936623761', '0936623761', 26, true, '[]'::jsonb);

-- 27. Chùa Thiền Ân | ĐĐ Thích Pháp Nhẫn
INSERT INTO centers (id, slug, temple_name, abbot_name, abbot_rank, abbot_title, org_role, gender_section, region, country_code, province, address, phone, abbot_phone, sort_order, is_published, gallery_images) VALUES ('af2c8d46-59a3-5f2d-af50-4d3f7f1a33d5', 'chua-thien-an-thich-phap-nhan-27', 'Chùa Thiền Ân', 'Thích Pháp Nhẫn', 'ĐĐ', NULL, NULL, 'TANG', 'NUOC_NGOAI', 'US', NULL, 'Houston, Texas, USA', '001(281)8577047', '001(281)8577047', 27, true, '[]'::jsonb);

-- 28. Chùa Phật Đà | ĐĐ Thích Nhuận Nghĩa
INSERT INTO centers (id, slug, temple_name, abbot_name, abbot_rank, abbot_title, org_role, gender_section, region, country_code, province, address, phone, abbot_phone, sort_order, is_published, gallery_images) VALUES ('c1413254-16e7-5403-a5bf-667e5142ecaf', 'chua-phat-da-thich-nhuan-nghia-28', 'Chùa Phật Đà', 'Thích Nhuận Nghĩa', 'ĐĐ', NULL, NULL, 'TANG', 'NUOC_NGOAI', 'US', NULL, 'Houston, Texas, USA', '001(281)8577047', '001(281)8577047', 28, true, '[]'::jsonb);

-- 29. Chùa Tân Phước | ĐĐ Thích Quang Bình
INSERT INTO centers (id, slug, temple_name, abbot_name, abbot_rank, abbot_title, org_role, gender_section, region, country_code, province, address, phone, abbot_phone, sort_order, is_published, gallery_images) VALUES ('e0646805-e814-5e17-9ba3-f87037be6a85', 'chua-tan-phuoc-thich-quang-binh-29', 'Chùa Tân Phước', 'Thích Quang Bình', 'ĐĐ', 'Trụ trì', NULL, 'TANG', 'NAM', 'VN', 'TP.HCM', '362/46 Nguyễn Đình Chiểu, phường Bàn Cờ, TP.HCM', '0778061727', '0778061727', 29, true, '[]'::jsonb);

-- 30. Chùa Phước Lộc | ĐĐ Thích Nhuận Bình
INSERT INTO centers (id, slug, temple_name, abbot_name, abbot_rank, abbot_title, org_role, gender_section, region, country_code, province, address, phone, abbot_phone, sort_order, is_published, gallery_images) VALUES ('108fa3cc-855b-5cf6-9ffd-5d8ee26b4d50', 'chua-phuoc-loc-thich-nhuan-binh-30', 'Chùa Phước Lộc', 'Thích Nhuận Bình', 'ĐĐ', NULL, NULL, 'TANG', 'NAM', 'VN', 'Vĩnh Long', 'Ấp Tân Hòa, xã Tân Xuân, tỉnh Vĩnh Long', '0938422772', '0938422772', 30, true, '[]'::jsonb);

-- 31. Linh Quang Thiền Tự | ĐĐ Thích Huệ Đạo
INSERT INTO centers (id, slug, temple_name, abbot_name, abbot_rank, abbot_title, org_role, gender_section, region, country_code, province, address, phone, abbot_phone, sort_order, is_published, gallery_images) VALUES ('218b7122-74ff-596d-b59e-d520e1cba054', 'linh-quang-thien-tu-thich-hue-dao-31', 'Linh Quang Thiền Tự', 'Thích Huệ Đạo', 'ĐĐ', NULL, NULL, 'TANG', 'NAM', 'VN', 'Tây Ninh', '126 Tôn Thất Tùng, Tân Biên, Tây Ninh', '0938299996', '0938299996', 31, true, '[]'::jsonb);

-- 32. Chùa Thượng | ĐĐ Thích Thanh An
INSERT INTO centers (id, slug, temple_name, abbot_name, abbot_rank, abbot_title, org_role, gender_section, region, country_code, province, address, phone, abbot_phone, sort_order, is_published, gallery_images) VALUES ('a6ffb7eb-6bdb-599b-b5f4-708c83d22df4', 'chua-thuong-thich-thanh-an-32', 'Chùa Thượng', 'Thích Thanh An', 'ĐĐ', 'Trụ trì', NULL, 'TANG', 'BAC', 'VN', 'Bắc Ninh', 'Khu Thủ Ninh, phường Kinh Bắc, tỉnh Bắc Ninh', '0974986486', '0974986486', 32, true, '[]'::jsonb);

-- 33. Thiền Viện Linh Sơn | ĐĐ Thích Nhuận Quy
INSERT INTO centers (id, slug, temple_name, abbot_name, abbot_rank, abbot_title, org_role, gender_section, region, country_code, province, address, phone, abbot_phone, sort_order, is_published, gallery_images) VALUES ('91233ab9-8678-55a0-bf91-4e3b1254fb4e', 'thien-vien-linh-son-thich-nhuan-quy-33', 'Thiền Viện Linh Sơn', 'Thích Nhuận Quy', 'ĐĐ', NULL, NULL, 'TANG', 'BAC', 'VN', 'Thái Nguyên', 'Phường Sông Công, tỉnh Thái Nguyên', '0967746777', '0967746777', 33, true, '[]'::jsonb);

-- 36. Chùa Pháp Thành | NS T Nữ An Hương
INSERT INTO centers (id, slug, temple_name, abbot_name, abbot_rank, abbot_title, org_role, gender_section, region, country_code, province, address, phone, abbot_phone, sort_order, is_published, gallery_images) VALUES ('511a2b9d-55eb-5a25-b6c3-0c33dc4beb38', 'chua-phap-thanh-t-nu-an-huong-36', 'Chùa Pháp Thành', 'T Nữ An Hương', 'NS', 'Viện chủ', NULL, 'NI', 'NAM', 'VN', 'TP.HCM', '192/32/4 Phan Văn Chí, phường 4, quận 3, TP.HCM', '0969328681', '0969328681', 36, true, '[]'::jsonb);
INSERT INTO courses (id, title, type, recurrence, day_start, day_end, weekday, schedule_text, center_id, sort_order) VALUES ('481acbfd-05f4-5c74-a5f0-2b0cdc7d4cf2', 'Khóa tu thiền thất', 'REGULAR', 'MONTHLY_RANGE', 3, 9, NULL, '03-09', '511a2b9d-55eb-5a25-b6c3-0c33dc4beb38', 1);

-- 37. Chùa Quang Nhân | NS T Nữ Đàm Trì
INSERT INTO centers (id, slug, temple_name, abbot_name, abbot_rank, abbot_title, org_role, gender_section, region, country_code, province, address, phone, abbot_phone, sort_order, is_published, gallery_images) VALUES ('27413d0b-3a57-55be-8f3b-ce3a41084897', 'chua-quang-nhan-t-nu-dam-tri-37', 'Chùa Quang Nhân', 'T Nữ Đàm Trì', 'NS', 'Trụ trì', NULL, 'NI', 'TRUNG', 'VN', 'Lâm Đồng', 'Xã Bảo Lâm 3, tỉnh Lâm Đồng', '0913676009', '0913676009', 37, true, '[]'::jsonb);
INSERT INTO courses (id, title, type, recurrence, day_start, day_end, weekday, schedule_text, center_id, sort_order) VALUES ('6f0cd573-59c3-5e51-a877-2fcf1e471456', 'Khóa tu thiền thất', 'REGULAR', 'WEEKLY', NULL, NULL, 0, 'CN', '27413d0b-3a57-55be-8f3b-ce3a41084897', 1);

-- 38. Chùa Liên Hương | SC Huệ Ý
INSERT INTO centers (id, slug, temple_name, abbot_name, abbot_rank, abbot_title, org_role, gender_section, region, country_code, province, address, phone, abbot_phone, sort_order, is_published, gallery_images) VALUES ('c8e85203-3b90-51c1-8432-716d21b454c2', 'chua-lien-huong-hue-y-38', 'Chùa Liên Hương', 'Huệ Ý', 'SC', 'Trụ trì', NULL, 'NI', 'BAC', 'VN', 'Hà Nội', 'Quận Cầu Giấy, Hà Nội', '0386466874', '0386466874', 38, true, '[]'::jsonb);

-- 39. Tịnh Thất Phước Nguyên | SC An Đảo
INSERT INTO centers (id, slug, temple_name, abbot_name, abbot_rank, abbot_title, org_role, gender_section, region, country_code, province, address, phone, abbot_phone, sort_order, is_published, gallery_images) VALUES ('d5ee104b-f8bb-5716-8050-036cffece701', 'tinh-that-phuoc-nguyen-an-dao-39', 'Tịnh Thất Phước Nguyên', 'An Đảo', 'SC', 'Trụ trì', NULL, 'NI', 'NAM', 'VN', 'Đồng Tháp', 'Ấp Tân Hòa 2, xã Phú Hữu, tỉnh Đồng Tháp', '0825720729', '0825720729', 39, true, '[]'::jsonb);
INSERT INTO courses (id, title, type, recurrence, day_start, day_end, weekday, schedule_text, center_id, sort_order) VALUES ('c0f94f09-d0f2-5016-bcd5-c8c088acb4b7', 'Khóa tu thiền thất', 'REGULAR', 'MONTHLY_RANGE', 28, 4, NULL, '28-04', 'd5ee104b-f8bb-5716-8050-036cffece701', 1);

-- 40. Chùa Liên Hoa | SC T Nữ Bửu Nhật
INSERT INTO centers (id, slug, temple_name, abbot_name, abbot_rank, abbot_title, org_role, gender_section, region, country_code, province, address, phone, abbot_phone, sort_order, is_published, gallery_images) VALUES ('0a641660-5645-51dd-9260-b2c08c4f27bb', 'chua-lien-hoa-t-nu-buu-nhat-40', 'Chùa Liên Hoa', 'T Nữ Bửu Nhật', 'SC', 'Trụ trì', NULL, 'NI', 'NAM', 'VN', 'TP.HCM', 'Đường Lê Thị Đỏ, xã Bà Điểm, TP.HCM', '0906780196', '0906780196', 40, true, '[]'::jsonb);

-- 41. Thiền Viện Duy Lực | SC T Nữ Pháp Ngân
INSERT INTO centers (id, slug, temple_name, abbot_name, abbot_rank, abbot_title, org_role, gender_section, region, country_code, province, address, phone, abbot_phone, sort_order, is_published, gallery_images) VALUES ('3fe10b9c-e3c8-5420-b7b4-878caceda636', 'thien-vien-duy-luc-t-nu-phap-ngan-41', 'Thiền Viện Duy Lực', 'T Nữ Pháp Ngân', 'SC', NULL, NULL, 'NI', 'NAM', 'VN', 'Đồng Nai', 'Tổ 8, ấp 4, phường Long Hưng, TP. Đồng Nai', '0836357624', '0836357624', 41, true, '[]'::jsonb);
INSERT INTO courses (id, title, type, recurrence, day_start, day_end, weekday, schedule_text, center_id, sort_order) VALUES ('25ca7cf2-1ad5-52d9-bbde-1b2c09e8a23e', 'Khóa tu mùa đông', 'WINTER', 'YEARLY', NULL, NULL, NULL, 'Khóa tu mùa đông', '3fe10b9c-e3c8-5420-b7b4-878caceda636', 1);

-- 42. Chùa Pháp Thành | SC T Nữ An Hữu
INSERT INTO centers (id, slug, temple_name, abbot_name, abbot_rank, abbot_title, org_role, gender_section, region, country_code, province, address, phone, abbot_phone, sort_order, is_published, gallery_images) VALUES ('efed47d0-c145-5e92-813c-12129e2258e5', 'chua-phap-thanh-t-nu-an-huu-42', 'Chùa Pháp Thành', 'T Nữ An Hữu', 'SC', 'Trụ trì', NULL, 'NI', 'NAM', 'VN', 'TP.HCM', 'Số 58 đường Ông Niệm, xã Bình Hưng, TP.HCM', '0907274882', '0907274882', 42, true, '[]'::jsonb);

COMMIT;
