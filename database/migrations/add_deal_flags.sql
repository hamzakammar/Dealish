-- Migration: add deal_flags table for deal accuracy reporting
-- Users can thumbs-up / thumbs-down deals at non-partner venues

CREATE TABLE IF NOT EXISTS deal_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('thumbs_up', 'thumbs_down')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (deal_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_deal_flags_deal_id ON deal_flags(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_flags_user_id ON deal_flags(user_id);

-- RLS
ALTER TABLE deal_flags ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert their own flags
CREATE POLICY "Users can insert own deal flags"
  ON deal_flags FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own flags (to restore vote state on re-open)
CREATE POLICY "Users can view own deal flags"
  ON deal_flags FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own flags (switch thumbs_up ↔ thumbs_down)
CREATE POLICY "Users can update own deal flags"
  ON deal_flags FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own flags (un-vote)
CREATE POLICY "Users can delete own deal flags"
  ON deal_flags FOR DELETE
  USING (auth.uid() = user_id);

-- Admins can view all flags
CREATE POLICY "Admins can view all deal flags"
  ON deal_flags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON deal_flags TO authenticated;
