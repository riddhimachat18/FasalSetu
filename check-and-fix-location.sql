-- ============================================
-- Check and Fix Location Data
-- ============================================

-- Step 1: Check if location columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'users'
  AND column_name IN ('latitude', 'longitude', 'city', 'state', 'country')
ORDER BY column_name;

-- Should return 5 rows. If not, run add-location-columns.sql first

-- Step 2: Check your current location data
SELECT 
  id,
  phone,
  latitude,
  longitude,
  city,
  state,
  country,
  location_updated_at
FROM public.users
WHERE id = auth.uid();

-- Step 3: If location is NULL, manually set it (use your actual coordinates)
-- Replace with coordinates from console: "✅ Geolocation success: {lat: '28.5108', lon: '77.0637'}"

UPDATE public.users
SET 
  latitude = 28.5108,      -- Your latitude from console
  longitude = 77.0637,     -- Your longitude from console
  city = 'Gurgaon',        -- Your city from console
  state = 'Haryana',       -- Your state
  country = 'India',       -- Your country
  location_updated_at = NOW()
WHERE id = auth.uid();

-- Step 4: Verify the update
SELECT 
  latitude,
  longitude,
  city,
  state,
  country,
  location_updated_at
FROM public.users
WHERE id = auth.uid();

-- Should now show your location data

-- Step 5: Test weather API (optional)
-- This will show if weather API is working
-- Replace coordinates with yours
/*
SELECT 
  'https://api.weatherapi.com/v1/forecast.json?key=d59e0fece23b490994e65944250511&q=28.5108,77.0637&days=3&aqi=no' as weather_api_url;
*/

-- ============================================
-- Troubleshooting
-- ============================================

-- If columns don't exist, run this first:
/*
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS city VARCHAR(255);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS state VARCHAR(255);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS country VARCHAR(255);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMP WITH TIME ZONE;
*/

-- If update fails, check RLS policies:
/*
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'users';
*/

-- Should show UPDATE policy for users table
