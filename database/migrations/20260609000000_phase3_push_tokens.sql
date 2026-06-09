-- ==========================================
-- Phase 3 Push Notifications: user_push_tokens
-- ==========================================

/**
 * user_push_tokens table structure
 *
 * This table stores multiple push tokens per user, allowing 
 * for notifications to be delivered to all of a user's devices.
 */
CREATE TABLE IF NOT EXISTS public.user_push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    push_token TEXT NOT NULL,
    device_name TEXT,
    device_type TEXT, -- 'ios', 'android'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, push_token)
);

-- Index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user_id ON public.user_push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_token ON public.user_push_tokens(push_token);

-- RLS Policies
ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own tokens" 
ON public.user_push_tokens 
FOR ALL 
TO authenticated 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- Updated at trigger
CREATE TRIGGER set_updated_at_user_push_tokens
BEFORE UPDATE ON public.user_push_tokens
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
