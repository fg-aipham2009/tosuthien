-- Book cover URL for kinh sách (PDF list / text books linked by filename).
ALTER TABLE pdf_files
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT;
