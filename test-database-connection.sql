-- ============================================
-- Test Database Connection and RLS Setup
-- ============================================
-- Run these queries one by one to diagnose issues

-- ============================================
-- STEP 1: Check Authentication
-- ============================================
-- This should return your user UUID
-- If it returns NULL, you're not logged in
SELECT auth.uid() as my_user_id;

-- ============================================
-- STEP 2: Check if crop_cycles table exists
-- ============================================
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public' 
  AND table_name = 'crop_cycles';
-- Should return 1 row

-- ============================================
-- STEP 3: Check table structure
-- ============================================
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'crop_cycles'
ORDER BY ordinal_position;
-- Should show all 11 columns including user_id

-- ============================================
-- STEP 4: Check if RLS is enabled
-- ============================================
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'crop_cycles';
-- rls_enabled should be TRUE

-- ============================================
-- STEP 5: Check RLS policies
-- ============================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd as command,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE tablename = 'crop_cycles'
ORDER BY cmd;
-- Should show 4 policies (DELETE, INSERT, SELECT, UPDATE)
-- All should have roles = {authenticated}

-- ============================================
-- STEP 6: Check permissions
-- ============================================
SELECT 
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' 
  AND table_name = 'crop_cycles'
  AND grantee = 'authenticated';
-- Should show multiple privileges (SELECT, INSERT, UPDATE, DELETE, etc.)

-- ============================================
-- STEP 7: Test SELECT (should work if authenticated)
-- ============================================
SELECT * FROM public.crop_cycles;
-- Should return empty array [] or your crops
-- Should NOT return an error

-- ============================================
-- STEP 8: Test INSERT (only if authenticated)
-- ============================================
-- This will add a test crop
INSERT INTO public.crop_cycles (
  user_id,
  crop_name,
  sowing_date,
  current_stage,
  is_active
)
VALUES (
  auth.uid(),
  'Test Wheat',
  CURRENT_DATE,
  'growth',
  true
)
RETURNING *;
-- Should return the inserted row

-- ============================================
-- STEP 9: Verify the insert worked
-- ============================================
SELECT 
  id,
  crop_name,
  sowing_date,
  current_stage,
  user_id,
  created_at
FROM public.crop_cycles
WHERE crop_name = 'Test Wheat';
-- Should show your test crop

-- ============================================
-- STEP 10: Test UPDATE
-- ============================================
UPDATE public.crop_cycles
SET current_stage = 'flowering'
WHERE crop_name = 'Test Wheat'
  AND user_id = auth.uid()
RETURNING *;
-- Should return the updated row

-- ============================================
-- STEP 11: Test DELETE
-- ============================================
DELETE FROM public.crop_cycles
WHERE crop_name = 'Test Wheat'
  AND user_id = auth.uid()
RETURNING *;
-- Should return the deleted row

-- ============================================
-- STEP 12: Verify cleanup
-- ============================================
SELECT COUNT(*) as test_crops_remaining
FROM public.crop_cycles
WHERE crop_name = 'Test Wheat';
-- Should return 0

-- ============================================
-- DIAGNOSTIC SUMMARY
-- ============================================
-- Run this to get a complete overview
SELECT 
  'Authentication' as check_type,
  CASE 
    WHEN auth.uid() IS NOT NULL THEN '✅ Authenticated'
    ELSE '❌ Not authenticated'
  END as status
UNION ALL
SELECT 
  'Table Exists',
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'crop_cycles'
    ) THEN '✅ Table exists'
    ELSE '❌ Table missing'
  END
UNION ALL
SELECT 
  'RLS Enabled',
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_tables 
      WHERE schemaname = 'public' 
        AND tablename = 'crop_cycles' 
        AND rowsecurity = true
    ) THEN '✅ RLS enabled'
    ELSE '❌ RLS disabled'
  END
UNION ALL
SELECT 
  'Policies Count',
  CASE 
    WHEN (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'crop_cycles') = 4 
    THEN '✅ All 4 policies exist'
    ELSE '❌ Missing policies: ' || (4 - (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'crop_cycles'))::text
  END
UNION ALL
SELECT 
  'Permissions',
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.role_table_grants
      WHERE table_schema = 'public' 
        AND table_name = 'crop_cycles'
        AND grantee = 'authenticated'
    ) THEN '✅ Permissions granted'
    ELSE '❌ Missing permissions'
  END;

-- ============================================
-- EXPECTED RESULTS
-- ============================================
-- All checks should show ✅
-- If any show ❌, run the fix-rls-policies.sql script
