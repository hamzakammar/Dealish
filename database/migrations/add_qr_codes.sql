-- Add QR code fields to deals table
ALTER TABLE deals 
ADD COLUMN IF NOT EXISTS qr_code_token TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS qr_code_generated_at TIMESTAMP;

-- Create index on qr_code_token for faster lookups
CREATE INDEX IF NOT EXISTS idx_deals_qr_code_token ON deals(qr_code_token);

-- Create QR code scans table for tracking scans and analytics
CREATE TABLE IF NOT EXISTS qr_code_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  scanned_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_qr_scans_deal_id ON qr_code_scans(deal_id);
CREATE INDEX IF NOT EXISTS idx_qr_scans_restaurant_id ON qr_code_scans(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_qr_scans_user_id ON qr_code_scans(user_id);
CREATE INDEX IF NOT EXISTS idx_qr_scans_scanned_at ON qr_code_scans(scanned_at);
