CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  student_id VARCHAR(50) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT users_student_id_required CHECK (
    role = 'admin' OR (student_id IS NOT NULL AND LENGTH(TRIM(student_id)) > 0)
  )
);

CREATE TABLE IF NOT EXISTS courses (
  id SERIAL PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  title VARCHAR(160) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  semester VARCHAR(60) NOT NULL DEFAULT 'Fall 2026',
  accent_color VARCHAR(30) NOT NULL DEFAULT 'indigo',
  professor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS course_enrollments (
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (course_id, student_id)
);

CREATE TABLE IF NOT EXISTS groups (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS group_members (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_in_group VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role_in_group IN ('leader', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS assignments (
  id SERIAL PRIMARY KEY,
  course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  due_date TIMESTAMPTZ NOT NULL,
  onedrive_link TEXT NOT NULL,
  target_type VARCHAR(30) NOT NULL DEFAULT 'all' CHECK (target_type IN ('all', 'specific_groups')),
  submission_type VARCHAR(20) NOT NULL DEFAULT 'group',
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotent column upgrades for existing Round 1 databases
ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE;

ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS submission_type VARCHAR(20) NOT NULL DEFAULT 'group';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'assignments_submission_type_check'
      AND conrelid = 'assignments'::regclass
  ) THEN
    ALTER TABLE assignments
      ADD CONSTRAINT assignments_submission_type_check
      CHECK (submission_type IN ('individual', 'group'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS assignment_targets (
  id SERIAL PRIMARY KEY,
  assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  UNIQUE (assignment_id, group_id)
);

CREATE TABLE IF NOT EXISTS submissions (
  id SERIAL PRIMARY KEY,
  assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
  confirmed_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  confirmation_note TEXT NOT NULL DEFAULT '',
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_submissions_assignment_group
  ON submissions (assignment_id, group_id)
  WHERE group_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_submissions_assignment_individual
  ON submissions (assignment_id, confirmed_by)
  WHERE group_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique_lower
  ON users (LOWER(email));

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_student_id_unique_lower
  ON users (LOWER(student_id))
  WHERE student_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_courses_code_unique_lower
  ON courses (LOWER(code));

CREATE INDEX IF NOT EXISTS idx_courses_professor_id ON courses (professor_id);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_student_id ON course_enrollments (student_id);
CREATE INDEX IF NOT EXISTS idx_assignments_course_id ON assignments (course_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON group_members (user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members (group_id);
CREATE INDEX IF NOT EXISTS idx_assignment_targets_group_id ON assignment_targets (group_id);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment_id ON submissions (assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_group_id ON submissions (group_id);
