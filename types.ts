
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
  location?: string;
  is_location_private?: boolean;
  show_followers_to?: 'EVERYONE' | 'FOLLOWERS' | 'ONLY_ME';
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
  reposted_from_id?: string;
  reposted_from?: Post;
  duet_from_id?: string;
  duet_from?: Post;
  stitch_from_id?: string;
  stitch_from?: Post;
  location_name?: string;
  feeling?: string;
  privacy?: 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE';
  allow_comments?: boolean;
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

export interface Group {
  id: string;
  name: string;
  description: string;
  cover_url: string;
  privacy: 'PUBLIC' | 'PRIVATE';
  creator_id: string;
  only_admin_can_post?: boolean;
  is_verified?: boolean;
  boosted_members?: number;
  created_at: string;
  updated_at: string;
  creator?: UserProfile;
  member_count?: number;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: 'ADMIN' | 'MEMBER';
  joined_at: string;
  user?: UserProfile;
}

export interface GroupPost {
  id: string;
  group_id: string;
  user_id: string;
  content: string;
  media_url?: string;
  media_type?: 'image' | 'video';
  created_at: string;
  user?: UserProfile;
  likes_count?: number;
  comments_count?: number;
  is_liked?: boolean;
  reactions?: GroupPostReaction[];
}

export interface GroupPostLike {
  id: string;
  post_id: string;
  user_id: string;
  created_at: string;
}

export interface GroupPostComment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user?: UserProfile;
}

export interface GroupPostReaction {
  id: string;
  post_id: string;
  user_id: string;
  reaction: string;
  created_at: string;
  user?: UserProfile;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string | null;
  media_url?: string;
  media_type?: 'image' | 'video';
  created_at: string;
  reactions?: MessageReaction[];
}

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  reaction: string;
  created_at: string;
}

export interface AccountSession {
  id: string;
  username: string;
  avatar_url?: string;
  session_data: any; 
}

export type ViewType = 'FEED' | 'EXPLORE' | 'SEARCH' | 'NOTIFICATIONS' | 'PROFILE' | 'CREATE' | 'REELS' | 'MESSAGES' | 'ADMIN' | 'SETTINGS' | 'GROUPS' | 'GROUP_DETAILS';
