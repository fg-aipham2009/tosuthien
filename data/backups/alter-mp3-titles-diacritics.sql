-- Display titles with Vietnamese diacritics (filename/storage_path unchanged)
BEGIN;
UPDATE mp3_tracks SET title = replace(title, 'Lich su Thien Tong', 'Lịch sử Thiền Tông');
UPDATE mp3_tracks SET title = replace(title, 'Khai Thi To Su Thien', 'Khai Thị Tổ Sư Thiền');
UPDATE mp3_tracks SET title = replace(title, 'Khai Thi Hoa Ky', 'Khai Thị Hoa Kỳ');
UPDATE mp3_tracks SET title = '01_Sư Phụ giảng Tông Chỉ Tịnh Độ 266B'
 WHERE title = '01_Su Phu giang Tong Chi Tinh Do 266B';
UPDATE mp3_tracks SET title = '02_Thế nào là Tu Tịnh Độ theo đúng bản ý của Phật Tổ 391 A'
 WHERE title = '02_The nao la Tu Tinh Do theo dung ban y cua Phat To 391 A';
UPDATE mp3_tracks SET title = '03_Tu niệm Phật cần phải biết rõ Tông chỉ Tịnh Độ mới dạy người khác 238 B'
 WHERE title = '03_Tu niem Phat can phai biet ro Tong chi Tinh Do moi day nguoi khac 238 B';
UPDATE mp3_tracks SET title = '04_Tu Tịnh Độ chết có Phật tiếp dẫn, Tu TST chết có ai tiếp dẫn không Sư Phụ 238 B'
 WHERE title = '04_Tu Tinh Do chet co Phat tiep dan, Tu TST chet co ai tiep dan khong Su Phu 238 B';
COMMIT;
