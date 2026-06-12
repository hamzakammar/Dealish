-- ============================================================================
-- Square POS Integration
-- Stores OAuth tokens, synced catalog items, and order-level transaction data
-- tied to Dealish deal redemptions.
-- ============================================================================

-- 1) Square OAuth tokens (mirrors google_oauth_tokens pattern)
CREATE TABLE IF NOT EXISTS public.square_oauth_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    merchant_id TEXT NOT NULL,
    location_ids TEXT[] DEFAULT '{}',
    access_token_id UUID,       -- Vault reference
    refresh_token_id UUID,      -- Vault reference
    token_expiry TIMESTAMPTZ,
    scopes TEXT[],
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, restaurant_id)
);

ALTER TABLE public.square_oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own square tokens"
  ON public.square_oauth_tokens FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2) Square catalog items (synced menu items + prices from POS)
CREATE TABLE IF NOT EXISTS public.square_catalog_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    square_item_id TEXT NOT NULL,
    square_variation_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    price_cents INTEGER,
    currency TEXT DEFAULT 'CAD',
    in_stock BOOLEAN DEFAULT true,
    synced_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(restaurant_id, square_item_id, square_variation_id)
);

ALTER TABLE public.square_catalog_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurant managers can view square catalog"
  ON public.square_catalog_items FOR SELECT TO authenticated
  USING (public.is_restaurant_manager(restaurant_id) OR public.is_platform_operator());

CREATE POLICY "Service role manages square catalog"
  ON public.square_catalog_items FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3) Square orders linked to Dealish redemptions
CREATE TABLE IF NOT EXISTS public.square_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    square_order_id TEXT NOT NULL,
    square_location_id TEXT,
    deal_id UUID REFERENCES public.deals(id),
    redemption_scan_id UUID REFERENCES public.qr_code_scans(id),
    total_cents INTEGER,
    discount_cents INTEGER,
    net_cents INTEGER,
    item_count INTEGER,
    line_items JSONB DEFAULT '[]',
    customer_id UUID REFERENCES auth.users(id),
    order_created_at TIMESTAMPTZ,
    synced_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(restaurant_id, square_order_id)
);

ALTER TABLE public.square_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurant managers can view square orders"
  ON public.square_orders FOR SELECT TO authenticated
  USING (public.is_restaurant_manager(restaurant_id) OR public.is_platform_operator());

CREATE POLICY "Service role manages square orders"
  ON public.square_orders FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4) Index for matching redemptions to orders
CREATE INDEX IF NOT EXISTS idx_square_orders_restaurant_deal
  ON public.square_orders(restaurant_id, deal_id);
CREATE INDEX IF NOT EXISTS idx_square_orders_created
  ON public.square_orders(restaurant_id, order_created_at DESC);

-- 5) Triggers
CREATE TRIGGER set_updated_at_square_oauth
  BEFORE UPDATE ON public.square_oauth_tokens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

NOTIFY pgrst, 'reload schema';
