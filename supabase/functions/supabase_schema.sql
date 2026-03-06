
-- VIXREEL DATABASE CONTEXT v4.7
-- RELIABILITY & IDENTITY SYNC PATCH

-- 1. PROFILES INFRASTRUCTURE
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
  location TEXT,
  date_of_birth TEXT,
  is_location_private BOOLEAN DEFAULT false,
  website TEXT,
  show_followers_to TEXT DEFAULT 'EVERYONE',
  is_live BOOLEAN DEFAULT false,
  live_playback_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Explicitly ensure all columns are present (prevents 'column not found' errors)
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='avatar_url') THEN
    ALTER TABLE public.profiles ADD COLUMN avatar_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='cover_url') THEN
    ALTER TABLE public.profiles ADD COLUMN cover_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='location') THEN
    ALTER TABLE public.profiles ADD COLUMN location TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='date_of_birth') THEN
    ALTER TABLE public.profiles ADD COLUMN date_of_birth TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='is_location_private') THEN
    ALTER TABLE public.profiles ADD COLUMN is_location_private BOOLEAN DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='website') THEN
    ALTER TABLE public.profiles ADD COLUMN website TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='show_followers_to') THEN
    ALTER TABLE public.profiles ADD COLUMN show_followers_to TEXT DEFAULT 'EVERYONE';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='is_live') THEN
    ALTER TABLE public.profiles ADD COLUMN is_live BOOLEAN DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='live_playback_id') THEN
    ALTER TABLE public.profiles ADD COLUMN live_playback_id TEXT;
  END IF;
END $$;

-- 1.1 MESSAGES EXTENSION
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='messages') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='is_read') THEN
      ALTER TABLE public.messages ADD COLUMN is_read BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='sticker_url') THEN
      ALTER TABLE public.messages ADD COLUMN sticker_url TEXT;
    END IF;
  END IF;
END $$;

-- 2. BUCKET INITIALIZATION
-- We ensure public access is enabled for the buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true),
       ('posts', 'posts', true),
       ('stories', 'stories', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 3. PROFILES RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_profiles_read" ON public.profiles;
CREATE POLICY "public_profiles_read" ON public.profiles FOR SELECT USING (true);

-- Allow owners full control (Select, Insert, Update, Delete)
DROP POLICY IF EXISTS "owner_profiles_manage" ON public.profiles;
CREATE POLICY "owner_profiles_manage" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 4. STORAGE RLS (Optimized for reliability using path matching)
-- This enforces that files in 'avatars/UID/...' can only be managed by UID.

DROP POLICY IF EXISTS "storage_read_public" ON storage.objects;
CREATE POLICY "storage_read_public" ON storage.objects FOR SELECT USING (bucket_id IN ('avatars', 'posts', 'stories'));

DROP POLICY IF EXISTS "storage_insert_owner" ON storage.objects;
CREATE POLICY "storage_insert_owner" ON storage.objects FOR INSERT TO authenticated 
WITH CHECK (
  bucket_id IN ('avatars', 'posts', 'stories') AND 
  (name LIKE (auth.uid()::text || '/%'))
);

DROP POLICY IF EXISTS "storage_update_owner" ON storage.objects;
CREATE POLICY "storage_update_owner" ON storage.objects FOR UPDATE TO authenticated 
USING (
  bucket_id IN ('avatars', 'posts', 'stories') AND 
  (name LIKE (auth.uid()::text || '/%'))
)
WITH CHECK (
  bucket_id IN ('avatars', 'posts', 'stories') AND 
  (name LIKE (auth.uid()::text || '/%'))
);

DROP POLICY IF EXISTS "storage_delete_owner" ON storage.objects;
CREATE POLICY "storage_delete_owner" ON storage.objects FOR DELETE TO authenticated 
USING (
  bucket_id IN ('avatars', 'posts', 'stories') AND 
  (name LIKE (auth.uid()::text || '/%'))
);
