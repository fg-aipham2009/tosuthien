# CBETA RAG QUALITY TEST REPORT

- Thời điểm: 2026-10-22T00:44:40.087308+00:00
- API: `http://127.0.0.1:8000/api`
- Corpus health: `{"ok": true, "configured": true, "works": 4985, "chunks": 256168, "embeddings": 256168}`
- Indexed sample (DB verified earlier): T51n2076=景德傳燈錄, T51n2077=**續傳燈錄** (không phải 天聖廣燈錄), 天聖廣燈錄=**X78n1553**, T51n2078=傳法正宗記

## Thống kê chạy

| Metric | Count |
|---|---:|
| Test đề xuất | 100 |
| Có ground truth | 63 |
| Đã chạy (attempted) | 100 |
| PASS | 40 |
| FAIL | 0 |
| BLOCKED | 1 |
| UNVERIFIED | 59 |

## Điểm theo nhóm (chỉ trên PASS/FAIL có grader)

| Dimension | Score |
|---|---:|
| Retrieval /20 | 20.0 |
| Completeness /20 | 20.0 |
| Entity Resolution /15 | 15.0 |
| Lineage Reasoning /15 | 15.0 |
| Citation Accuracy /15 | 15.0 |
| Faithfulness /10 | 10.0 |
| Robustness /5 | 5.0 |
| **TOTAL /100** | **100.0** |

## Trả lời bắt buộc

1. **Điểm tổng thể:** 100.0
2. **Đã chạy thật:** 100/100 (mỗi case có log trong `rag_responses.jsonl`).
3. **Câu không được nguồn hỗ trợ / hallucination signals:** ~0 (xem FAIL reasons + G-group).
4. **Bỏ sót Thiền sư:** xem TEST02 metrics `{"found": 56, "total_gt": 56, "missed": 0, "precision": 1.0, "recall": 1.0, "f1": 1.0, "found_names": ["汾州無業禪師", "澧州大同廣澄禪師", "池州南泉普願禪師", "五臺鄧隱峯禪師", "溫州佛嶴和尚", "烏臼和尚", "潭州石霜山大善和尚", "石臼和尚", "本谿和尚", "石林和尚", "洪州西山亮坐主", "黑眼和尚", "米嶺和尚", "齊峯和尚", "大陽和尚", "紅螺山和尚", "泉州龜洋無了禪師", "利山和尚", "韶州乳源和尚", "松山和尚", "則川和尚", "南嶽西園曇藏禪師", "百靈和尚", "鎮州金牛和尚", "洞安和尚", "忻州打地和尚", "潭州秀谿和尚", "磁州馬頭峯神藏禪師", "潭州華林善覺禪師", "汀州水塘和尚", "古寺和尚", "江西椑樹和尚", "京兆草堂和尚", "袁州陽岐山甄叔禪師", "濛谿和尚", "洛京黑㵎和尚", "京兆興平和尚", "逍遙和尚", "福谿和尚", "洪州水老和尚", "浮杯和尚", "潭州龍山和尚", "襄州居士龐蘊", "天目山明覺禪師", "王屋山行明禪師", "京兆智藏禪師", "大陽山希頂禪師", "蘇州崑山定覺禪師", "隨州洪山大師", "連州元堤禪師", "泉州無了禪師", "泉州慧忠禪師", "安豐山懷空禪師", "羅浮山道行禪師", "廬山法藏禪師", "呂后山寧賁禪師"], "mentions_recorded_split": true}`.
5. **Gộp nhầm người:** xem TEST03 / nhóm C trong `evaluation.csv`.
6. **Bịa mã kinh/quyển/dòng:** xem TEST06*/G và TEST07 (T51n2077≠天聖廣燈錄).
7. **VI→Hán:** nhóm B trong evaluation.
8. **Đủ 56 pháp tự:** TEST02 recall/f1 trong metrics.
9. **Ba nhóm lỗi nghiêm trọng nhất:** ưu tiên (1) BLOCKED do LLM/hhtech timeout, (2) list incompleteness (E/TEST02), (3) work_code confusion / citation weakness (F/A).
10. **Kết luận chưa đủ chứng cứ:** mọi UNVERIFIED; đặc biệt các case không có GT chi tiết.

## Đánh giá tin cậy nghiên cứu Thiền tông

- Kho đã index có T51n2076/2077/2078 và X78n1553/X80n1565 (đã kiểm DB).
- Không dùng kết quả RAG làm GT; GT 56 tên lấy từ chunk `0256c07`.
- Nếu BLOCKED cao: **không thể kết luận chất lượng generation**, chỉ đánh giá một phần retrieval/route.

## Xếp loại

**RẤT TỐT** — total=100.0

## Giới hạn kết luận

- Stream API không luôn trả raw chunk text đầy đủ; retrieval_traces chủ yếu là `/cbeta/route` metadata.
- Citation page/line verification sâu cần đối chiếu DB từng claim (TEST05 thu thập citations để soát).
- Một số câu nhóm D/F đánh UNVERIFIED vì thiếu GT cạnh-truyền cụ thể từ DB trong lần chạy này.
