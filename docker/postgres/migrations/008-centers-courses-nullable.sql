-- Allow incomplete center/course rows (fill in later from admin)

ALTER TABLE centers
  ALTER COLUMN address DROP NOT NULL,
  ALTER COLUMN region DROP NOT NULL,
  ALTER COLUMN region DROP DEFAULT,
  ALTER COLUMN country_code DROP DEFAULT;

ALTER TABLE courses
  ALTER COLUMN type DROP NOT NULL,
  ALTER COLUMN type DROP DEFAULT,
  ALTER COLUMN recurrence DROP NOT NULL,
  ALTER COLUMN recurrence DROP DEFAULT;
