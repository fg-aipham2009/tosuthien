-- Deduplicate post_images that share the same post_id + url (WP size variants).
-- Keep the row with the lowest sort_order (then oldest created_at).
BEGIN;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY post_id, url
      ORDER BY sort_order ASC, created_at ASC, id ASC
    ) AS rn
  FROM post_images
)
DELETE FROM post_images
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

COMMIT;
