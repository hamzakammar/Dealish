-- Add discount fields to deals table for savings tracking
-- discount_type: 'percent' (e.g., 20% off), 'fixed' (e.g., $5 off), 'bogo' (buy one get one)
-- discount_value: the numeric value (percentage for percent type, dollar amount for fixed)
-- original_price: the original menu price (used to calculate exact savings for percent discounts)

ALTER TABLE deals ADD COLUMN IF NOT EXISTS discount_type TEXT CHECK (discount_type IN ('percent', 'fixed', 'bogo'));
ALTER TABLE deals ADD COLUMN IF NOT EXISTS discount_value NUMERIC;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS original_price NUMERIC;

-- Add comment for documentation
COMMENT ON COLUMN deals.discount_type IS 'Type of discount: percent, fixed dollar amount, or buy-one-get-one';
COMMENT ON COLUMN deals.discount_value IS 'Numeric discount value: percentage (0-100) for percent type, dollar amount for fixed type';
COMMENT ON COLUMN deals.original_price IS 'Original menu price before discount, used for savings calculation';
