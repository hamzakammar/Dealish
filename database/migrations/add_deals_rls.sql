-- Enable Row Level Security on deals table
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

-- Policy: Restaurant owners can view their own deals
CREATE POLICY "Restaurant owners can view their deals"
  ON deals
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = deals.restaurant_id
      AND restaurants.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'owner')
    )
  );

-- Policy: Restaurant owners can insert deals for their restaurants
CREATE POLICY "Restaurant owners can insert their deals"
  ON deals
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = deals.restaurant_id
      AND restaurants.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'owner')
    )
  );

-- Policy: Restaurant owners can update their own deals
CREATE POLICY "Restaurant owners can update their deals"
  ON deals
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = deals.restaurant_id
      AND restaurants.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'owner')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = deals.restaurant_id
      AND restaurants.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'owner')
    )
  );

-- Policy: Restaurant owners can delete their own deals
CREATE POLICY "Restaurant owners can delete their deals"
  ON deals
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = deals.restaurant_id
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
GRANT SELECT, INSERT, UPDATE, DELETE ON deals TO authenticated;

-- Also allow public to read active deals (for customer app)
CREATE POLICY "Public can view active deals"
  ON deals
  FOR SELECT
  USING (is_active = true);

GRANT SELECT ON deals TO anon;
