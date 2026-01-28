
import React, { useState, useEffect } from 'react';
import { Grid, Heart, Camera, Play, User as UserIcon } from 'lucide-react';
import { UserProfile, Post as PostType } from '../types';
import { supabase } from '../lib/supabase';
import { formatNumber, sanitizeFilename } from '../lib/utils';
import VerificationBadge from './VerificationBadge';

interface ProfileProps {
  user: UserProfile;
  isOwnProfile: boolean;
  onUpdateProfile: (updates: Partial<UserProfile>) => void;
  onMessageUser?: (user: UserProfile) => void;
  onViewProfile?: (user: UserProfile) => void;
}

const Profile: React.FC<ProfileProps> = ({ user, isOwnProfile, onUpdateProfile, onMessageUser }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ username: user.username, bio: user.bio || '', full_name: user.full_name || '' });
  const [posts, setPosts] = useState<PostType[]>([]);
  const [counts, setCounts] = useState({ posts: 0, followers: 0, following: 0 });
  const [isFollowing, setIsFollowing] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  useEffect(() => {
    fetchUserContent();
  }, [user.id, user.is_verified]);

  const fetchUserContent = async () => {
    const { data: pData, count } = await supabase
      .from('posts')
      .select('*, user:profiles(*)', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (pData) {
      setPosts(pData as any);
      setCounts(prev => ({ ...prev, posts: count || 0 }));
    }

    const { count: fCount } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', user.id);
    const { count: ingCount } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', user.id);
    setCounts(prev => ({ ...prev, followers: fCount || 0, following: ingCount || 0 }));

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
      setCounts(prev => ({ ...prev, followers: prev.followers - 1 }));
    } else {
      await supabase.from('follows').insert({ follower_id: session.user.id, following_id: user.id });
      setIsFollowing(true);
      setCounts(prev => ({ ...prev, followers: prev.followers + 1 }));
    }
  };

  const handleUpdate = async () => {
    const { error } = await supabase.from('profiles').update(editData).eq('id', user.id);
    if (!error) {
      onUpdateProfile(editData);
      setIsEditing(false);
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
      <div className="flex flex-col md:flex-row items-center md:items-start gap-10 md:gap-24 mb-16">
        <div className="relative w-32 h-32 md:w-44 md:h-44 flex-shrink-0">
          <div className={`w-full h-full rounded-full p-1 vix-gradient ${isUploadingAvatar ? 'animate-pulse' : ''}`}>
            <div className="w-full h-full rounded-full bg-black p-1 overflow-hidden">
              <img src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.username}`} className="w-full h-full rounded-full object-cover" alt={user.username} />
            </div>
          </div>
          {isOwnProfile && (
            <label className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 hover:opacity-100 cursor-pointer transition-opacity">
              <Camera className="w-10 h-10 text-white" />
              <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
            </label>
          )}
        </div>

        <div className="flex-1 space-y-6 text-center md:text-left">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <h2 className="text-2xl font-black flex items-center justify-center md:justify-start">
              {user.username}
              {user.is_verified && <VerificationBadge size="w-5 h-5" />}
            </h2>
            <div className="flex gap-2">
              {isOwnProfile ? (
                <button onClick={() => setIsEditing(!isEditing)} className="bg-zinc-900 px-6 py-2 rounded-lg text-sm font-bold border border-zinc-800 hover:bg-zinc-800 transition-colors">
                  {isEditing ? 'Cancel' : 'Edit Profile'}
                </button>
              ) : (
                <>
                  <button onClick={handleFollow} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${isFollowing ? 'bg-zinc-900 text-white' : 'vix-gradient text-white hover:opacity-90'}`}>
                    {isFollowing ? 'Following' : 'Follow'}
                  </button>
                  <button onClick={() => onMessageUser?.(user)} className="bg-zinc-900 px-6 py-2 rounded-lg text-sm font-bold hover:bg-zinc-800 transition-colors">Message</button>
                </>
              )}
            </div>
          </div>

          <div className="flex justify-center md:justify-start gap-8">
            <div className="flex flex-col md:flex-row md:gap-1.5 items-center">
              <span className="font-bold text-lg">{formatNumber(counts.posts)}</span>
              <span className="text-zinc-500 text-sm font-medium">posts</span>
            </div>
            <button className="flex flex-col md:flex-row md:gap-1.5 items-center hover:opacity-70 transition-opacity">
              <span className="font-bold text-lg">{formatNumber(counts.followers)}</span>
              <span className="text-zinc-500 text-sm font-medium">followers</span>
            </button>
            <button className="flex flex-col md:flex-row md:gap-1.5 items-center hover:opacity-70 transition-opacity">
              <span className="font-bold text-lg">{formatNumber(counts.following)}</span>
              <span className="text-zinc-500 text-sm font-medium">following</span>
            </button>
          </div>

          <div className="text-sm max-w-sm mx-auto md:mx-0">
            <div className="font-bold text-white mb-1">{user.full_name || user.username}</div>
            <p className="text-zinc-400 whitespace-pre-wrap leading-relaxed">{user.bio || 'Elite VixReel Creator'}</p>
          </div>
        </div>
      </div>

      <div className="border-t border-zinc-900 pt-8">
        <div className="grid grid-cols-3 gap-1 md:gap-6">
          {posts.map((post) => (
            <div key={post.id} className="aspect-square bg-zinc-950 relative group cursor-pointer overflow-hidden rounded-xl border border-white/5 shadow-lg">
              {post.media_type === 'video' ? (
                <div className="w-full h-full relative">
                  <video src={post.media_url} className="w-full h-full object-cover" />
                  <div className="absolute top-3 right-3 p-1.5 bg-black/40 backdrop-blur-md rounded-lg">
                    <Play className="w-4 h-4 text-white fill-white" />
                  </div>
                </div>
              ) : (
                <img src={post.media_url} className="w-full h-full object-cover" alt="Post" />
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-6 transition-all duration-300">
                <div className="flex items-center gap-2 font-bold text-white text-lg">
                  <Heart className="w-6 h-6 fill-white" /> 
                  {formatNumber((post.likes_count || 0) + (post.boosted_likes || 0))}
                </div>
              </div>
            </div>
          ))}
          {posts.length === 0 && (
            <div className="col-span-3 py-24 text-center">
              <div className="w-20 h-20 bg-zinc-900/40 rounded-full flex items-center justify-center mx-auto mb-6">
                <Grid className="w-10 h-10 text-zinc-700" />
              </div>
              <h3 className="text-xl font-bold text-zinc-500 italic">No Visual Stories Yet</h3>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
