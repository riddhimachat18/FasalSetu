-- Add missing columns to disease_logs table
-- Run this in Supabase SQL Editor

-- 1. Add severity column
ALTER TABLE disease_logs 
ADD COLUMN IF NOT EXISTS severity TEXT 
CHECK (severity IN ('mild', 'moderate', 'severe', 'unknown'));

-- 2. Add notes column
ALTER TABLE disease_logs 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- 3. Add user_id column (if it doesn't exist)
ALTER TABLE disease_logs 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 4. Verify the columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'disease_logs'
ORDER BY ordinal_position;

-- Done! The table now has all required columns.
