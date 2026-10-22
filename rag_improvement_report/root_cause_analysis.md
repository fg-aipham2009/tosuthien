# Root cause analysis (pre-fix)

Benchmark trước sửa: **57.57/100** (Opus 5.5, 100/100 attempted).

## Lỗi thật của RAG (không phải grader)

### 1. Coverage false-positive + formatter sai nhiệm vụ (TEST01 / TEST02 / nhóm E)

- `LIST_ENUM_RE` có `傳燈錄.*祖` → khớp **馬祖** trong câu hỏi heading → `coverageMode=true`.
- Pipeline chạy `retrieveDeep` + `formatCbetaCoverageListAnswer` → luôn in **西天/東土 + phụ lục tần suất**, không phải mục `懷讓禪師第二世下五十六人（馬祖法嗣）`.
- `listCoverageWorks` **bỏ qua `decision.workCodes`** → TEST02 quét ~61 works dù đã có `T51n2076`.

### 2. Thiếu section-aware retrieval

- Chunk đúng đã có sẵn: `T51n2076` / juan 8 / `0256c07` chứa **đủ 56 tên** + marker 見錄/不錄.
- Hệ thống không có path “neo heading → parse ordered list”.

### 3. Work catalog (F02)

- Hỏi `天聖廣燈錄 work_code` chỉ dựa hybrid chunks *nhắc tên* bộ khác → LLM trả “không thấy”, trong khi `works` table có `X78n1553`.

## Lỗi chủ yếu ở grader / benchmark

### TEST04 Lineage (0/15)

- Câu trả lời VI có đủ cạnh + citation, nhưng grader đòi substring cứng `馬祖`/`百丈`/`黃檗`/`臨濟` trong khi answer dùng `道一`/`懷海`/`希運`/`義玄`.
- Đã nới grader theo **alias Hán hợp lệ** (không hardcode đáp án RAG).

## Ưu tiên sửa đã làm

1. Tách `sectionListMode` vs `coverageMode`; sửa regex false-positive.
2. `retrieveSectionList` + parse/format ordered 見錄/不錄; honor `workCodes`.
3. Lookup metadata `works` cho câu hỏi work_code ↔ title.
4. Prompt lineage: yêu cầu dị danh Hán; grader alias-aware.
