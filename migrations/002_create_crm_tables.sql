-- Extend user roles for CRM
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('user', 'admin', 'super_admin', 'manager', 'counselor', 'sales'));

-- Counselors profile (extends users)
CREATE TABLE IF NOT EXISTS counselors (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  phone VARCHAR(20),
  specialization TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  lead_code VARCHAR(20) NOT NULL UNIQUE,
  full_name VARCHAR(150) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  whatsapp_number VARCHAR(20),
  date_of_birth DATE,
  gender VARCHAR(20),
  city VARCHAR(100),
  state VARCHAR(100),
  course VARCHAR(150),
  university VARCHAR(150),
  specialization VARCHAR(150),
  academic_qualification VARCHAR(100),
  passing_year INTEGER,
  percentage_cgpa VARCHAR(20),
  preferred_location VARCHAR(150),
  budget DECIMAL(12, 2),
  lead_source VARCHAR(50) NOT NULL DEFAULT 'OTHER',
  lead_campaign VARCHAR(150),
  assigned_counselor_id INTEGER REFERENCES counselors(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'NEW',
  priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
  last_contact_at TIMESTAMPTZ,
  next_followup_at TIMESTAMPTZ,
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_status ON leads (status);
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads (lead_source);
CREATE INDEX IF NOT EXISTS idx_leads_counselor ON leads (assigned_counselor_id);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads (created_at);

CREATE TABLE IF NOT EXISTS lead_notes (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lead_activities (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  performed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_activities_lead ON lead_activities (lead_id);

CREATE TABLE IF NOT EXISTS followups (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  counselor_id INTEGER REFERENCES counselors(id) ON DELETE SET NULL,
  followup_date DATE NOT NULL,
  followup_time TIME,
  followup_type VARCHAR(50) NOT NULL DEFAULT 'CALL',
  priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
  notes TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_followups_date ON followups (followup_date);
CREATE INDEX IF NOT EXISTS idx_followups_status ON followups (status);

CREATE TABLE IF NOT EXISTS crm_tasks (
  id SERIAL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  due_date DATE,
  priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  description TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS applications (
  id SERIAL PRIMARY KEY,
  application_code VARCHAR(20) NOT NULL UNIQUE,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  university VARCHAR(150),
  course VARCHAR(150),
  specialization VARCHAR(150),
  status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
  application_date DATE,
  documents_status VARCHAR(50) DEFAULT 'PENDING',
  payment_status VARCHAR(50) DEFAULT 'PENDING',
  assigned_counselor_id INTEGER REFERENCES counselors(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admissions (
  id SERIAL PRIMARY KEY,
  admission_code VARCHAR(20) NOT NULL UNIQUE,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  application_id INTEGER REFERENCES applications(id) ON DELETE SET NULL,
  university VARCHAR(150),
  course VARCHAR(150),
  admission_date DATE,
  revenue DECIMAL(12, 2) DEFAULT 0,
  counselor_id INTEGER REFERENCES counselors(id) ON DELETE SET NULL,
  admission_source VARCHAR(50),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_applications_lead ON applications (lead_id);
CREATE INDEX IF NOT EXISTS idx_admissions_lead ON admissions (lead_id);
