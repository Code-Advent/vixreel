
import React, { useState, useEffect } from 'react';
import { Grid, Heart, Camera, Play, Video } from 'lucide-react';
import { UserProfile, Post as PostType } from '../types';
import { supabase } from '../lib/supabase';
import { formatNumber, sanitizeFilename } from '../lib/utils';
import VerificationBadge from './VerificationBadge';

interface ProfileProps {
  user: UserProfile;
  isOwnProfile: boolean;
  onUpdateProfile: (updates: Partial<UserProfile>) => void;
  onMessageUser?: (user: UserProfile) => void;
}

const Profile: React.FC<ProfileProps> = ({ user, isOwnProfile, onUpdateProfile, onMessageUser }) => {
  const [posts, setPosts] = useState<PostType[]>([]);
  const [counts, setCounts] = useState({ posts: 0, followers: 0, following: 0 });
  const [isFollowing, setIsFollowing] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  useEffect(() => {
    fetchUserContent();
  }, [user.id, user.is_verified]);

  const fetchUserContent = async () => {
    // Fetch user's posts
    const { data: pData, count: pCount } = await supabase
      .from('posts')
      .select('*, user:profiles(*)', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (pData) setPosts(pData as any);
    
    // Live counts for Followers/Following
    const { count: fCount } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', user.id);
    const { count: ingCount } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', user.id);
    
    setCounts({ posts: pCount || 0, followers: fCount || 0, following: ingCount || 0 });

    const { data: { session } } = await supabase.auth.getSession();
    if (session && !isOwnProfile) {
      const { data } = await supabase.from('follows').select('*').eq('follower_id', session.user.id).eq('following_id', user.id).single();
      setIsFollowing(!!data);
    }
  };

  const handleFollow = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', session.user.id).eq('following_id', user.id);
      setIsFollowing(false);
      setCounts(prev => ({ ...prev, followers: Math.max(0, prev.followers - 1) }));
    } else {
      await supabase.from('follows').insert({ follower_id: session.user.id, following_id: user.id });
      setIsFollowing(true);
      setCounts(prev => ({ ...prev, followers: prev.followers + 1 }));
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingAvatar(true);
    const fileName = `${user.id}-${Date.now()}-${sanitizeFilename(file.name)}`;
    const filePath = `avatars/${fileName}`;
    try {
      await supabase.storage.from('avatars').upload(filePath, file);
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
      onUpdateProfile({ avatar_url: publicUrl });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  return (
    <div className="max-w-[935px] mx-auto py-8 md:py-12 px-4 animate-vix-in">
      <div className="flex flex-col md:flex-row items-center md:items-start gap-10 md:gap-20 mb-12">
        <div className="relative w-32 h-32 md:w-40 md:h-40 flex-shrink-0">
          <div className={`w-full h-full rounded-full p-1 vix-gradient ${isUploadingAvatar ? 'animate-pulse' : ''}`}>
            <div className="w-full h-full rounded-full bg-black p-1 overflow-hidden shadow-2xl">
              <img src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.username}`} className="w-full h-full rounded-full object-cover" alt={user.username} />
            </div>
          </div>
          {isOwnProfile && (
            <label className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 hover:opacity-100 cursor-pointer transition-opacity">
              <Camera className="w-8 h-8 text-white" />
              <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
            </label>
          )}
        </div>

        <div className="flex-1 space-y-6 text-center md:text-left">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <h2 className="text-xl font-bold flex items-center">
              {user.username}
              {user.is_verified && <VerificationBadge size="w-5 h-5" />}
            </h2>
            <div className="flex gap-2">
              {isOwnProfile ? (
                <button className="bg-zinc-900 px-6 py-2 rounded-lg text-sm font-bold border border-zinc-800 hover:bg-zinc-800 transition-colors">Edit Profile</button>
              ) : (
                <>
                  <button onClick={handleFollow} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${isFollowing ? 'bg-zinc-900 border border-zinc-800' : 'vix-gradient text-white shadow-lg'}`}>
                    {isFollowing ? 'Following' : 'Follow'}
                  </button>
                  <button onClick={() => onMessageUser?.(user)} className="bg-zinc-900 px-6 py-2 rounded-lg text-sm font-bold border border-zinc-800 hover:bg-zinc-800 transition-colors">Message</button>
                </>
              )}
            </div>
          </div>

          <div className="flex justify-center md:justify-start gap-8">
            <div className="flex gap-1 items-baseline">
              <span className="font-bold">{formatNumber(counts.posts)}</span>
              <span className="text-zinc-400 text-sm">posts</span>
            </div>
            <button className="flex gap-1 items-baseline hover:opacity-70 transition-opacity">
              <span className="font-bold">{formatNumber(counts.followers)}</span>
              <span className="text-zinc-400 text-sm">followers</span>
            </button>
            <button className="flex gap-1 items-baseline hover:opacity-70 transition-opacity">
              <span className="font-bold">{formatNumber(counts.following)}</span>
              <span className="text-zinc-400 text-sm">following</span>
            </button>
          </div>

          <div className="text-sm">
            <div className="font-bold text-white mb-1">{user.full_name || user.username}</div>
            <p className="text-zinc-300">{user.bio || 'Premium VixReel Creator'}</p>
          </div>
        </div>
      </div>

      <div className="border-t border-zinc-900 pt-8">
        <div className="grid grid-cols-3 gap-1 md:gap-4">
          {posts.map((post) => (
            <div key={post.id} className="aspect-square bg-zinc-950 relative group cursor-pointer overflow-hidden rounded-sm border border-zinc-900">
              {post.media_type === 'video' ? (
                <div className="w-full h-full relative">
                  <video src={post.media_url} className="w-full h-full object-cover" />
                  <div className="absolute top-2 right-2 p-1 bg-black/40 backdrop-blur-md rounded">
                    <Video className="w-4 h-4 text-white fill-white" />
                  </div>
                </div>
              ) : (
                <img src={post.media_url} className="w-full h-full object-cover" alt="Post" />
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-6 transition-opacity">
                <div className="flex items-center gap-2 font-bold text-white text-lg">
                  <Heart className="w-6 h-6 fill-white" /> 
                  {formatNumber((post.likes_count || 0) + (post.boosted_likes || 0))}
                </div>
              </div>
            </div>
          ))}
          {posts.length === 0 && (
            <div className="col-span-3 py-20 text-center flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full border border-zinc-800 flex items-center justify-center">
                 <Grid className="w-8 h-8 text-zinc-800" />
              </div>
              <p className="text-zinc-600 font-bold uppercase tracking-widest text-xs">No visual stories found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
