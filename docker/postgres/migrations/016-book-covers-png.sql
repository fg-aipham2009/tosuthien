-- Normalize book cover URLs to .png (files must already be converted on disk).
UPDATE pdf_files
SET cover_image_url = regexp_replace(cover_image_url, '\.(jpg|jpeg|webp|gif)$', '.png', 'i')
WHERE cover_image_url ~* '\.(jpg|jpeg|webp|gif)$';
