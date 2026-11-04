ALTER TABLE IF EXISTS specialization_content_tables
  ADD COLUMN IF NOT EXISTS course_id UUID,
  ADD COLUMN IF NOT EXISTS counsellor_id UUID,
  ADD COLUMN IF NOT EXISTS blog_id UUID;

ALTER TABLE IF EXISTS specialization_content_paragraphs
  ADD COLUMN IF NOT EXISTS course_id UUID,
  ADD COLUMN IF NOT EXISTS counsellor_id UUID,
  ADD COLUMN IF NOT EXISTS blog_id UUID;

ALTER TABLE IF EXISTS specialization_content_rows
  ADD COLUMN IF NOT EXISTS counsellor_id UUID;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'specialization_content_paragraphs'
      AND column_name = 'specialization_uuid'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE specialization_content_paragraphs
      ALTER COLUMN specialization_uuid DROP NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'blogs'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'specialization_content_tables_blog_id_fkey'
    ) THEN
      ALTER TABLE specialization_content_tables
        ADD CONSTRAINT specialization_content_tables_blog_id_fkey
        FOREIGN KEY (blog_id) REFERENCES blogs(uuid) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'counsellors'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'specialization_content_tables_counsellor_id_fkey'
    ) THEN
      ALTER TABLE specialization_content_tables
        ADD CONSTRAINT specialization_content_tables_counsellor_id_fkey
        FOREIGN KEY (counsellor_id) REFERENCES counsellors(uuid) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'fk_specialization_content_paragraphs_counsellor'
    ) THEN
      ALTER TABLE specialization_content_paragraphs
        ADD CONSTRAINT fk_specialization_content_paragraphs_counsellor
        FOREIGN KEY (counsellor_id) REFERENCES counsellors(uuid);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'specialization_content_rows_counsellor_id_fkey'
    ) THEN
      ALTER TABLE specialization_content_rows
        ADD CONSTRAINT specialization_content_rows_counsellor_id_fkey
        FOREIGN KEY (counsellor_id) REFERENCES counsellors(uuid) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_spec_content_tables_course
  ON specialization_content_tables (course_id);

CREATE INDEX IF NOT EXISTS idx_spec_content_tables_blog
  ON specialization_content_tables (blog_id);

CREATE INDEX IF NOT EXISTS idx_spec_content_paragraphs_blog
  ON specialization_content_paragraphs (blog_id);
