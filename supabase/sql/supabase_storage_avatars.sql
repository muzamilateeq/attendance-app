-- RUN THIS IN YOUR SUPABASE SQL EDITOR

-- 1. Add the avatar_url column to your employee_profiles table (if it doesn't exist)
ALTER TABLE employee_profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 2. Create the avatars storage bucket (ignore if already exists)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Set up Storage Security Policies (so users can upload and view images)
-- Allow public viewing of all avatars
CREATE POLICY "Avatar images are publicly accessible." 
ON storage.objects FOR SELECT 
USING (bucket_id = 'avatars');

-- Allow anyone to upload an avatar (since we handle security in the app)
CREATE POLICY "Anyone can upload an avatar." 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'avatars');

-- Allow anyone to update their avatar
CREATE POLICY "Anyone can update their avatar." 
ON storage.objects FOR UPDATE 
WITH CHECK (bucket_id = 'avatars');
