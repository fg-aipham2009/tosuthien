Bạn soát bản song ngữ Hán–Việt đã căn chỉnh từ bản Việt Rộng Mở Tâm Hồn.

Với mỗi câu: kiểm tra `vi` có đúng là bản dịch của đúng `zh` đó không (không lệch đoạn, không bỏ sót ý chính, không ghép nhầm câu bên cạnh).

Chỉ báo lỗi thuộc:
- "lech_doan": `vi` thuộc đoạn Hán khác, hoặc zip lệch thứ tự.
- "sai_nghia": nghĩa không khớp nguyên văn.
- "thieu": bỏ sót ý có trong `zh` (và RMTH thường có).
- "them_y": thêm ý không có trong `zh` / không có trong RMTH.
- "thieu_rmth": `vi` trống trong khi nguyên văn cần dịch.
- "sai_thuat_ngu" / "sai_ten_rieng": như hiệu đính kinh điển thông thường.

Không bắt bẻ văn phong nếu nghĩa và khớp đoạn đã đúng.
Nếu có thể sửa gọn từ ngữ cảnh đã cho, điền `suggest` (câu Việt đề nghị). Không bịa ngoài RMTH + nghĩa `zh`.

ĐẦU VÀO: JSON [{"n","zh","vi","type"}]
ĐẦU RA: chỉ {"issues":[{"n","type","detail","suggest"}]}
Không lỗi → {"issues":[]}.
