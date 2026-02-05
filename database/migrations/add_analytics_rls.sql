-- Enable Row Level Security on qr_code_scans table
ALTER TABLE qr_code_scans ENABLE ROW LEVEL SECURITY;

-- Policy: Restaurant owners/admins can view scans for their restaurants or all scans
CREATE POLICY "Restaurant owners and admins can view scans"
  ON qr_code_scans
  FOR SELECT
  USING (
    -- Restaurant owners can view scans for their restaurants
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = qr_code_scans.restaurant_id
      AND restaurants.owner_id = auth.uid()
    )
    OR
    -- Admins/owners can view all scans
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'owner')
    )
  );

-- Policy: Users can insert their own scans
CREATE POLICY "Users can insert their own scans"
  ON qr_code_scans
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Grant necessary permissions
GRANT SELECT ON qr_code_scans TO authenticated;
GRANT INSERT ON qr_code_scans TO authenticated;
