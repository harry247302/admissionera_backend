CREATE TABLE IF NOT EXISTS specialization_content_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specialization_uuid UUID REFERENCES specializations(uuid) ON DELETE CASCADE,
  title VARCHAR(255),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS specialization_content_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES specialization_content_tables(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS specialization_content_paragraphs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specialization_uuid UUID NOT NULL REFERENCES specializations(uuid) ON DELETE CASCADE,
  title VARCHAR(255),
  content TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_spec_content_tables_spec
  ON specialization_content_tables (specialization_uuid);

CREATE INDEX IF NOT EXISTS idx_spec_content_paragraphs_spec
  ON specialization_content_paragraphs (specialization_uuid);
