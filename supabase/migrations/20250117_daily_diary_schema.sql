-- ============================================================
-- DAILY DIARY SCHEMA MIGRATION
-- Part of: Refined Lifetime Goal Tracking System
-- Tables: daily_entries, questions, question_answers, images, productivity_categories
-- ============================================================

-- ============================================================
-- 1. NEW TABLES
-- ============================================================

-- 1.1 daily_entries (Main daily record)
CREATE TABLE IF NOT EXISTS daily_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  
  -- Core metrics
  mood INTEGER CHECK (mood BETWEEN 1 AND 5),
  energy_level INTEGER CHECK (energy_level BETWEEN 1 AND 10),
  
  -- Free-form reflection
  summary TEXT,
  wins TEXT[],
  challenges TEXT[],
  
  -- Flexible structured data
  productivity_data JSONB DEFAULT '{}'::jsonb,
  custom_fields JSONB DEFAULT '{}'::jsonb,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(date, user_id)
);

-- 1.2 questions (Question Bank)
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  is_adaptive BOOLEAN DEFAULT FALSE,
  adaptive_rule JSONB DEFAULT '{}'::jsonb,
  display_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.3 question_answers (Q&A History)
CREATE TABLE IF NOT EXISTS question_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES daily_entries(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  answer TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(entry_id, question_id)
);

-- 1.4 images (Photo Attachments)
CREATE TABLE IF NOT EXISTS images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES daily_entries(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  original_filename TEXT,
  mime_type TEXT,
  size_bytes INTEGER,
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.5 productivity_categories (Reference Table)
CREATE TABLE IF NOT EXISTS productivity_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#888888',
  icon TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. MODIFY EXISTING TABLES
-- ============================================================

-- 2.1 goals: Add entry reference and progress tracking
ALTER TABLE goals ADD COLUMN IF NOT EXISTS last_entry_id UUID REFERENCES daily_entries(id) ON DELETE SET NULL;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS progress_data JSONB DEFAULT '{}'::jsonb;

-- 2.2 tasks: Add entry reference for completed tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_entry_id UUID REFERENCES daily_entries(id) ON DELETE SET NULL;

-- ============================================================
-- 3. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_daily_entries_user_date ON daily_entries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_entries_created ON daily_entries(created_at);
CREATE INDEX IF NOT EXISTS idx_questions_user ON questions(user_id);
CREATE INDEX IF NOT EXISTS idx_questions_active ON questions(active, display_order);
CREATE INDEX IF NOT EXISTS idx_question_answers_entry ON question_answers(entry_id);
CREATE INDEX IF NOT EXISTS idx_question_answers_question ON question_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_images_entry ON images(entry_id);

-- ============================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE daily_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE images ENABLE ROW LEVEL SECURITY;
ALTER TABLE productivity_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies for daily_entries
CREATE POLICY "Users can manage their own daily entries" ON daily_entries
  FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for questions (own + system questions where user_id IS NULL)
CREATE POLICY "Users can view system and own questions" ON questions
  FOR SELECT USING (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "Users can manage their own questions" ON questions
  FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for question_answers (via entry ownership)
CREATE POLICY "Users can manage answers for their entries" ON question_answers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM daily_entries de WHERE de.id = question_answers.entry_id AND de.user_id = auth.uid()
    )
  );

-- RLS Policies for images (via entry ownership)
CREATE POLICY "Users can manage images for their entries" ON images
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM daily_entries de WHERE de.id = images.entry_id AND de.user_id = auth.uid()
    )
  );

-- RLS Policies for productivity_categories (read-only for all, write for future admin)
CREATE POLICY "Anyone can read productivity categories" ON productivity_categories
  FOR SELECT USING (true);

-- ============================================================
-- 5. SEED DATA
-- ============================================================

INSERT INTO productivity_categories (name, color, icon, is_default) VALUES
  ('deep_work', '#22c55e', '💻', TRUE),
  ('shallow_work', '#eab308', '📧', TRUE),
  ('meetings', '#3b82f6', '👥', TRUE),
  ('exercise', '#ef4444', '🏃', TRUE),
  ('leisure', '#a855f7', '🎮', TRUE),
  ('waste', '#6b7280', '📱', FALSE)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- 6. SYSTEM QUESTIONS (Seed)
-- ============================================================

INSERT INTO questions (user_id, question_text, category, is_adaptive, display_order, active) VALUES
  (NULL, 'What was the highlight of your day?', 'reflection', FALSE, 1, TRUE),
  (NULL, 'What challenged you today?', 'challenges', FALSE, 2, TRUE),
  (NULL, 'What are you grateful for?', 'gratitude', FALSE, 3, TRUE),
  (NULL, 'What is your top priority for tomorrow?', 'planning', FALSE, 4, TRUE),
  (NULL, 'How did you take care of your health today?', 'habits', FALSE, 5, TRUE)
ON CONFLICT DO NOTHING;
