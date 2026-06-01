-- Supabase Migration: Summer Allocations (with proper RLS)
-- Run this in the Supabase SQL Editor at https://app.supabase.com/project/hobodbrpeddpnvmpzgff/sql

-- 1. Projects table
CREATE TABLE IF NOT EXISTS projects (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  slots       INT  NOT NULL DEFAULT 1,
  sector      TEXT DEFAULT ''
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Anon users (students) can only SELECT projects (to view options)
DROP POLICY IF EXISTS projects_anon_select ON projects;
CREATE POLICY projects_anon_select ON projects
  FOR SELECT USING (true);

-- Authenticated admin users can INSERT/UPDATE/DELETE projects
DROP POLICY IF EXISTS projects_admin_write ON projects;
CREATE POLICY projects_admin_write ON projects
  FOR ALL
  USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));

-- Seed default projects
INSERT INTO projects (id, name, description, slots, sector) VALUES
  ('p1', 'Centricity-Wealth Management platform', ' ', 3, 'Wealth Management'),
  ('p2', 'Backend API- Modification',           ' ', 6, 'Backend'),
  ('p3', 'SoFI-Website',                        ' ', 2, 'Design'),
  ('p4', 'Merch Design',                        ' ', 3, 'Design'),
  ('p5', 'Client Acquisition+Brochure',         ' ', 2, 'Marketing')
ON CONFLICT (id) DO NOTHING;

-- 2. Applicants table
CREATE TABLE IF NOT EXISTS applicants (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  student_id        TEXT NOT NULL UNIQUE,
  email             TEXT NOT NULL,
  mobile            TEXT NOT NULL,
  leave_days        JSONB DEFAULT '[]'::jsonb,
  contributions     TEXT DEFAULT '',
  pitched_before    BOOLEAN DEFAULT false,
  pitch_notes       TEXT DEFAULT '',
  pitched_sectors   JSONB DEFAULT '[]'::jsonb,
  preferences       JSONB DEFAULT '[]'::jsonb,
  availability_note TEXT DEFAULT '',
  avg_availability  FLOAT DEFAULT 0,
  submitted_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE applicants ENABLE ROW LEVEL SECURITY;

-- Anon users (students) can only INSERT their own application
DROP POLICY IF EXISTS applicants_anon_insert ON applicants;
CREATE POLICY applicants_anon_insert ON applicants
  FOR INSERT WITH CHECK (true);

-- Authenticated admin users can SELECT all applicants
DROP POLICY IF EXISTS applicants_admin_select ON applicants;
CREATE POLICY applicants_admin_select ON applicants
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));

-- No anon SELECT, no anon UPDATE, no anon DELETE allowed on applicants

-- 3. Project allocations table
CREATE TABLE IF NOT EXISTS project_allocations (
  id         BIGSERIAL PRIMARY KEY,
  student_id TEXT NOT NULL UNIQUE REFERENCES applicants(student_id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE
);

ALTER TABLE project_allocations ENABLE ROW LEVEL SECURITY;

-- Only authenticated admin users can read/write allocations
DROP POLICY IF EXISTS allocations_admin_all ON project_allocations;
CREATE POLICY allocations_admin_all ON project_allocations
  FOR ALL
  USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));
