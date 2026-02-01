
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE
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
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. POSTS TABLE
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image',
  caption TEXT,
  boosted_likes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. STORIES TABLE
DROP TABLE IF EXISTS public.stories CASCADE;
CREATE TABLE public.stories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (timezone('utc'::text, now()) + interval '24 hours')
);

-- 4. LIKES TABLE
CREATE TABLE IF NOT EXISTS public.likes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  UNIQUE(post_id, user_id)
);

-- 5. SAVES TABLE
CREATE TABLE IF NOT EXISTS public.saves (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  UNIQUE(post_id, user_id)
);

-- 6. COMMENTS TABLE
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 7. FOLLOWS TABLE
CREATE TABLE IF NOT EXISTS public.follows (
  follower_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (follower_id, following_id)
);

-- 8. MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Configuration
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 9. IDEMPOTENT POLICIES
DO $$ 
BEGIN
    -- Profiles
    DROP POLICY IF EXISTS "Public profiles are viewable" ON public.profiles;
    CREATE POLICY "Public profiles are viewable" ON public.profiles FOR SELECT USING (true);
    DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
    CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

    -- Posts
    DROP POLICY IF EXISTS "Public posts are viewable" ON public.posts;
    CREATE POLICY "Public posts are viewable" ON public.posts FOR SELECT USING (true);
    DROP POLICY IF EXISTS "Users can insert own posts" ON public.posts;
    CREATE POLICY "Users can insert own posts" ON public.posts FOR INSERT WITH CHECK (auth.uid() = user_id);
    DROP POLICY IF EXISTS "Users can delete own posts" ON public.posts;
    CREATE POLICY "Users can delete own posts" ON public.posts FOR DELETE USING (auth.uid() = user_id);

    -- Likes
    DROP POLICY IF EXISTS "Public likes are viewable" ON public.likes;
    CREATE POLICY "Public likes are viewable" ON public.likes FOR SELECT USING (true);
    DROP POLICY IF EXISTS "Users can like posts" ON public.likes;
    CREATE POLICY "Users can like posts" ON public.likes FOR INSERT WITH CHECK (auth.uid() = user_id);
    DROP POLICY IF EXISTS "Users can unlike posts" ON public.likes;
    CREATE POLICY "Users can unlike posts" ON public.likes FOR DELETE USING (auth.uid() = user_id);

    -- Saves
    DROP POLICY IF EXISTS "Users can view own saves" ON public.saves;
    CREATE POLICY "Users can view own saves" ON public.saves FOR SELECT USING (auth.uid() = user_id);
    DROP POLICY IF EXISTS "Users can save posts" ON public.saves;
    CREATE POLICY "Users can save posts" ON public.saves FOR INSERT WITH CHECK (auth.uid() = user_id);
    DROP POLICY IF EXISTS "Users can unsave posts" ON public.saves;
    CREATE POLICY "Users can unsave posts" ON public.saves FOR DELETE USING (auth.uid() = user_id);

    -- Comments
    DROP POLICY IF EXISTS "Public comments are viewable" ON public.comments;
    CREATE POLICY "Public comments are viewable" ON public.comments FOR SELECT USING (true);
    DROP POLICY IF EXISTS "Users can comment" ON public.comments;
    CREATE POLICY "Users can comment" ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);

    -- Follows
    DROP POLICY IF EXISTS "Public follows are viewable" ON public.follows;
    CREATE POLICY "Public follows are viewable" ON public.follows FOR SELECT USING (true);
    DROP POLICY IF EXISTS "Users can follow" ON public.follows;
    CREATE POLICY "Users can follow" ON public.follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
    DROP POLICY IF EXISTS "Users can unfollow" ON public.follows;
    CREATE POLICY "Users can unfollow" ON public.follows FOR DELETE USING (auth.uid() = follower_id);

    -- Stories
    DROP POLICY IF EXISTS "Public stories are viewable" ON public.stories;
    CREATE POLICY "Public stories are viewable" ON public.stories FOR SELECT USING (true);
    DROP POLICY IF EXISTS "Users can insert own stories" ON public.stories;
    CREATE POLICY "Users can insert own stories" ON public.stories FOR INSERT WITH CHECK (auth.uid() = user_id);

    -- Messages
    DROP POLICY IF EXISTS "Users can view own messages" ON public.messages;
    CREATE POLICY "Users can view own messages" ON public.messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
    DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
    CREATE POLICY "Users can send messages" ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
END $$;

-- 10. ULTRA-ROBUST SIGNUP TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  dob_str TEXT;
  dob_date DATE;
  counter INTEGER := 0;
BEGIN
  -- 1. Extract and sanitize base username
  base_username := COALESCE(
    NEW.raw_user_meta_data->>'username', 
    SPLIT_PART(NEW.email, '@', 1)
  );
  
  -- Clean username: lower, alphanumeric + underscore only
  base_username := lower(regexp_replace(base_username, '[^a-z0-9_]', '', 'g'));
  
  -- Fallback if empty
  IF base_username = '' THEN
    base_username := 'vix_' || floor(random() * 100000)::text;
  END IF;

  final_username := base_username;

  -- 2. Handle username collisions (loop up to 20 times)
  WHILE counter < 20 AND EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    counter := counter + 1;
    final_username := base_username || floor(random() * 9999)::text;
  END LOOP;

  -- 3. Safe Date Conversion
  dob_str := NEW.raw_user_meta_data->>'date_of_birth';
  IF dob_str IS NOT NULL AND dob_str <> '' THEN
    BEGIN
      dob_date := dob_str::DATE;
    EXCEPTION WHEN OTHERS THEN
      dob_date := NULL;
    END;
  ELSE
    dob_date := NULL;
  END IF;

  -- 4. Atomic Profile Creation
  BEGIN
    INSERT INTO public.profiles (
      id, 
      username, 
      full_name, 
      avatar_url, 
      email, 
      date_of_birth
    )
    VALUES (
      NEW.id,
      final_username,
      COALESCE(NEW.raw_user_meta_data->>'full_name', final_username),
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.email,
      dob_date
    )
    ON CONFLICT (id) DO UPDATE SET
      username = EXCLUDED.username,
      full_name = EXCLUDED.full_name,
      avatar_url = EXCLUDED.avatar_url,
      email = EXCLUDED.email,
      date_of_birth = EXCLUDED.date_of_birth,
      updated_at = now();
  EXCEPTION WHEN OTHERS THEN
    -- If profile creation fails, we still return NEW so the Auth user is created.
    -- This avoids the "Database error saving new user" fatal crash for the user.
    RAISE LOG 'VixReel profile creation failed for user %: %', NEW.id, SQLERRM;
  END;
    
  RETURN NEW;
END;
$$;

-- Re-establish Trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

NOTIFY pgrst, 'reload schema';
