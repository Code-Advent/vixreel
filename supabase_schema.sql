
-- VIXREEL MASTER SCHEMA (v4.0)
-- ULTRA-RELIABLE STORAGE & IDENTITY PROTOCOL

-- 1. PROFILES TABLE (Core Identity)
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

-- Schema Correction: Force ensure columns exist to prevent cache issues
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='cover_url') THEN
    ALTER TABLE public.profiles ADD COLUMN cover_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='avatar_url') THEN
    ALTER TABLE public.profiles ADD COLUMN avatar_url TEXT;
  END IF;
END $$;

-- 2. STORAGE INFRASTRUCTURE
-- Supabase requires buckets to be explicitly defined in storage.buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true),
       ('posts', 'posts', true),
       ('stories', 'stories', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 3. PROFILES RLS (Simplified for reliability)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles_owner_all" ON public.profiles;
CREATE POLICY "profiles_owner_all" ON public.profiles FOR ALL USING (auth.uid() = id);

-- 4. STORAGE RLS (Robust Path Ownership)
-- Policy: User can manage any file in a bucket if the path starts with their UID/
-- Example: avatars/{uid}/file.jpg

DROP POLICY IF EXISTS "storage_public_select" ON storage.objects;
CREATE POLICY "storage_public_select" ON storage.objects FOR SELECT USING (bucket_id IN ('avatars', 'posts', 'stories'));

DROP POLICY IF EXISTS "storage_owner_insert" ON storage.objects;
CREATE POLICY "storage_owner_insert" ON storage.objects FOR INSERT TO authenticated 
WITH CHECK (bucket_id IN ('avatars', 'posts', 'stories') AND (name LIKE auth.uid()::text || '/%'));

DROP POLICY IF EXISTS "storage_owner_update" ON storage.objects;
CREATE POLICY "storage_owner_update" ON storage.objects FOR UPDATE TO authenticated 
USING (bucket_id IN ('avatars', 'posts', 'stories') AND (name LIKE auth.uid()::text || '/%'));

DROP POLICY IF EXISTS "storage_owner_delete" ON storage.objects;
CREATE POLICY "storage_owner_delete" ON storage.objects FOR DELETE TO authenticated 
USING (bucket_id IN ('avatars', 'posts', 'stories') AND (name LIKE auth.uid()::text || '/%'));

-- 5. APP LOGIC (Permissive for development)
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "posts_all_access" ON public.posts;
CREATE POLICY "posts_all_access" ON public.posts FOR ALL USING (true);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "follows_all_access" ON public.follows;
CREATE POLICY "follows_all_access" ON public.follows FOR ALL USING (true);

ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "likes_all_access" ON public.likes;
CREATE POLICY "likes_all_access" ON public.likes FOR ALL USING (true);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "comments_all_access" ON public.comments;
CREATE POLICY "comments_all_access" ON public.comments FOR ALL USING (true);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "messages_all_access" ON public.messages;
CREATE POLICY "messages_all_access" ON public.messages FOR ALL USING (true);

ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stories_all_access" ON public.stories;
CREATE POLICY "stories_all_access" ON public.stories FOR ALL USING (true);
