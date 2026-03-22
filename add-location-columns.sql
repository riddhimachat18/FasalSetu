-- ============================================
-- Add Location Columns to users Table
-- ============================================
-- Run this if your users table already exists without location columns

-- Add latitude column
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);

-- Add longitude column
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- Add location accuracy column
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS location_accuracy DECIMAL(10, 2);

-- Add city column
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS city VARCHAR(255);

-- Add state column
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS state VARCHAR(255);

-- Add country column
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS country VARCHAR(255);

-- Add location updated timestamp
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMP WITH TIME ZONE;

-- Create index for location queries (optional, for performance)
CREATE INDEX IF NOT EXISTS idx_users_location ON public.users(latitude, longitude);

-- ============================================
-- Verification
-- ============================================
-- Check if columns were added successfully
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'users'
  AND column_name IN ('latitude', 'longitude', 'city', 'state', 'country', 'location_accuracy', 'location_updated_at')
ORDER BY column_name;

-- Should return 7 rows showing all location columns

-- ============================================
-- Test Update (Optional)
-- ============================================
-- Test updating location for your user
-- Replace with your actual user_id
/*
UPDATE public.users
SET 
  latitude = 28.6139,
  longitude = 77.2090,
  city = 'New Delhi',
  state = 'Delhi',
  country = 'India',
  location_updated_at = NOW()
WHERE id = auth.uid();
*/

-- ============================================
-- Success!
-- ============================================
-- Location columns are now ready to use
-- The app will automatically populate them on next login
