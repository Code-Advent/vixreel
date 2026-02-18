
-- VIXREEL MASTER SCHEMA (v3.8)
-- REPAIR & HARDEN SCRIPT

-- 1. REPAIR PROFILES TABLE (Ensure cover_url exists)
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

-- Force add columns if they were missed in previous runs
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='cover_url') THEN
    ALTER TABLE public.profiles ADD COLUMN cover_url TEXT;
  END IF;
END $$;

-- 2. STORAGE BUCKETS
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true),
       ('posts', 'posts', true),
       ('stories', 'stories', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 3. PROFILES RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_public" ON public.profiles;
CREATE POLICY "profiles_select_public" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles_insert_owner" ON public.profiles;
CREATE POLICY "profiles_insert_owner" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_owner" ON public.profiles;
CREATE POLICY "profiles_update_owner" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 4. STORAGE RLS (Folder-based Ownership)
-- Pattern: {bucket}/{userId}/{filename}

DROP POLICY IF EXISTS "storage_select_public" ON storage.objects;
CREATE POLICY "storage_select_public" ON storage.objects FOR SELECT USING (bucket_id IN ('avatars', 'posts', 'stories'));

DROP POLICY IF EXISTS "storage_insert_owner" ON storage.objects;
CREATE POLICY "storage_insert_owner" ON storage.objects FOR INSERT TO authenticated 
WITH CHECK (bucket_id IN ('avatars', 'posts', 'stories') AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "storage_update_owner" ON storage.objects;
CREATE POLICY "storage_update_owner" ON storage.objects FOR UPDATE TO authenticated 
USING (bucket_id IN ('avatars', 'posts', 'stories') AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "storage_delete_owner" ON storage.objects;
CREATE POLICY "storage_delete_owner" ON storage.objects FOR DELETE TO authenticated 
USING (bucket_id IN ('avatars', 'posts', 'stories') AND (storage.foldername(name))[1] = auth.uid()::text);

-- 5. OTHER TABLES
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
