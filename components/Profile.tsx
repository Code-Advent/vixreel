
import React, { useState, useEffect } from 'react';
import { Grid, Heart, User as UserIcon, Camera, UserPlus, UserCheck, MessageCircle } from 'lucide-react';
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

const Profile: React.FC<ProfileProps> = ({ user, isOwnProfile, onUpdateProfile, onMessageUser, onViewProfile }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ username: user.username, bio: user.bio || '', full_name: user.full_name || '' });
  const [posts, setPosts] = useState<PostType[]>([]);
  const [counts, setCounts] = useState({ posts: 0, followers: 0, following: 0 });
  const [isFollowing, setIsFollowing] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  useEffect(() => {
    fetchUserContent();
  }, [user.id]);

  const fetchUserContent = async () => {
    // Fetch Posts
    const { data: pData, count } = await supabase
      .from('posts')
      .select('*, user:profiles(*)', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (pData) {
      setPosts(pData as any);
      setCounts(prev => ({ ...prev, posts: count || 0 }));
    }

    // Fetch Follow Counts
    const { count: fCount } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', user.id);
    const { count: ingCount } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', user.id);
    setCounts(prev => ({ ...prev, followers: fCount || 0, following: ingCount || 0 }));

    // Check if following
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
    const { error } = await supabase.from('profiles').update({ 
      username: editData.username, 
      bio: editData.bio,
      full_name: editData.full_name 
    }).eq('id', user.id);
    
    if (!error) {
      onUpdateProfile(editData);
      setIsEditing(false);
    } else {
      alert(error.message);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    const safeFilename = sanitizeFilename(file.name);
    const fileName = `${user.id}-${Date.now()}-${safeFilename}`;
    const filePath = `avatars/${fileName}`;

    try {
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
      if (updateError) throw updateError;

      onUpdateProfile({ avatar_url: publicUrl });
    } catch (err: any) {
      alert("Upload failed: " + err.message);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  return (
    <div className="max-w-[935px] mx-auto py-8 md:py-12 px-4">
      <div className="flex flex-col md:flex-row items-center md:items-start gap-10 md:gap-24 mb-16">
        <div className="relative group w-32 h-32 md:w-44 md:h-44 flex-shrink-0">
          <div className={`w-full h-full rounded-full p-1 vix-gradient shadow-2xl ${isUploadingAvatar ? 'animate-pulse' : ''}`}>
            <div className="w-full h-full rounded-full bg-black p-1.5 overflow-hidden">
              {user.avatar_url ? (
                <img src={user.avatar_url} className="w-full h-full rounded-full object-cover shadow-inner" alt={user.username} />
              ) : (
                <div className="w-full h-full rounded-full bg-zinc-900 flex items-center justify-center">
                  <UserIcon className="w-16 h-16 text-zinc-800" />
                </div>
              )}
            </div>
          </div>
          {isOwnProfile && (
            <label className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-all duration-300">
              <Camera className="w-10 h-10 text-white" />
              <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
            </label>
          )}
        </div>

        <div className="flex-1 space-y-8 text-center md:text-left">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <h2 className="text-3xl font-black tracking-tighter flex items-center gap-2">
              {user.username} {user.is_verified && <VerificationBadge size="w-7 h-7" />}
            </h2>
            <div className="flex gap-4">
              {isOwnProfile ? (
                <button 
                  onClick={() => setIsEditing(!isEditing)} 
                  className="bg-zinc-900 hover:bg-zinc-800 text-white px-10 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border border-zinc-800"
                >
                  {isEditing ? 'Cancel' : 'Edit Profile'}
                </button>
              ) : (
                <>
                  <button 
                    onClick={handleFollow}
                    className={`px-10 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-xl ${isFollowing ? 'bg-zinc-900 text-zinc-500 border border-zinc-800' : 'vix-gradient text-white shadow-pink-500/20'}`}
                  >
                    {isFollowing ? 'Following' : 'Follow'}
                  </button>
                  <button 
                    onClick={() => onMessageUser?.(user)}
                    className="bg-zinc-900 hover:bg-zinc-800 px-10 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 border border-zinc-800"
                  >
                    Message
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="flex justify-center md:justify-start gap-12">
            <div className="flex flex-col items-center md:items-start">
              <span className="font-black text-xl">{formatNumber(counts.posts)}</span>
              <span className="text-zinc-600 font-bold uppercase text-[9px] tracking-widest">Posts</span>
            </div>
            <div className="flex flex-col items-center md:items-start cursor-pointer hover:text-pink-500 transition-colors">
              <span className="font-black text-xl">{formatNumber(counts.followers)}</span>
              <span className="text-zinc-600 font-bold uppercase text-[9px] tracking-widest">Followers</span>
            </div>
            <div className="flex flex-col items-center md:items-start cursor-pointer hover:text-pink-500 transition-colors">
              <span className="font-black text-xl">{formatNumber(counts.following)}</span>
              <span className="text-zinc-600 font-bold uppercase text-[9px] tracking-widest">Following</span>
            </div>
          </div>

          <div className="max-w-md">
            <div className="font-black text-xl text-white mb-2">{user.full_name || user.username}</div>
            {isEditing ? (
              <div className="mt-6 space-y-5 bg-zinc-900/50 p-8 rounded-[2rem] border border-white/5">
                <div>
                   <label className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600 mb-2 block px-1">Display Username</label>
                   <input 
                    value={editData.username} 
                    onChange={e => setEditData({...editData, username: e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, '')})}
                    className="w-full bg-black border border-zinc-800 rounded-xl p-4 text-sm outline-none focus:border-pink-500/30 transition-all"
                    placeholder="@handle"
                  />
                </div>
                <div>
                   <label className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600 mb-2 block px-1">Biography</label>
                   <textarea 
                    value={editData.bio} 
                    onChange={(e) => setEditData({...editData, bio: e.target.value})}
                    className="w-full bg-black border border-zinc-800 rounded-xl p-4 text-sm outline-none h-32 resize-none focus:border-pink-500/30 transition-all"
                    placeholder="Tell your story..."
                  />
                </div>
                <button onClick={handleUpdate} className="vix-gradient w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] shadow-xl shadow-pink-500/20">Update Profile</button>
              </div>
            ) : (
              <div className="text-zinc-400 text-sm leading-relaxed whitespace-pre-wrap font-medium">{user.bio || "No bio yet."}</div>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-zinc-900 pt-6">
        <div className="flex justify-center gap-12 mb-10">
          <button className="flex items-center gap-2 py-2 text-white border-t-2 border-white -mt-[26px] font-black uppercase text-[10px] tracking-widest transition-all">
            <Grid className="w-4 h-4" /> POSTS
          </button>
          <button className="flex items-center gap-2 py-2 text-zinc-600 hover:text-zinc-400 font-black uppercase text-[10px] tracking-widest transition-all">
            <Heart className="w-4 h-4" /> LIKES
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1 md:gap-8">
          {posts.map((post) => (
            <div key={post.id} className="aspect-square bg-zinc-950 relative group cursor-pointer overflow-hidden rounded-3xl border border-white/5 shadow-2xl">
              {post.media_type === 'video' ? (
                <video src={post.media_url} className="w-full h-full object-cover" />
              ) : (
                <img src={post.media_url} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" alt="post" />
              )}
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center gap-6 opacity-0 group-hover:opacity-100 transition-all duration-300">
                 <div className="flex items-center gap-2">
                    <Heart className="w-6 h-6 fill-white text-white drop-shadow-2xl" /> 
                    <span className="font-black text-lg">{(post.likes_count || 0) + (post.boosted_likes || 0)}</span>
                 </div>
              </div>
            </div>
          ))}
          {posts.length === 0 && (
            <div className="col-span-3 py-40 text-center text-zinc-800 flex flex-col items-center gap-6">
               <Grid className="w-16 h-16 opacity-10" />
               <p className="font-black uppercase tracking-[0.4em] text-xs">Awaiting first upload</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
