
-- VIXREEL MASTER SCHEMA (v3.9)
-- FINAL STABILITY FIX

-- 1. PROFILES TABLE REPAIR
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  cover_url TEXT,
  bio TEXT,
  email TEXT,
  phone TEXT,
  is_admin BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT false,
  is_private BOOLEAN DEFAULT false,
  is_following_public BOOLEAN DEFAULT true, 
  allow_comments BOOLEAN DEFAULT true,
  boosted_followers INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure cover_url is definitely there (fixes schema cache error)
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='cover_url') THEN
    ALTER TABLE public.profiles ADD COLUMN cover_url TEXT;
  END IF;
END $$;

-- 2. STORAGE INITIALIZATION
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true),
       ('posts', 'posts', true),
       ('stories', 'stories', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 3. PROFILES RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_public" ON public.profiles;
CREATE POLICY "profiles_select_public" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles_owner_all" ON public.profiles;
CREATE POLICY "profiles_owner_all" ON public.profiles FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 4. STORAGE RLS (Robust Folder-Based Ownership)
-- We use LIKE to ensure the path starts with the User's UID folder
-- Format: {bucket}/{userId}/{filename}

DROP POLICY IF EXISTS "storage_select_all" ON storage.objects;
CREATE POLICY "storage_select_all" ON storage.objects FOR SELECT USING (bucket_id IN ('avatars', 'posts', 'stories'));

DROP POLICY IF EXISTS "storage_insert_owner" ON storage.objects;
CREATE POLICY "storage_insert_owner" ON storage.objects FOR INSERT TO authenticated 
WITH CHECK (bucket_id IN ('avatars', 'posts', 'stories') AND (name LIKE auth.uid()::text || '/%'));

DROP POLICY IF EXISTS "storage_update_owner" ON storage.objects;
CREATE POLICY "storage_update_owner" ON storage.objects FOR UPDATE TO authenticated 
USING (bucket_id IN ('avatars', 'posts', 'stories') AND (name LIKE auth.uid()::text || '/%'))
WITH CHECK (bucket_id IN ('avatars', 'posts', 'stories') AND (name LIKE auth.uid()::text || '/%'));

DROP POLICY IF EXISTS "storage_delete_owner" ON storage.objects;
CREATE POLICY "storage_delete_owner" ON storage.objects FOR DELETE TO authenticated 
USING (bucket_id IN ('avatars', 'posts', 'stories') AND (name LIKE auth.uid()::text || '/%'));

-- 5. APP LOGIC TABLES
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "posts_all" ON public.posts;
CREATE POLICY "posts_all" ON public.posts FOR ALL USING (true);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "follows_all" ON public.follows;
CREATE POLICY "follows_all" ON public.follows FOR ALL USING (true);

ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "likes_all" ON public.likes;
CREATE POLICY "likes_all" ON public.likes FOR ALL USING (true);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "comments_all" ON public.comments;
CREATE POLICY "comments_all" ON public.comments FOR ALL USING (true);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "messages_all" ON public.messages;
CREATE POLICY "messages_all" ON public.messages FOR ALL USING (true);

ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stories_all" ON public.stories;
CREATE POLICY "stories_all" ON public.stories FOR ALL USING (true);
