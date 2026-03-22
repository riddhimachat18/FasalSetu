-- Create crop_suggestions table to store AI-generated suggestions
CREATE TABLE IF NOT EXISTS crop_suggestions (
  suggestion_id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Suggestion content
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('seasonal', 'soil', 'market', 'disease', 'fertilizer', 'irrigation', 'general')),
  
  -- Context used to generate suggestion
  crop_context JSONB, -- Stores the farmer context used
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Feedback tracking
  is_helpful BOOLEAN DEFAULT NULL, -- NULL = no feedback, TRUE = helpful, FALSE = not helpful
  feedback_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  ai_model TEXT DEFAULT 'gemini-2.0-flash-exp',
  confidence_score DECIMAL(3,2), -- 0.00 to 1.00
  
  -- Soft delete
  is_active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMP WITH TIME ZONE, -- Suggestions can expire (e.g., seasonal ones)
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_crop_suggestions_user_id ON crop_suggestions(user_id);
CREATE INDEX IF NOT EXISTS idx_crop_suggestions_category ON crop_suggestions(category);
CREATE INDEX IF NOT EXISTS idx_crop_suggestions_active ON crop_suggestions(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_crop_suggestions_generated_at ON crop_suggestions(generated_at DESC);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_crop_suggestions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_crop_suggestions_updated_at
  BEFORE UPDATE ON crop_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION update_crop_suggestions_updated_at();

-- Add RLS (Row Level Security) policies
ALTER TABLE crop_suggestions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own suggestions
CREATE POLICY "Users can view own suggestions"
  ON crop_suggestions FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own suggestions
CREATE POLICY "Users can insert own suggestions"
  ON crop_suggestions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own suggestions (for feedback)
CREATE POLICY "Users can update own suggestions"
  ON crop_suggestions FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own suggestions
CREATE POLICY "Users can delete own suggestions"
  ON crop_suggestions FOR DELETE
  USING (auth.uid() = user_id);

-- Add comments
COMMENT ON TABLE crop_suggestions IS 'Stores AI-generated crop suggestions personalized for each farmer';
COMMENT ON COLUMN crop_suggestions.crop_context IS 'JSON snapshot of farmer context (crops, soil, weather) used to generate suggestion';
COMMENT ON COLUMN crop_suggestions.is_helpful IS 'User feedback: NULL=no feedback, TRUE=helpful, FALSE=not helpful';
COMMENT ON COLUMN crop_suggestions.expires_at IS 'When suggestion becomes outdated (e.g., seasonal suggestions expire after season)';

-- Example: Insert a suggestion
-- INSERT INTO crop_suggestions (user_id, title, description, category, crop_context)
-- VALUES (
--   'user-uuid',
--   'Winter Wheat Planting',
--   'DBW-187 variety recommended for your black soil. Plant before November 15.',
--   'seasonal',
--   '{"soil_type": "black", "current_crops": ["rice"], "location": "Maharashtra"}'::jsonb
-- );

-- Example: Mark suggestion as helpful
-- UPDATE crop_suggestions 
-- SET is_helpful = TRUE, feedback_at = NOW() 
-- WHERE suggestion_id = 1 AND user_id = 'user-uuid';

-- Example: Get active suggestions for user
-- SELECT * FROM crop_suggestions 
-- WHERE user_id = 'user-uuid' 
--   AND is_active = TRUE 
--   AND (expires_at IS NULL OR expires_at > NOW())
-- ORDER BY generated_at DESC;
