-- Normalize tin tức (posts) image URLs to .png after on-disk conversion.
UPDATE posts
SET cover_image_url = regexp_replace(cover_image_url, '\.(jpg|jpeg|webp|gif)$', '.png', 'i')
WHERE cover_image_url ~* '\.(jpg|jpeg|webp|gif)$';

UPDATE post_images
SET
  url = regexp_replace(url, '\.(jpg|jpeg|webp|gif)$', '.png', 'i'),
  mime_type = 'image/png'
WHERE url ~* '\.(jpg|jpeg|webp|gif)$';

-- Rewrite embedded image URLs inside HTML content.
UPDATE posts
SET content = regexp_replace(
  content,
  '(files/images/posts/[^\"'' >]+)\.(jpg|jpeg|webp|gif)',
  '\1.png',
  'gi'
)
WHERE content ~* 'files/images/posts/.*\.(jpg|jpeg|webp|gif)';
