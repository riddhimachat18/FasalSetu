-- Add manual status columns to crop_cycles table
-- This allows farmers to manually update crop health status via chatbot

ALTER TABLE crop_cycles
ADD COLUMN IF NOT EXISTS manual_status TEXT CHECK (manual_status IN ('healthy', 'attention', 'critical')),
ADD COLUMN IF NOT EXISTS manual_status_updated_at TIMESTAMP WITH TIME ZONE;

-- Add comment to explain the columns
COMMENT ON COLUMN crop_cycles.manual_status IS 'Manual status override set by farmer (healthy/attention/critical). Takes precedence over automatic disease-based status for 7 days.';
COMMENT ON COLUMN crop_cycles.manual_status_updated_at IS 'Timestamp when manual status was last updated';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_crop_cycles_manual_status ON crop_cycles(manual_status, manual_status_updated_at);

-- Example: Update a crop status manually
-- UPDATE crop_cycles 
-- SET manual_status = 'healthy', 
--     manual_status_updated_at = NOW() 
-- WHERE crop_id = 1 AND user_id = 'user-uuid';
