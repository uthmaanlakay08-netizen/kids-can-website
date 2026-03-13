-- Enable public read access to the 'media' bucket
create policy "Public Access"
on storage.objects for select
using ( bucket_id = 'media' );

-- Enable authenticated uploads to the 'media' bucket
-- (Assuming we want any logged-in user to upload, or for this client-side demo, potentially any anon user if we rely on the client key)
-- ideally: auth.role() = 'authenticated'
-- For this specific scenario where we are simulating admin client-side:
create policy "Public Uploads"
on storage.objects for insert
with check ( bucket_id = 'media' );

-- ALLOW DELETE
create policy "Public Delete"
on storage.objects for delete
using ( bucket_id = 'media' );
