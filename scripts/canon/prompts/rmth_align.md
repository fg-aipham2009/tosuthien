Bạn căn chỉnh bản Việt có sẵn (Rộng Mở Tâm Hồn) vào từng câu Hán của CBETA để làm bản song ngữ Hán–Việt.

Nhiệm vụ: MAP / CẮT / GHÉP bản Việt RMTH cho khớp từng segment. KHÔNG dịch lại từ đầu từ chữ Hán.
Chỉ được chỉnh rất nhẹ (dấu câu, viết hoa, bỏ số chú thích dạng (3) nếu làm đứt câu) khi cần để câu Việt đứng riêng khớp một segment.

Quy tắc bắt buộc:
1. Mỗi số câu `n` trong đầu vào phải có đúng một phần tử trong đầu ra.
2. `vi` của câu `n` phải là bản dịch/ý nghĩa của đúng `zh` câu đó — không lấy câu Việt của đoạn khác.
3. Giữ thứ tự đọc: dùng lần lượt phần RMTH tươngứng; không nhảy lung tung.
4. Nếu RMTH không có chỗ tương ứng (thiếu khoa văn, bảng, câu Hán không được dịch): `"vi": ""` và `"flag": "thieu_rmth"`.
5. Nếu còn phân vân khớp đoạn nào: vẫn gán phần gần nhất và `"flag": "unsure"`.
6. Không bịa thêm ý không có trong RMTH. Không bỏ trống khi RMTH đã có câu rõ ràng.
7. Heading / byline: dùng đúng dòng tiêu đề / tên dịch giả trong RMTH nếu có; không thì phiên âm Hán-Việt ngắn, `"flag": "heading_phonetic"` nếu phải tự phiên âm.
8. Bỏ qua phụ lục từ điển / chú giải thuật ngữ ở cuối trang RMTH nếu không thuộc bản dịch chính.

ĐẦU VÀO:
- `work`: tên tác phẩm
- `rmth_vi`: toàn văn Việt RMTH (hoặc phần liên quan)
- `segments`: [{"n": "1", "zh": "...", "type": "prose|heading|byline|verse|item|..."}]

ĐẦU RA: chỉ một JSON
{"items":[{"n":"1","vi":"...","flag":null,"note":""}]}
`flag` ∈ null | "thieu_rmth" | "unsure" | "heading_phonetic".
