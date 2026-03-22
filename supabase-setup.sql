-- ============================================
-- FasalSetu Supabase Setup
-- ============================================
-- This file contains SQL commands to set up your Supabase database
-- Run these commands in your Supabase SQL Editor

-- 1. Create public.users table (if not exists)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone VARCHAR(15) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Add any additional farmer-specific fields here
  name VARCHAR(255),
  location VARCHAR(255),
  farm_size DECIMAL(10, 2),
  preferred_language VARCHAR(10) DEFAULT 'en',
  -- Geolocation fields
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  location_accuracy DECIMAL(10, 2),
  city VARCHAR(255),
  state VARCHAR(255),
  country VARCHAR(255),
  location_updated_at TIMESTAMP WITH TIME ZONE
);

-- 2. Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies
-- Users can read their own data
CREATE POLICY "Users can view own profile"
  ON public.users
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own data
CREATE POLICY "Users can update own profile"
  ON public.users
  FOR UPDATE
  USING (auth.uid() = id);

-- 4. Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, phone, created_at)
  VALUES (
    NEW.id,
    NEW.phone,
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create trigger to automatically create user profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 6. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.users TO anon, authenticated;

-- ============================================
-- Phone Authentication Setup Instructions
-- ============================================
-- 1. Go to Supabase Dashboard > Authentication > Providers
-- 2. Enable "Phone" provider
-- 3. Configure your SMS provider (Twilio, MessageBird, Vonage, etc.)
-- 4. Add your Twilio credentials:
--    - Account SID: AC70c221f2b239d9b5b5256eaad871cb9d
--    - Auth Token: 0449555125d24e4b8a33dc9085705888
-- 5. Set your Twilio phone number
-- 6. Save the configuration

-- ============================================
-- Crop Cycles Table Setup
-- ============================================

-- 1. Create crop_cycles table (matching your existing schema)
CREATE TABLE IF NOT EXISTS public.crop_cycles (
  id BIGSERIAL PRIMARY KEY,
  crop_name TEXT NOT NULL,
  sowing_date DATE NOT NULL,
  expected_harvest_date DATE,
  current_stage TEXT NOT NULL DEFAULT 'growth',
  predicted_yield NUMERIC,
  is_active BOOLEAN DEFAULT true,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 2. Enable RLS on crop_cycles
ALTER TABLE public.crop_cycles ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own crops" ON public.crop_cycles;
DROP POLICY IF EXISTS "Users can insert own crops" ON public.crop_cycles;
DROP POLICY IF EXISTS "Users can update own crops" ON public.crop_cycles;
DROP POLICY IF EXISTS "Users can delete own crops" ON public.crop_cycles;

-- 4. Create RLS Policies for crop_cycles
-- Users can view their own crops
CREATE POLICY "Users can view own crops"
  ON public.crop_cycles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own crops
CREATE POLICY "Users can insert own crops"
  ON public.crop_cycles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own crops
CREATE POLICY "Users can update own crops"
  ON public.crop_cycles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own crops
CREATE POLICY "Users can delete own crops"
  ON public.crop_cycles
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 5. Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_crop_cycles_user_id ON public.crop_cycles(user_id);
CREATE INDEX IF NOT EXISTS idx_crop_cycles_is_active ON public.crop_cycles(is_active);

-- 6. Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_crop_cycles_updated_at ON public.crop_cycles;
CREATE TRIGGER update_crop_cycles_updated_at
  BEFORE UPDATE ON public.crop_cycles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 8. Grant permissions
GRANT ALL ON public.crop_cycles TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE crop_cycles_id_seq TO authenticated;

-- ============================================
-- Farm Soil Data Table Setup
-- ============================================

-- 1. Create farm_soil_data table
CREATE TABLE IF NOT EXISTS public.farm_soil_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  latitude FLOAT8 NOT NULL,
  longitude FLOAT8 NOT NULL,
  ph_level NUMERIC,
  total_nitrogen NUMERIC,
  organic_carbon NUMERIC,
  cec NUMERIC,
  clay_pct NUMERIC,
  sand_pct NUMERIC,
  silt_pct NUMERIC,
  bulk_density NUMERIC,
  soil_type_name TEXT,
  sample_depth TEXT NOT NULL DEFAULT '0-5cm',
  data_source TEXT DEFAULT 'SoilGrids API',
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS on farm_soil_data
ALTER TABLE public.farm_soil_data ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own soil data" ON public.farm_soil_data;
DROP POLICY IF EXISTS "Users can insert own soil data" ON public.farm_soil_data;
DROP POLICY IF EXISTS "Users can update own soil data" ON public.farm_soil_data;
DROP POLICY IF EXISTS "Users can delete own soil data" ON public.farm_soil_data;

-- 4. Create RLS Policies for farm_soil_data
CREATE POLICY "Users can view own soil data"
  ON public.farm_soil_data
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own soil data"
  ON public.farm_soil_data
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own soil data"
  ON public.farm_soil_data
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own soil data"
  ON public.farm_soil_data
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 5. Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_farm_soil_data_user_id ON public.farm_soil_data(user_id);
CREATE INDEX IF NOT EXISTS idx_farm_soil_data_recorded_at ON public.farm_soil_data(recorded_at DESC);

-- 6. Grant permissions
GRANT ALL ON public.farm_soil_data TO authenticated;

-- ============================================
-- Testing the Setup
-- ============================================
-- After running this SQL and configuring phone auth:
-- 1. Try logging in with a phone number from your app
-- 2. Check auth.users table for the new user
-- 3. Check public.users table to verify the trigger worked
-- 4. Verify the user can access their own data via RLS policies
-- 5. Add a crop and check crop_cycles table
-- 6. Fetch soil data and check farm_soil_data table
