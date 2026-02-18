
-- VIXREEL MASTER SCHEMA (v3.6)
-- Hardened RLS for Storage and Profiles

-- 1. PROFILES
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

-- 2. AUTOMATIC PROFILE CREATION TRIGGER
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

-- 3. POSTS
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  media_url TEXT NOT NULL,
  media_type TEXT CHECK (media_type IN ('image', 'video')) NOT NULL,
  caption TEXT,
  boosted_likes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. FOLLOWS
CREATE TABLE IF NOT EXISTS public.follows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  following_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, following_id)
);

-- 5. LIKES
CREATE TABLE IF NOT EXISTS public.likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- 6. COMMENTS
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. MESSAGES
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. STORIES
CREATE TABLE IF NOT EXISTS public.stories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  media_url TEXT NOT NULL,
  media_type TEXT CHECK (media_type IN ('image', 'video')) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

-- 9. SAVES
CREATE TABLE IF NOT EXISTS public.saves (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- RLS ENABLING
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saves ENABLE ROW LEVEL SECURITY;

-- DATABASE POLICIES
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage their own profile" ON public.profiles;
CREATE POLICY "Users can manage their own profile" ON public.profiles 
FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Posts are viewable by everyone" ON public.posts;
CREATE POLICY "Posts are viewable by everyone" ON public.posts FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage their own posts" ON public.posts;
CREATE POLICY "Users can manage their own posts" ON public.posts 
FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Likes are viewable by everyone" ON public.likes;
CREATE POLICY "Likes are viewable by everyone" ON public.likes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can toggle likes" ON public.likes;
CREATE POLICY "Users can toggle likes" ON public.likes FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Comments are viewable by everyone" ON public.comments;
CREATE POLICY "Comments are viewable by everyone" ON public.comments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage own comments" ON public.comments;
CREATE POLICY "Users can manage own comments" ON public.comments FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Messages are viewable by participants" ON public.messages;
CREATE POLICY "Messages are viewable by participants" ON public.messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
CREATE POLICY "Users can send messages" ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Stories are viewable while active" ON public.stories;
CREATE POLICY "Stories are viewable while active" ON public.stories FOR SELECT USING (expires_at > NOW());

DROP POLICY IF EXISTS "Users can manage own stories" ON public.stories;
CREATE POLICY "Users can manage own stories" ON public.stories FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Saves are viewable by owner" ON public.saves;
CREATE POLICY "Saves are viewable by owner" ON public.saves FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can toggle saves" ON public.saves;
CREATE POLICY "Users can toggle saves" ON public.saves FOR ALL USING (auth.uid() = user_id);

-- STORAGE RLS
-- Use exact folder ownership pattern: {userId}/{filename}
-- The path in the storage.objects table name column is what we check against.

-- Avatars Bucket
DROP POLICY IF EXISTS "Users can manage own avatars" ON storage.objects;
CREATE POLICY "Users can manage own avatars" ON storage.objects 
FOR ALL TO authenticated 
USING (bucket_id = 'avatars' AND (name LIKE auth.uid()::text || '/%'))
WITH CHECK (bucket_id = 'avatars' AND (name LIKE auth.uid()::text || '/%'));

DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
CREATE POLICY "Anyone can view avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

-- Posts Bucket
DROP POLICY IF EXISTS "Users can manage own posts storage" ON storage.objects;
CREATE POLICY "Users can manage own posts storage" ON storage.objects 
FOR ALL TO authenticated 
USING (bucket_id = 'posts' AND (name LIKE auth.uid()::text || '/%'))
WITH CHECK (bucket_id = 'posts' AND (name LIKE auth.uid()::text || '/%'));

DROP POLICY IF EXISTS "Anyone can view posts storage" ON storage.objects;
CREATE POLICY "Anyone can view posts storage" ON storage.objects FOR SELECT USING (bucket_id = 'posts');

-- Stories Bucket
DROP POLICY IF EXISTS "Users can manage own stories storage" ON storage.objects;
CREATE POLICY "Users can manage own stories storage" ON storage.objects 
FOR ALL TO authenticated 
USING (bucket_id = 'stories' AND (name LIKE auth.uid()::text || '/%'))
WITH CHECK (bucket_id = 'stories' AND (name LIKE auth.uid()::text || '/%'));

DROP POLICY IF EXISTS "Anyone can view stories storage" ON storage.objects;
CREATE POLICY "Anyone can view stories storage" ON storage.objects FOR SELECT USING (bucket_id = 'stories');
