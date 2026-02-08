-- VixReel Core Schema Initialization

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  email TEXT,
  phone TEXT,
  phone_verified BOOLEAN DEFAULT false,
  date_of_birth DATE,
  is_admin BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. ENSURE ALL COLUMNS EXIST
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;

-- 3. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. RLS POLICIES
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
    CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
    
    DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
    CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

    DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
    CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
END $$;

-- 5. AUTOMATIC PHONE CONFIRMATION (Critical for Prototype Phone Login)
-- This ensures that users created via Phone + Password can log in immediately.
CREATE OR REPLACE FUNCTION public.auto_confirm_auth_phone()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.phone IS NOT NULL AND NEW.phone_confirmed_at IS NULL THEN
    UPDATE auth.users SET phone_confirmed_at = now() WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_confirm ON auth.users;
CREATE TRIGGER on_auth_user_created_confirm
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auto_confirm_auth_phone();

-- 6. AUTOMATIC PROFILE CREATION TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  default_username TEXT;
BEGIN
  -- Generate a default username if metadata is missing
  IF (NEW.raw_user_meta_data->>'username') IS NOT NULL THEN
    default_username := NEW.raw_user_meta_data->>'username';
  ELSIF NEW.email IS NOT NULL THEN
    default_username := split_part(NEW.email, '@', 1);
  ELSIF NEW.phone IS NOT NULL THEN
    default_username := 'user_' || right(NEW.phone, 4) || substr(NEW.id::text, 1, 4);
  ELSE
    default_username := 'user_' || substr(NEW.id::text, 1, 8);
  END IF;

  INSERT INTO public.profiles (
    id, 
    username, 
    full_name, 
    email, 
    phone, 
    phone_verified, 
    date_of_birth,
    is_admin, 
    is_verified
  )
  VALUES (
    NEW.id,
    default_username,
    COALESCE(NEW.raw_user_meta_data->>'full_name', default_username),
    NEW.email,
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone'),
    COALESCE((NEW.raw_user_meta_data->>'phone_verified')::BOOLEAN, NEW.phone_confirmed_at IS NOT NULL),
    (NEW.raw_user_meta_data->>'date_of_birth')::DATE,
    COALESCE((NEW.email = 'davidhen498@gmail.com'), false),
    COALESCE((NEW.email = 'davidhen498@gmail.com'), false)
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    phone_verified = EXCLUDED.phone_verified,
    updated_at = now();
  
  RETURN NEW;
EXCEPTION 
  WHEN OTHERS THEN
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. BIND PROFILE TRIGGER
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. REFRESH SCHEMA CACHE
NOTIFY pgrst, 'reload schema';