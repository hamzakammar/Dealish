-- DEBT-009: utils/uploadImage.ts and scripts/refresh-restaurant-photos*.js use a
-- `restaurant-images` Storage bucket, but only `avatars` had a setup migration.
-- This creates the bucket so a fresh environment can be provisioned from the repo.
--
-- As with avatars, Storage RLS policies must be created in the Supabase Dashboard
-- (Storage > restaurant-images > Policies) — see the instructions block below.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('restaurant-images', 'restaurant-images', true, 5242880,
        ARRAY['image/jpeg', 'image/png', 'image/jpg', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true;

-- ============================================================================
-- STORAGE POLICIES MUST BE CREATED VIA SUPABASE DASHBOARD
-- ============================================================================
-- Go to: Supabase Dashboard > Storage > restaurant-images bucket > Policies
--
-- Restaurant images are uploaded by restaurant owners/admins and viewed publicly.
-- Suggested policies:
--
-- 1. SELECT Policy: "Public can view restaurant images"
--    - Target roles: anon, authenticated
--    - USING: bucket_id = 'restaurant-images'
--
-- 2. INSERT Policy: "Owners/admins can upload restaurant images"
--    - Target roles: authenticated
--    - WITH CHECK: bucket_id = 'restaurant-images'
--        AND EXISTS (SELECT 1 FROM profiles p
--                    WHERE p.id = auth.uid() AND p.role IN ('owner','admin'))
--
-- 3. UPDATE Policy: "Owners/admins can update restaurant images"
--    - Target roles: authenticated
--    - USING / WITH CHECK: same predicate as INSERT
--
-- 4. DELETE Policy: "Owners/admins can delete restaurant images"
--    - Target roles: authenticated
--    - USING: same predicate as INSERT
-- ============================================================================
