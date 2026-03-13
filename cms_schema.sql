-- PHASE 3: VISUAL CMS CONTENT TABLE

create table if not exists site_content (
  key text primary key, -- e.g., 'home.hero.title'
  content text,         -- The HTML or text content
  type text default 'text', -- 'text', 'image', 'html'
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  updated_by uuid references auth.users
);

-- Enable RLS
alter table site_content enable row level security;

-- Policy: Everyone can READ content (Public site needs this)
create policy "Public can read site content"
on site_content for select
using ( true );

-- Policy: Only Admins can UPDATE/INSERT content
-- (Using the existing admin_users permissions)
create policy "Admins can manage site content"
on site_content for all
using (
  exists (
    select 1 from admin_users au
    where au.email = auth.email()
    and au.role in ('super_admin', 'admin_manager', 'content_editor')
  )
);
