-- ============================================
-- Simple Fix for 400 Bad Request Error
-- ============================================
-- This script fixes RLS policies for your existing crop_cycles table
-- Run this in Supabase SQL Editor

-- 1. Drop all existing policies
DROP POLICY IF EXISTS "Users can view own crops" ON public.crop_cycles;
DROP POLICY IF EXISTS "Users can insert own crops" ON public.crop_cycles;
DROP POLICY IF EXISTS "Users can update own crops" ON public.crop_cycles;
DROP POLICY IF EXISTS "Users can delete own crops" ON public.crop_cycles;

-- 2. Enable RLS (if not already enabled)
ALTER TABLE public.crop_cycles ENABLE ROW LEVEL SECURITY;

-- 3. Create SELECT policy - allows users to view their own crops
CREATE POLICY "Users can view own crops"
  ON public.crop_cycles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 4. Create INSERT policy - allows users to add their own crops
CREATE POLICY "Users can insert own crops"
  ON public.crop_cycles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 5. Create UPDATE policy - allows users to update their own crops
CREATE POLICY "Users can update own crops"
  ON public.crop_cycles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 6. Create DELETE policy - allows users to delete their own crops
CREATE POLICY "Users can delete own crops"
  ON public.crop_cycles
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 7. Grant permissions to authenticated users
GRANT ALL ON public.crop_cycles TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE crop_cycles_id_seq TO authenticated;

-- ============================================
-- Verification
-- ============================================
-- Run these to verify the fix worked:

-- Check if you're authenticated (should return your UUID)
SELECT auth.uid();

-- Check if policies exist (should return 4 rows)
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'crop_cycles';

-- Test SELECT (should return [] or your crops, NOT an error)
SELECT * FROM public.crop_cycles;

-- ============================================
-- Success!
-- ============================================
-- If all queries above work, the fix is complete.
-- Go back to your app and refresh the page.
