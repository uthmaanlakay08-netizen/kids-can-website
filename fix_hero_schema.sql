-- FIX: Sync heroes table with application code (image -> image_url)
-- Run this in the Supabase SQL Editor

-- 1. Add image_url column if it doesn't exist
ALTER TABLE heroes ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 2. Migrate data from old 'image' column to 'image_url' if needed
UPDATE heroes SET image_url = image WHERE image_url IS NULL AND image IS NOT NULL;

-- 3. (Optional) Remove the old 'image' column once verified
-- ALTER TABLE heroes DROP COLUMN image;

-- 4. Ensure RLS is enabled and policies are correct for heroes
ALTER TABLE heroes ENABLE ROW LEVEL SECURITY;

-- 5. Public select policy
DROP POLICY IF EXISTS "Public can view active heroes" ON heroes;
CREATE POLICY "Public can view active heroes" ON heroes FOR SELECT USING (status = 'Active' OR status IS NULL);

-- 6. Admin all policy
DROP POLICY IF EXISTS "Admins can manage heroes" ON heroes;
CREATE POLICY "Admins can manage heroes" ON heroes FOR ALL TO authenticated USING (true);
