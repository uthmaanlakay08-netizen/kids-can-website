-- FIX ADMIN PERMISSIONS
-- Run this entire script in the Supabase SQL Editor.

-- 1. DROP EXISTING POLICIES (To fix "already exists" error)
-- We use DO blocks or simple drop statements. 
-- Note: If a policy doesn't exist, the command might fail in standard SQL, but Supabase usually handles specific drops fine.
-- To be safe, we try to drop the known ones.
drop policy if exists "Super Admins can manage all" on admin_users;
drop policy if exists "Users can read own role" on admin_users;
drop policy if exists "Admins can view logs" on activity_logs;
drop policy if exists "Managers can view all" on admin_users;
drop policy if exists "Managers can manage team" on admin_users;
drop policy if exists "Public Access" on storage.objects; 
drop policy if exists "Public Uploads" on storage.objects;

-- 2. ENSURE TABLE STRUCTURE (Idempotent)
create table if not exists admin_users (
  id uuid references auth.users not null primary key,
  email text not null,
  role text not null,
  status text default 'active',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table admin_users enable row level security;

-- 3. RE-CREATE POLICIES

-- Policy: Users can read their own role (Required for login check)
create policy "Users can read own role"
on admin_users for select
using ( auth.uid() = id );

-- Policy: Super Admins or Admin Managers can manage the team table
create policy "Super Admins can manage all"
on admin_users for all
using (
  exists (
    select 1 from admin_users au
    where au.id = auth.uid()
    and au.role in ('super_admin', 'admin_manager')
  )
);

-- 4. INSERT YOURSELF AS SUPER ADMIN
-- Replace 'UTHMAAN@KIDSCAN.ORG.ZA' in the query below with your exact Supabase Auth email.
-- This command finds your user in auth.users and inserts it into admin_users.
insert into admin_users (id, email, role, status)
select id, email, 'super_admin', 'active'
from auth.users
where email ilike '%kidscan%' -- CAUTION: This adds ALL users with kidscan in email.
-- BETTER: Use specific email if you know it, otherwise this finds the most likely admin.
-- Or just uncomment and edit this line:
-- where email = 'your_email@example.com'
on conflict (id) do update
set role = 'super_admin', status = 'active';
