-- CRITICAL FIX: Resolver Infinite Recursion in admin_users RLS
-- Run this in the Supabase SQL Editor

-- 1. Create a helper function with SECURITY DEFINER to bypass RLS
CREATE OR REPLACE FUNCTION check_admin_role(required_roles text[])
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE id = auth.uid() AND role = ANY(required_roles)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop the old recursive policies
DROP POLICY IF EXISTS "Super Admins can manage all" ON admin_users;
DROP POLICY IF EXISTS "Admins can manage applications" ON applications;
DROP POLICY IF EXISTS "Admins can manage contacts" ON contacts;
DROP POLICY IF EXISTS "Admins can manage partners" ON partners;
DROP POLICY IF EXISTS "Admins can manage teams" ON teams;
DROP POLICY IF EXISTS "Admins can manage donors" ON donors;
DROP POLICY IF EXISTS "Admins can manage heroes" ON heroes;
DROP POLICY IF EXISTS "Admins can manage notifications" ON admin_notifications;
DROP POLICY IF EXISTS "Admins can manage content" ON site_content;

-- 3. Re-create policies using the helper function
CREATE POLICY "Super Admins can manage all" ON admin_users
FOR ALL USING ( check_admin_role(ARRAY['super_admin', 'admin_manager']) );

CREATE POLICY "Admins can manage applications" ON applications
FOR ALL TO authenticated USING ( check_admin_role(ARRAY['super_admin', 'admin_manager', 'support_staff']) );

CREATE POLICY "Admins can manage contacts" ON contacts
FOR ALL TO authenticated USING ( check_admin_role(ARRAY['super_admin', 'admin_manager', 'support_staff']) );

CREATE POLICY "Admins can manage partners" ON partners
FOR ALL TO authenticated USING ( check_admin_role(ARRAY['super_admin', 'admin_manager', 'partner_manager']) );

CREATE POLICY "Admins can manage teams" ON teams
FOR ALL TO authenticated USING ( check_admin_role(ARRAY['super_admin', 'admin_manager', 'support_staff']) );

CREATE POLICY "Admins can manage donors" ON donors
FOR ALL TO authenticated USING ( check_admin_role(ARRAY['super_admin', 'admin_manager']) );

CREATE POLICY "Admins can manage heroes" ON heroes
FOR ALL TO authenticated USING ( check_admin_role(ARRAY['super_admin', 'admin_manager', 'content_manager']) );

CREATE POLICY "Admins can manage notifications" ON admin_notifications
FOR ALL TO authenticated USING ( check_admin_role(ARRAY['super_admin', 'admin_manager', 'support_staff']) );

CREATE POLICY "Admins can manage content" ON site_content
FOR ALL TO authenticated USING ( check_admin_role(ARRAY['super_admin', 'admin_manager', 'content_manager']) );

-- 4. Ensure public access remains correct
DROP POLICY IF EXISTS "Public can view content" ON site_content;
CREATE POLICY "Public can view content" ON site_content FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view heroes" ON heroes;
CREATE POLICY "Public can view heroes" ON heroes FOR SELECT USING (true);
