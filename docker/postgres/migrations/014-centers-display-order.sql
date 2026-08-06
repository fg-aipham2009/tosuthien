-- Rename centers.sort_order → display_order (thứ tự hiển thị trên web / admin).
-- Safe to re-run.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'centers' AND column_name = 'sort_order'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'centers' AND column_name = 'display_order'
  ) THEN
    ALTER TABLE public.centers RENAME COLUMN sort_order TO display_order;
  END IF;
END $$;

DROP INDEX IF EXISTS public.idx_centers_sort;
CREATE INDEX IF NOT EXISTS idx_centers_display_order ON public.centers USING btree (display_order);

COMMENT ON COLUMN public.centers.display_order IS 'displayOrder — thứ tự hiển thị danh sách thiền đường';
