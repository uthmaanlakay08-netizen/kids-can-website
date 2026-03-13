-- Standardize Heroes Table for Automated Publishing
-- Run this in the Supabase SQL Editor

-- 1. Ensure all required columns exist with consistent naming
DO $$
BEGIN
    -- Rename 'image' to 'image_url' if it exists (for consistency)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='heroes' AND column_name='image') THEN
        ALTER TABLE heroes RENAME COLUMN image TO image_url;
    END IF;

    -- Add missing columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='heroes' AND column_name='age') THEN
        ALTER TABLE heroes ADD COLUMN age text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='heroes' AND column_name='diagnosis') THEN
        ALTER TABLE heroes ADD COLUMN diagnosis text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='heroes' AND column_name='story') THEN
        ALTER TABLE heroes ADD COLUMN story text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='heroes' AND column_name='image_url') THEN
        ALTER TABLE heroes ADD COLUMN image_url text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='heroes' AND column_name='status') THEN
        ALTER TABLE heroes ADD COLUMN status text DEFAULT 'Active';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='heroes' AND column_name='amount_raised') THEN
        ALTER TABLE heroes ADD COLUMN amount_raised decimal(10,2) DEFAULT 0.00;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='heroes' AND column_name='fundraising_goal') THEN
        ALTER TABLE heroes ADD COLUMN fundraising_goal decimal(10,2) DEFAULT 0.00;
    END IF;
    
    -- Ensure 'name' is not null
    ALTER TABLE heroes ALTER COLUMN name SET NOT NULL;
END $$;

-- 2. Update RLS policies to ensure admins can fully manage heroes
-- (Policies are already set up in master_supabase_fix.sql, but we ensure they cover everything)
DROP POLICY IF EXISTS "Admins manage heroes" ON heroes;
CREATE POLICY "Admins manage heroes" ON heroes FOR ALL USING ( check_admin_role(ARRAY['super_admin', 'content_manager', 'admin_manager']) );
