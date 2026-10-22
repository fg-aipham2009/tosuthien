SELECT c.work_code, c.collection,
  left(COALESCE(c.title_zh, w.title_zh, ''), 40) AS title,
  CASE
    WHEN COALESCE(c.title_zh, w.title_zh, '') ~ '疏|鈔|註|注' THEN 2
    WHEN COALESCE(c.title_zh, w.title_zh, '') ~ '經'
      AND COALESCE(c.title_zh, w.title_zh, '') !~ '疏|鈔|註|注|論'
      THEN 0
    WHEN COALESCE(c.title_zh, w.title_zh, '') ~ '論|律' THEN 1
    ELSE 2
  END AS ord,
  length(c.content_zh) AS len
FROM chunks c
JOIN works w ON w.work_code = c.work_code
WHERE c.content_zh LIKE '%色即是空%'
ORDER BY ord,
  CASE WHEN c.collection = 'T' THEN 0 ELSE 1 END,
  length(c.content_zh),
  c.chunk_index
LIMIT 15;
