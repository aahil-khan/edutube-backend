-- Add Full-Text Search indexes for better performance
-- Run this migration to optimize PostgreSQL FTS queries

-- Add text search indexes for users (teachers and students)
CREATE INDEX IF NOT EXISTS idx_users_fts ON users USING gin(to_tsvector('english', name || ' ' || email));

-- Add text search indexes for course templates
CREATE INDEX IF NOT EXISTS idx_course_templates_fts ON course_templates USING gin(to_tsvector('english', name || ' ' || course_code || ' ' || COALESCE(description, '')));

-- Add text search indexes for lectures
CREATE INDEX IF NOT EXISTS idx_lectures_fts ON lectures USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')));

-- Add text search indexes for chapters
CREATE INDEX IF NOT EXISTS idx_chapters_fts ON chapters USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- Add partial indexes for active course instances (most common queries)
CREATE INDEX IF NOT EXISTS idx_course_instances_active ON course_instances (is_active) WHERE is_active = true;

-- Add composite indexes for common join patterns
CREATE INDEX IF NOT EXISTS idx_course_instances_teacher_template ON course_instances (teacher_id, course_template_id);
CREATE INDEX IF NOT EXISTS idx_chapters_course_instance ON chapters (course_instance_id, number);
CREATE INDEX IF NOT EXISTS idx_lectures_chapter ON lectures (chapter_id, lecture_number);
CREATE INDEX IF NOT EXISTS idx_enrollments_student_course ON enrollments (student_id, course_instance_id);
CREATE INDEX IF NOT EXISTS idx_watch_history_user_lecture ON watch_history (user_id, lecture_id);

-- Add indexes for frequent filter columns
CREATE INDEX IF NOT EXISTS idx_course_templates_course_code ON course_templates (course_code);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- Add indexes for sorting by date (common sort option)
CREATE INDEX IF NOT EXISTS idx_course_instances_created_at ON course_instances (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lectures_created_at ON lectures (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users (created_at DESC);

-- Add trigram extension for fuzzy matching (if not already enabled)
-- This extension allows for similarity searches
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add trigram indexes for fuzzy search on names and titles
CREATE INDEX IF NOT EXISTS idx_users_name_trgm ON users USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_course_templates_name_trgm ON course_templates USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_course_templates_code_trgm ON course_templates USING gin(course_code gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_lectures_title_trgm ON lectures USING gin(title gin_trgm_ops);

-- Add indexes for lecture tags if they're used frequently
CREATE INDEX IF NOT EXISTS idx_lecture_tags_tag ON lecture_tags (tag);
CREATE INDEX IF NOT EXISTS idx_lecture_tags_lecture_tag ON lecture_tags (lecture_id, tag);
