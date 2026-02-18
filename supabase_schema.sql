
-- VIXREEL MASTER SCHEMA (v3.7)
-- Ultra-Hardened RLS & Storage Configuration

-- 1. INITIALIZE STORAGE BUCKETS
-- Note: This ensures buckets exist. If they already exist, it does nothing.
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true),
       ('posts', 'posts', true),
       ('stories', 'stories', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. PROFILES TABLE
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

-- 3. PROFILES RLS (Granular)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_public" ON public.profiles;
CREATE POLICY "profiles_select_public" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles_insert_owner" ON public.profiles;
CREATE POLICY "profiles_insert_owner" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_owner" ON public.profiles;
CREATE POLICY "profiles_update_owner" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 4. STORAGE RLS (Granular & Robust)
-- These policies apply to storage.objects which handles the actual files

-- Allow anyone to see files in these buckets
DROP POLICY IF EXISTS "storage_select_public" ON storage.objects;
CREATE POLICY "storage_select_public" ON storage.objects 
FOR SELECT USING (bucket_id IN ('avatars', 'posts', 'stories'));

-- INSERT: User can only upload to a folder named after their UID
DROP POLICY IF EXISTS "storage_insert_owner" ON storage.objects;
CREATE POLICY "storage_insert_owner" ON storage.objects 
FOR INSERT TO authenticated 
WITH CHECK (
  (bucket_id IN ('avatars', 'posts', 'stories')) AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- UPDATE: User can only update files in a folder named after their UID
DROP POLICY IF EXISTS "storage_update_owner" ON storage.objects;
CREATE POLICY "storage_update_owner" ON storage.objects 
FOR UPDATE TO authenticated 
USING (
  (bucket_id IN ('avatars', 'posts', 'stories')) AND 
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  (bucket_id IN ('avatars', 'posts', 'stories')) AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- DELETE: User can only delete files in their own folder
DROP POLICY IF EXISTS "storage_delete_owner" ON storage.objects;
CREATE POLICY "storage_delete_owner" ON storage.objects 
FOR DELETE TO authenticated 
USING (
  (bucket_id IN ('avatars', 'posts', 'stories')) AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 5. OTHER TABLES RLS (Standard)
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "posts_select_all" ON public.posts;
CREATE POLICY "posts_select_all" ON public.posts FOR SELECT USING (true);
DROP POLICY IF EXISTS "posts_manage_owner" ON public.posts;
CREATE POLICY "posts_manage_owner" ON public.posts FOR ALL USING (auth.uid() = user_id);

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
DROP POLICY IF EXISTS "messages_access" ON public.messages;
CREATE POLICY "messages_access" ON public.messages FOR ALL USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stories_all" ON public.stories;
CREATE POLICY "stories_all" ON public.stories FOR ALL USING (true);

ALTER TABLE public.saves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "saves_owner" ON public.saves;
CREATE POLICY "saves_owner" ON public.saves FOR ALL USING (auth.uid() = user_id);

-- 6. TRIGGER FOR NEW USERS
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, email, avatar_url)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)),
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    'https://ui-avatars.com/api/?name=' || COALESCE(new.raw_user_meta_data->>'username', 'User')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
