
-- 1. PROFILES TABLE (Core Identity)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  email TEXT,
  date_of_birth DATE,
  is_admin BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. POSTS TABLE
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  media_url TEXT NOT NULL,
  media_type TEXT CHECK (media_type IN ('image', 'video')) NOT NULL,
  caption TEXT,
  boosted_likes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. INTERACTION TABLES
CREATE TABLE IF NOT EXISTS public.likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, post_id)
);

CREATE TABLE IF NOT EXISTS public.follows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  following_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(follower_id, following_id)
);

CREATE TABLE IF NOT EXISTS public.stories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  media_url TEXT NOT NULL,
  media_type TEXT CHECK (media_type IN ('image', 'video')) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '24 hours')
);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. ENABLE RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 5. POLICIES (Consolidated and Cleaned)
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
    CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
    
    DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
    CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

    DROP POLICY IF EXISTS "Posts are viewable by everyone" ON public.posts;
    CREATE POLICY "Posts are viewable by everyone" ON public.posts FOR SELECT USING (true);
    
    DROP POLICY IF EXISTS "Authenticated users can insert posts" ON public.posts;
    CREATE POLICY "Authenticated users can insert posts" ON public.posts FOR INSERT WITH CHECK (auth.uid() = user_id);
    
    DROP POLICY IF EXISTS "Users can delete their own posts" ON public.posts;
    CREATE POLICY "Users can delete their own posts" ON public.posts FOR DELETE USING (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Likes are viewable by everyone" ON public.likes;
    CREATE POLICY "Likes are viewable by everyone" ON public.likes FOR SELECT USING (true);
    
    DROP POLICY IF EXISTS "Authenticated users can like" ON public.likes;
    CREATE POLICY "Authenticated users can like" ON public.likes FOR INSERT WITH CHECK (auth.uid() = user_id);
    
    DROP POLICY IF EXISTS "Users can unlike" ON public.likes;
    CREATE POLICY "Users can unlike" ON public.likes FOR DELETE USING (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Stories are viewable by everyone" ON public.stories;
    CREATE POLICY "Stories are viewable by everyone" ON public.stories FOR SELECT USING (true);
    
    DROP POLICY IF EXISTS "Users can post stories" ON public.stories;
    CREATE POLICY "Users can post stories" ON public.stories FOR INSERT WITH CHECK (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Messages are viewable by participants" ON public.messages;
    CREATE POLICY "Messages are viewable by participants" ON public.messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
    
    DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
    CREATE POLICY "Users can send messages" ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
END $$;
