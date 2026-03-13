-- PART 2: Run this ONLY AFTER running Part 1 successfully.

-- Replace 'YOUR_EMAIL_HERE' with the email you used to create the user in Supabase Authentication.
insert into admin_users (id, email, role, status)
select id, email, 'super_admin', 'active'
from auth.users
where email = 'YOUR_EMAIL_HERE';

-- Check if it worked
select * from admin_users;
