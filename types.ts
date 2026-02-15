
export interface UserProfile {
  id: string;
  username: string;
  full_name?: string;
  avatar_url?: string;
  cover_url?: string;
  bio?: string;
  email?: string;
  phone?: string;
  phone_verified?: boolean;
  date_of_birth?: string;
  is_admin?: boolean;
  is_verified?: boolean;
  is_private?: boolean;
  allow_comments?: boolean;
  is_following_public?: boolean;
  boosted_followers?: number; 
  created_at?: string;
  updated_at?: string;
}

export interface Post {
  id: string;
  user_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  caption: string;
  boosted_likes?: number;
  created_at: string;
  user: UserProfile;
  likes_count?: number;
  comments_count?: number;
  has_liked?: boolean;
  has_saved?: boolean;
}

export interface Comment {
  id: string;
  content: string;
  created_at: string;
  user: UserProfile;
}

export interface Story {
  id: string;
  user_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  created_at: string;
  expires_at: string;
  user: UserProfile;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
}

export interface AccountSession {
  id: string;
  username: string;
  avatar_url?: string;
  session_data: any; 
}

export type ViewType = 'FEED' | 'EXPLORE' | 'SEARCH' | 'NOTIFICATIONS' | 'PROFILE' | 'CREATE' | 'REELS' | 'MESSAGES' | 'ADMIN';
