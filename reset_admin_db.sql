-- RUN THIS ENTIRE SCRIPT TO FIX EVERYTHING (UPDATED)

-- 1. DROP THE TABLE AND ALL DEPENDENCIES (like the logs policy)
drop table if exists public.admin_users cascade;

-- Note: The cascade above automatically drops dependent policies on other tables.

-- 2. CREATE THE TABLE CORRECTLY (Matching the code)
create table public.admin_users (
  id uuid references auth.users not null primary key,
  email text not null,
  role text not null,
  status text default 'active',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. ENABLE SECURITY
alter table public.admin_users enable row level security;

-- 4. CREATE POLICIES

-- Allow users to read their own role (so they can log in)
create policy "Users can read own role"
on public.admin_users for select
using ( auth.uid() = id );

-- Allow Super Admins to manage the table (add/remove staff)
create policy "Super Admins can manage all"
on public.admin_users for all
using (
  exists (
    select 1 from public.admin_users au
    where au.id = auth.uid()
    and au.role in ('super_admin', 'admin_manager')
  )
);

-- Re-create the policy on activity_logs that was dropped by cascade (if table exists)
do $$
begin
  if exists (select from pg_tables where schemaname = 'public' and tablename = 'activity_logs') then
    drop policy if exists "Admins can view logs" on public.activity_logs;
    create policy "Admins can view logs"
    on public.activity_logs for select
    using (
      exists (
        select 1 from public.admin_users au
        where au.id = auth.uid()
        and au.role in ('super_admin', 'admin_manager')
      )
    );
  end if;
end $$;

-- 5. MAKE EVERYONE A SUPER ADMIN (For now, to fix access)
-- This grants super_admin role to ALL currently signed-up users.
insert into public.admin_users (id, email, role, status)
select id, email, 'super_admin', 'active'
from auth.users
on conflict (id) do update
set role = 'super_admin', status = 'active';
