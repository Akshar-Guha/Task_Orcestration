-- Migration: Create task_reviews table and RLS policies
-- Created At: 2026-06-13

CREATE TABLE IF NOT EXISTS public.task_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  task_title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('completed', 'blocked', 'skipped')),
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.task_reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'task_reviews' AND policyname = 'Users can manage their own task reviews'
  ) THEN
    CREATE POLICY "Users can manage their own task reviews" ON public.task_reviews
      FOR ALL USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'task_reviews' AND policyname = 'Fallback user can manage task reviews'
  ) THEN
    CREATE POLICY "Fallback user can manage task reviews" ON public.task_reviews
      FOR ALL USING (user_id = '2c32a446-1bbc-4294-8a29-3e4fef5649e6'::uuid);
  END IF;
END $$;
