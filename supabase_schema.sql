
-- VIXREEL MASTER SCHEMA (v4.2)
-- TYPE-SAFE STORAGE & IDENTITY PROTOCOL

-- 1. PROFILES TABLE
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

-- Ensure critical columns exist
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='cover_url') THEN
    ALTER TABLE public.profiles ADD COLUMN cover_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='avatar_url') THEN
    ALTER TABLE public.profiles ADD COLUMN avatar_url TEXT;
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

DROP POLICY IF EXISTS "profiles_read_all" ON public.profiles;
CREATE POLICY "profiles_read_all" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles_manage_own" ON public.profiles;
CREATE POLICY "profiles_manage_own" ON public.profiles FOR ALL USING (auth.uid() = id);

-- 4. STORAGE RLS (Fixed Type Mismatches)
-- auth.uid() returns UUID
-- storage.objects.owner is UUID
-- storage.foldername(name) returns text[]

DROP POLICY IF EXISTS "storage_all_select" ON storage.objects;
CREATE POLICY "storage_all_select" ON storage.objects FOR SELECT USING (bucket_id IN ('avatars', 'posts', 'stories'));

-- INSERT Policy
DROP POLICY IF EXISTS "storage_owner_insert" ON storage.objects;
CREATE POLICY "storage_owner_insert" ON storage.objects FOR INSERT TO authenticated 
WITH CHECK (
  bucket_id IN ('avatars', 'posts', 'stories') AND 
  (
    (storage.foldername(name))[1] = auth.uid()::text OR
    auth.uid() = owner
  )
);

-- UPDATE Policy
DROP POLICY IF EXISTS "storage_owner_update" ON storage.objects;
CREATE POLICY "storage_owner_update" ON storage.objects FOR UPDATE TO authenticated 
USING (
  bucket_id IN ('avatars', 'posts', 'stories') AND 
  (
    (storage.foldername(name))[1] = auth.uid()::text OR
    auth.uid() = owner
  )
)
WITH CHECK (
  bucket_id IN ('avatars', 'posts', 'stories') AND 
  (
    (storage.foldername(name))[1] = auth.uid()::text OR
    auth.uid() = owner
  )
);

-- DELETE Policy
DROP POLICY IF EXISTS "storage_owner_delete" ON storage.objects;
CREATE POLICY "storage_owner_delete" ON storage.objects FOR DELETE TO authenticated 
USING (
  bucket_id IN ('avatars', 'posts', 'stories') AND 
  (
    (storage.foldername(name))[1] = auth.uid()::text OR
    auth.uid() = owner
  )
);

-- 5. APP TABLES RLS
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "posts_permissive" ON public.posts;
CREATE POLICY "posts_permissive" ON public.posts FOR ALL USING (true);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "follows_permissive" ON public.follows;
CREATE POLICY "follows_permissive" ON public.follows FOR ALL USING (true);

ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "likes_permissive" ON public.likes;
CREATE POLICY "likes_permissive" ON public.likes FOR ALL USING (true);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "comments_permissive" ON public.comments;
CREATE POLICY "comments_permissive" ON public.comments FOR ALL USING (true);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "messages_permissive" ON public.messages;
CREATE POLICY "messages_permissive" ON public.messages FOR ALL USING (true);

ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stories_permissive" ON public.stories;
CREATE POLICY "stories_permissive" ON public.stories FOR ALL USING (true);
