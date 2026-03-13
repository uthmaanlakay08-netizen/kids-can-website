-- Create a table to map Emails to Roles
create table admin_users (
  email text primary key,
  role text not null check (role in ('manager', 'editor')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table admin_users enable row level security;

-- POLICY 1: Managers can read ALL rows (to list the team)
create policy "Managers can view all"
on admin_users for select
using (
  exists (
    select 1 from admin_users au 
    where au.email = auth.email() 
    and au.role = 'manager'
  )
);

-- POLICY 2: Managers can insert/update/delete rows
create policy "Managers can manage team"
on admin_users for all
using (
  exists (
    select 1 from admin_users au 
    where au.email = auth.email() 
    and au.role = 'manager'
  )
);

-- POLICY 3: Everyone can read their OWN row (to check their own role on login)
create policy "Users can read own role"
on admin_users for select
using (
  email = auth.email()
);

-- INITIAL SETUP:
-- You need to manually insert yourself as the first manager.
-- Run this replacing 'your-email@example.com' with your actual email that you will sign up with.
-- INSERT INTO admin_users (email, role) VALUES ('your-email@example.com', 'manager');
