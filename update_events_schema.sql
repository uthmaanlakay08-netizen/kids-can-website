-- Run this in the Supabase SQL Editor to update your events table

ALTER TABLE events ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS video_url text;
