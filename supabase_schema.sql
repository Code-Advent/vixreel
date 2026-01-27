
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  is_admin BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- POSTS TABLE
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  media_url TEXT NOT NULL,
  media_type TEXT DEFAULT 'image',
  caption TEXT,
  boosted_likes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- STORIES TABLE
CREATE TABLE IF NOT EXISTS public.stories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  media_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (timezone('utc'::text, now()) + interval '24 hours')
);

-- STORAGE SETUP
-- Manual bucket insertion (if possible in your environment)
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('avatars', 'avatars', true), 
  ('posts', 'posts', true), 
  ('stories', 'stories', true)
ON CONFLICT (id) DO NOTHING;

-- RLS for Storage
-- Allow anyone to see files
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (true);

-- Allow authenticated users to upload to specific buckets
CREATE POLICY "Avatar Uploads" ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Post Media Uploads" ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'posts' AND auth.role() = 'authenticated');

CREATE POLICY "Story Media Uploads" ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'stories' AND auth.role() = 'authenticated');

-- Allow users to delete their own uploads
CREATE POLICY "Owner Deletion" ON storage.objects FOR DELETE 
USING (auth.uid()::text = (storage.foldername(name))[1]);

-- Enable RLS on public tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

-- App level policies
CREATE POLICY "Public Profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Update Own Profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Public Posts" ON public.posts FOR SELECT USING (true);
CREATE POLICY "Insert Own Posts" ON public.posts FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public Stories" ON public.stories FOR SELECT USING (true);
CREATE POLICY "Insert Own Stories" ON public.stories FOR INSERT WITH CHECK (auth.uid() = user_id);
