-- Fix disease_logs table for proper logging
-- Run this in Supabase SQL Editor

-- 1. Check if table exists and view structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'disease_logs'
ORDER BY ordinal_position;

-- 2. If table doesn't exist or is missing columns, create/update it
-- Drop and recreate (WARNING: This will delete existing data!)
-- Comment out if you want to keep existing data
-- DROP TABLE IF EXISTS disease_logs CASCADE;

-- Create table with correct structure
CREATE TABLE IF NOT EXISTS disease_logs (
  disease_log_id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  crop_cycle_id BIGINT REFERENCES crop_cycles(crop_id) ON DELETE SET NULL,
  detection_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  disease_name TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('mild', 'moderate', 'severe', 'unknown')),
  image_s3_url TEXT,
  confidence_score DECIMAL(5,4),
  remedy_suggested TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Enable Row Level Security
ALTER TABLE disease_logs ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies (if any)
DROP POLICY IF EXISTS "Users can view own disease logs" ON disease_logs;
DROP POLICY IF EXISTS "Users can insert own disease logs" ON disease_logs;
DROP POLICY IF EXISTS "Users can update own disease logs" ON disease_logs;
DROP POLICY IF EXISTS "Users can delete own disease logs" ON disease_logs;

-- 5. Create RLS policies
-- Allow users to view their own logs
CREATE POLICY "Users can view own disease logs"
ON disease_logs FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Allow users to insert their own logs
CREATE POLICY "Users can insert own disease logs"
ON disease_logs FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Allow users to update their own logs
CREATE POLICY "Users can update own disease logs"
ON disease_logs FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Allow users to delete their own logs
CREATE POLICY "Users can delete own disease logs"
ON disease_logs FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- 6. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_disease_logs_user_id ON disease_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_disease_logs_crop_cycle_id ON disease_logs(crop_cycle_id);
CREATE INDEX IF NOT EXISTS idx_disease_logs_detection_date ON disease_logs(detection_date DESC);

-- 7. Test insert (replace with your actual user_id)
-- INSERT INTO disease_logs (
--   user_id,
--   disease_name,
--   severity,
--   image_s3_url,
--   confidence_score,
--   remedy_suggested,
--   notes
-- ) VALUES (
--   auth.uid(), -- Your user ID
--   'Test Disease',
--   'moderate',
--   'https://example.com/image.jpg',
--   0.85,
--   'Test remedy',
--   'Test note'
-- );

-- 8. Verify the insert worked
-- SELECT * FROM disease_logs WHERE user_id = auth.uid() ORDER BY detection_date DESC LIMIT 1;

-- 9. Grant permissions (if needed)
GRANT ALL ON disease_logs TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE disease_logs_disease_log_id_seq TO authenticated;

-- Done! Now try uploading an image in the app
