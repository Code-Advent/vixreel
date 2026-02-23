-- VIXREEL NARRATIVE PROTOCOL - MASTER SCHEMA V7.0
-- Includes: Profiles, Posts, Interactions (Reposts, Duets, Stitches), 
-- Locations, Stories, Messages, and Communities (Groups)

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
    is_admin BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,
    is_private BOOLEAN DEFAULT FALSE,
    allow_comments BOOLEAN DEFAULT TRUE,
    is_following_public BOOLEAN DEFAULT TRUE,
    boosted_followers INTEGER DEFAULT 0,
    location TEXT,
    is_location_private BOOLEAN DEFAULT FALSE,
    show_followers_to TEXT DEFAULT 'EVERYONE' CHECK (show_followers_to IN ('EVERYONE', 'FOLLOWERS', 'ONLY_ME')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure all profile columns exist (Migration for existing tables)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_location_private BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS show_followers_to TEXT DEFAULT 'EVERYONE' CHECK (show_followers_to IN ('EVERYONE', 'FOLLOWERS', 'ONLY_ME'));

-- 3. LOCATIONS TABLE
CREATE TABLE IF NOT EXISTS public.locations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. POSTS TABLE
CREATE TABLE IF NOT EXISTS public.posts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    media_url TEXT NOT NULL,
    media_type TEXT CHECK (media_type IN ('image', 'video')) NOT NULL,
    caption TEXT,
    boosted_likes INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure all narrative columns exist (Migration for existing tables)
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS reposted_from_id UUID REFERENCES public.posts(id) ON DELETE SET NULL;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS duet_from_id UUID REFERENCES public.posts(id) ON DELETE SET NULL;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS stitch_from_id UUID REFERENCES public.posts(id) ON DELETE SET NULL;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;

-- 5. REPOSTS TABLE
CREATE TABLE IF NOT EXISTS public.reposts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, post_id)
);

-- 6. DUETS TABLE
CREATE TABLE IF NOT EXISTS public.duets (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    original_post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
    duet_post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(duet_post_id)
);

-- 7. STITCHES TABLE
CREATE TABLE IF NOT EXISTS public.stitches (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    original_post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
    stitch_post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(stitch_post_id)
);

-- 8. LIKES TABLE
CREATE TABLE IF NOT EXISTS public.likes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);

-- 9. COMMENTS TABLE
CREATE TABLE IF NOT EXISTS public.comments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. FOLLOWS TABLE
CREATE TABLE IF NOT EXISTS public.follows (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    follower_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    following_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(follower_id, following_id)
);

-- 11. SAVES TABLE
CREATE TABLE IF NOT EXISTS public.saves (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);

