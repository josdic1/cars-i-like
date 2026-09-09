BEGIN;

-- Refuse to discard any existing image references.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM cars
    WHERE image_path IS NOT NULL
  ) THEN
    RAISE EXCEPTION
      'Migration stopped: existing image_path values must be migrated first';
  END IF;
END;
$$;

CREATE TABLE car_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id UUID NOT NULL UNIQUE
    REFERENCES cars(id) ON DELETE CASCADE,
  image_data BYTEA NOT NULL
    CHECK (octet_length(image_data) BETWEEN 1 AND 10485760),
  mime_type TEXT NOT NULL DEFAULT 'image/webp'
    CHECK (mime_type = 'image/webp'),
  width INTEGER NOT NULL CHECK (width BETWEEN 1 AND 2000),
  height INTEGER NOT NULL CHECK (height BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER car_images_updated_at
BEFORE UPDATE ON car_images
FOR EACH ROW
EXECUTE FUNCTION touch_cars_updated_at();

ALTER TABLE cars
DROP COLUMN image_path;

COMMIT;
