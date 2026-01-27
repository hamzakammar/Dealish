-- Add settings column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';

-- Add index for settings queries (if needed for future queries)
CREATE INDEX IF NOT EXISTS idx_profiles_settings ON profiles USING GIN (settings);
