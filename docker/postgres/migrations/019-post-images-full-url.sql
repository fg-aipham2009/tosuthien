-- Use full-size post images (drop WordPress -WxH suffix in stored URLs).
UPDATE posts
SET content = regexp_replace(content, '-\d+x\d+(\.(png|jpg|jpeg|webp|gif))', '\1', 'gi')
WHERE content ~* '-\d+x\d+\.(png|jpg|jpeg|webp|gif)';

UPDATE posts
SET cover_image_url = regexp_replace(cover_image_url, '-\d+x\d+(\.(png|jpg|jpeg|webp|gif))', '\1', 'i')
WHERE cover_image_url ~* '-\d+x\d+\.(png|jpg|jpeg|webp|gif)';

UPDATE post_images
SET url = regexp_replace(url, '-\d+x\d+(\.(png|jpg|jpeg|webp|gif))', '\1', 'i')
WHERE url ~* '-\d+x\d+\.(png|jpg|jpeg|webp|gif)';

UPDATE posts
SET content = regexp_replace(content, '\s(width|height)=("|\')[^"\']*("|\')', '', 'gi')
WHERE content ~* '(width|height)=';
