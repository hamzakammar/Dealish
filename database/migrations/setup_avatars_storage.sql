-- Create avatars storage bucket
-- Note: Storage policies must be created via Supabase Dashboard (see instructions below)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/jpg', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true;

-- ============================================================================
-- STORAGE POLICIES MUST BE CREATED VIA SUPABASE DASHBOARD
-- ============================================================================
-- Go to: Supabase Dashboard > Storage > avatars bucket > Policies
-- 
-- Create these 4 policies:
--
-- 1. INSERT Policy: "Users can upload their own avatars"
--    - Target roles: authenticated
--    - USING: bucket_id = 'avatars'
--    - WITH CHECK: bucket_id = 'avatars' AND (name ~ ('^' || auth.uid()::text || '_'))
--
-- 2. UPDATE Policy: "Users can update their own avatars"
--    - Target roles: authenticated
--    - USING: bucket_id = 'avatars' AND (name ~ ('^' || auth.uid()::text || '_'))
--    - WITH CHECK: bucket_id = 'avatars' AND (name ~ ('^' || auth.uid()::text || '_'))
--
-- 3. DELETE Policy: "Users can delete their own avatars"
--    - Target roles: authenticated
--    - USING: bucket_id = 'avatars' AND (name ~ ('^' || auth.uid()::text || '_'))
--
-- 4. SELECT Policy: "Public can view avatars"
--    - Target roles: anon, authenticated
--    - USING: bucket_id = 'avatars'
-- ============================================================================
