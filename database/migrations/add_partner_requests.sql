-- Create partner_requests table to track user requests for restaurants to become partners
CREATE TABLE IF NOT EXISTS partner_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  UNIQUE(restaurant_id, user_id) -- Prevent duplicate requests from same user for same restaurant
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_partner_requests_restaurant ON partner_requests(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_partner_requests_user ON partner_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_partner_requests_status ON partner_requests(status);

-- Enable Row Level Security
ALTER TABLE partner_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own partner requests
CREATE POLICY "Users can insert their own partner requests"
  ON partner_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can view their own partner requests
CREATE POLICY "Users can view their own partner requests"
  ON partner_requests
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Restaurant owners and admins can view all partner requests for their restaurants
CREATE POLICY "Restaurant owners and admins can view partner requests"
  ON partner_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = partner_requests.restaurant_id
      AND restaurants.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'owner')
    )
  );

-- Grant necessary permissions
GRANT SELECT, INSERT ON partner_requests TO authenticated;
GRANT SELECT ON partner_requests TO anon;
