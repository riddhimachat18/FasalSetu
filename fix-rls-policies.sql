-- ============================================
-- Fix RLS Policies for crop_cycles Table
-- ============================================
-- Run this if you're getting 400 Bad Request errors
-- This will reset and recreate all RLS policies

-- 1. Drop all existing policies on crop_cycles
DROP POLICY IF EXISTS "Users can view own crops" ON public.crop_cycles;
DROP POLICY IF EXISTS "Users can insert own crops" ON public.crop_cycles;
DROP POLICY IF EXISTS "Users can update own crops" ON public.crop_cycles;
DROP POLICY IF EXISTS "Users can delete own crops" ON public.crop_cycles;

-- 2. Ensure RLS is enabled
ALTER TABLE public.crop_cycles ENABLE ROW LEVEL SECURITY;

-- 3. Create SELECT policy (for reading/viewing crops)
CREATE POLICY "Users can view own crops"
  ON public.crop_cycles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 4. Create INSERT policy (for adding new crops)
CREATE POLICY "Users can insert own crops"
  ON public.crop_cycles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 5. Create UPDATE policy (for modifying crops)
CREATE POLICY "Users can update own crops"
  ON public.crop_cycles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 6. Create DELETE policy (for removing crops)
CREATE POLICY "Users can delete own crops"
  ON public.crop_cycles
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 7. Grant necessary permissions
GRANT ALL ON public.crop_cycles TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE crop_cycles_id_seq TO authenticated;

-- ============================================
-- Verify the Setup
-- ============================================
-- Run these queries to verify everything is working:

-- Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'crop_cycles';
-- Should return: crop_cycles | true

-- Check existing policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'crop_cycles';
-- Should show 4 policies

-- Check your user_id (run this while logged in)
SELECT auth.uid();
-- Should return your UUID

-- Test SELECT (should work if you're authenticated)
SELECT * FROM public.crop_cycles;
-- Should return your crops or empty array (not an error)

-- ============================================
-- Troubleshooting
-- ============================================

-- If you still get errors, check:

-- 1. Are you authenticated?
SELECT auth.uid();
-- If this returns NULL, you're not logged in

-- 2. Does the table exist?
SELECT * FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'crop_cycles';
-- Should return one row

-- 3. Check table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'crop_cycles'
ORDER BY ordinal_position;
-- Should show all columns including user_id

-- 4. Try inserting a test crop (replace YOUR_USER_ID with your actual UUID)
-- First get your user_id:
SELECT auth.uid();
-- Then insert:
INSERT INTO public.crop_cycles (user_id, crop_name, sowing_date, current_stage)
VALUES (auth.uid(), 'Test Wheat', CURRENT_DATE, 'growth');
-- Should succeed

-- 5. Try selecting again
SELECT * FROM public.crop_cycles WHERE user_id = auth.uid();
-- Should show your test crop

-- ============================================
-- Clean Up Test Data (Optional)
-- ============================================
-- DELETE FROM public.crop_cycles WHERE crop_name = 'Test Wheat';