-- 12. MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 13. STORIES TABLE
CREATE TABLE IF NOT EXISTS public.stories (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    media_url TEXT NOT NULL,
    media_type TEXT CHECK (media_type IN ('image', 'video')) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- 14. COMMUNITIES (GROUPS) TABLE
CREATE TABLE IF NOT EXISTS public.groups (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    cover_url TEXT,
    privacy TEXT DEFAULT 'PUBLIC' CHECK (privacy IN ('PUBLIC', 'PRIVATE')),
    creator_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 15. GROUP MEMBERS TABLE
CREATE TABLE IF NOT EXISTS public.group_members (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    role TEXT DEFAULT 'MEMBER' CHECK (role IN ('ADMIN', 'MEMBER')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(group_id, user_id)
);

-- 16. GROUP POSTS TABLE
CREATE TABLE IF NOT EXISTS public.group_posts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    media_url TEXT,
    media_type TEXT CHECK (media_type IN ('image', 'video')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 16a. GROUP POST LIKES TABLE
CREATE TABLE IF NOT EXISTS public.group_post_likes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    post_id UUID REFERENCES public.group_posts(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);

-- 16b. GROUP POST COMMENTS TABLE
CREATE TABLE IF NOT EXISTS public.group_post_comments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    post_id UUID REFERENCES public.group_posts(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 17. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reposts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stitches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_post_comments ENABLE ROW LEVEL SECURITY;

-- 18. CLEANUP OLD POLICIES
DO $$ 
DECLARE 
    pol RECORD;
BEGIN
    FOR pol IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- 19. CREATE POLICIES (Public Schema)

-- Profiles
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Locations
CREATE POLICY "Locations are viewable by everyone" ON public.locations FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert locations" ON public.locations FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Posts
CREATE POLICY "Posts are viewable by everyone" ON public.posts FOR SELECT USING (true);
CREATE POLICY "Users can insert own posts" ON public.posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own posts" ON public.posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own posts" ON public.posts FOR DELETE USING (auth.uid() = user_id);

-- Reposts, Duets, Stitches
CREATE POLICY "Reposts viewable by everyone" ON public.reposts FOR SELECT USING (true);
CREATE POLICY "Users can insert own reposts" ON public.reposts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Duets viewable by everyone" ON public.duets FOR SELECT USING (true);
CREATE POLICY "Users can insert own duets" ON public.duets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Stitches viewable by everyone" ON public.stitches FOR SELECT USING (true);
CREATE POLICY "Users can insert own stitches" ON public.stitches FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Likes & Comments
CREATE POLICY "Likes are viewable by everyone" ON public.likes FOR SELECT USING (true);
CREATE POLICY "Users can insert own likes" ON public.likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own likes" ON public.likes FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Comments are viewable by everyone" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Users can insert own comments" ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Follows
CREATE POLICY "Follows are viewable by everyone" ON public.follows FOR SELECT USING (true);
CREATE POLICY "Users can insert own follows" ON public.follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users can delete own follows" ON public.follows FOR DELETE USING (auth.uid() = follower_id);

-- Messages
CREATE POLICY "Messages are viewable by participants" ON public.messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can insert own messages" ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Stories
CREATE POLICY "Stories are viewable by everyone" ON public.stories FOR SELECT USING (true);
CREATE POLICY "Users can insert own stories" ON public.stories FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Groups
CREATE POLICY "Groups are viewable by everyone" ON public.groups FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create groups" ON public.groups FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Creators can update their groups" ON public.groups FOR UPDATE USING (auth.uid() = creator_id);

-- Group Members
CREATE POLICY "Group members are viewable by everyone" ON public.group_members FOR SELECT USING (true);
CREATE POLICY "Users can join groups" ON public.group_members FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can leave groups" ON public.group_members FOR DELETE USING (auth.uid() = user_id);

-- Group Posts
CREATE POLICY "Group posts are viewable by everyone" ON public.group_posts FOR SELECT USING (true);
CREATE POLICY "Members can post in groups" ON public.group_posts FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.group_members 
        WHERE group_id = group_posts.group_id AND user_id = auth.uid()
    )
);
CREATE POLICY "Users can delete own group posts" ON public.group_posts FOR DELETE USING (auth.uid() = user_id);

-- Group Post Likes
CREATE POLICY "Group post likes are viewable by everyone" ON public.group_post_likes FOR SELECT USING (true);
CREATE POLICY "Users can insert own group post likes" ON public.group_post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own group post likes" ON public.group_post_likes FOR DELETE USING (auth.uid() = user_id);

-- Group Post Comments
CREATE POLICY "Group post comments are viewable by everyone" ON public.group_post_comments FOR SELECT USING (true);
CREATE POLICY "Users can insert own group post comments" ON public.group_post_comments FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 20. STORAGE BUCKETS CONFIGURATION
INSERT INTO storage.buckets (id, name, public) VALUES ('posts', 'posts', true) ON CONFLICT (id) DO UPDATE SET public = true;
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO UPDATE SET public = true;
INSERT INTO storage.buckets (id, name, public) VALUES ('stories', 'stories', true) ON CONFLICT (id) DO UPDATE SET public = true;

-- 21. CLEANUP OLD STORAGE POLICIES
DO $$ 
DECLARE 
    pol RECORD;
BEGIN
    FOR pol IN (SELECT policyname FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects') 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
    END LOOP;
END $$;

-- 22. CREATE STORAGE POLICIES
CREATE POLICY "Public Access to Posts" ON storage.objects FOR SELECT USING (bucket_id = 'posts');
CREATE POLICY "Authenticated Upload to Posts" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'posts' AND auth.role() = 'authenticated');
CREATE POLICY "Owner Delete from Posts" ON storage.objects FOR DELETE USING (bucket_id = 'posts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Public Access to Avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Authenticated Upload to Avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
CREATE POLICY "Owner Delete from Avatars" ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Public Access to Stories" ON storage.objects FOR SELECT USING (bucket_id = 'stories');
CREATE POLICY "Authenticated Upload to Stories" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'stories' AND auth.role() = 'authenticated');
CREATE POLICY "Owner Delete from Stories" ON storage.objects FOR DELETE USING (bucket_id = 'stories' AND auth.uid()::text = (storage.foldername(name))[1]);
