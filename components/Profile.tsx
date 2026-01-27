
import React, { useState, useEffect } from 'react';
import { Settings, Grid, Bookmark, UserSquare, Heart, MessageCircle, User as UserIcon, Camera, MoreVertical, LogOut, RefreshCcw, X, Trash2, Loader2 } from 'lucide-react';
import { UserProfile, Post as PostType } from '../types';
import { supabase } from '../lib/supabase';
import { formatNumber } from '../lib/utils';
import VerificationBadge from './VerificationBadge';

interface ProfileProps {
  user: UserProfile;
  isOwnProfile: boolean;
  onUpdateProfile: (updates: Partial<UserProfile>) => void;
}

const Profile: React.FC<ProfileProps> = ({ user, isOwnProfile, onUpdateProfile }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ username: user.username, bio: user.bio || '', full_name: user.full_name || '' });
  const [posts, setPosts] = useState<PostType[]>([]);
  const [counts, setCounts] = useState({ posts: 0, followers: 0, following: 0 });
  const [showStatsModal, setShowStatsModal] = useState<'followers' | 'following' | null>(null);
  const [statUsers, setStatUsers] = useState<UserProfile[]>([]);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetchUserContent();
    if (isOwnProfile) {
      const stored = JSON.parse(localStorage.getItem('vixreel_accounts') || '[]');
      setSessions(stored);
    }
  }, [user.id, isOwnProfile]);

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

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    
    // Consistent pathing: user_id/filename
    const fileName = `${Date.now()}-${file.name}`;
    const filePath = `${user.id}/${fileName}`;

    try {
      // Use the dedicated 'avatars' bucket
      const { data, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
      
      if (updateError) throw updateError;
      
      onUpdateProfile({ avatar_url: publicUrl });
    } catch (err: any) {
      alert("Avatar upload failed: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleLogout = async () => {
    const stored = JSON.parse(localStorage.getItem('vixreel_accounts') || '[]');
    const filtered = stored.filter((s: any) => s.user.id !== user.id);
    localStorage.setItem('vixreel_accounts', JSON.stringify(filtered));
    await supabase.auth.signOut();
    window.location.reload();
  };

  return (
    <div className="max-w-[935px] mx-auto py-8 px-4 relative">
      <div className="absolute top-8 right-4 flex gap-4">
        {isOwnProfile && (
           <button onClick={() => setShowAccountMenu(true)} className="p-2 hover:bg-zinc-900 rounded-full transition-colors">
            <MoreVertical className="w-6 h-6" />
           </button>
        )}
      </div>

      {showAccountMenu && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowAccountMenu(false)}>
          <div className="w-full max-w-md bg-zinc-900 rounded-t-2xl p-6 space-y-4 animate-in slide-in-from-bottom duration-300" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
              <h3 className="text-xl font-bold">Settings</h3>
              <X onClick={() => setShowAccountMenu(false)} className="cursor-pointer" />
            </div>
            <div className="space-y-1">
              <button onClick={handleLogout} className="w-full p-4 flex items-center gap-3 hover:bg-zinc-800 rounded-xl text-stone-400 font-bold transition-colors">
                <LogOut className="w-5 h-5" /> Logout from VixReel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row items-center md:items-start gap-8 md:gap-20 mb-12">
        <div className="relative group w-24 h-24 md:w-40 md:h-40">
          <div className={`w-full h-full rounded-full p-1 ${isUploading ? 'animate-pulse' : ''} vix-gradient`}>
            <div className="w-full h-full rounded-full bg-black p-1 overflow-hidden relative">
              {user.avatar_url ? (
                <img src={user.avatar_url} className="w-full h-full rounded-full object-cover" />
              ) : (
                <div className="w-full h-full rounded-full bg-zinc-900 flex items-center justify-center">
                  <UserIcon className="w-12 h-12 text-stone-600" />
                </div>
              )}
              {isUploading && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                </div>
              )}
            </div>
          </div>
          {isOwnProfile && !isUploading && (
            <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
              <Camera className="w-8 h-8" />
              <input type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} />
            </label>
          )}
        </div>

        <div className="flex-1 space-y-6">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <h2 className="text-xl font-semibold flex items-center gap-1">
              {user.username} {user.is_verified && <VerificationBadge />}
            </h2>
            <div className="flex gap-2">
              {isOwnProfile ? (
                <button onClick={() => setIsEditing(!isEditing)} className="bg-zinc-800 hover:bg-zinc-700 px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors">
                  {isEditing ? 'Cancel' : 'Edit Profile'}
                </button>
              ) : (
                <button className="vix-gradient px-6 py-1.5 rounded-lg text-sm font-semibold">Follow</button>
              )}
            </div>
          </div>

          <div className="flex gap-8 text-sm md:text-base">
            <div><span className="font-bold">{formatNumber(counts.posts)}</span> posts</div>
            <div className="cursor-pointer" onClick={() => setShowStatsModal('followers')}>
              <span className="font-bold">{formatNumber(counts.followers)}</span> followers
            </div>
            <div className="cursor-pointer" onClick={() => setShowStatsModal('following')}>
              <span className="font-bold">{formatNumber(counts.following)}</span> following
            </div>
          </div>

          <div className="max-w-md">
            <div className="font-bold">{user.full_name || user.username}</div>
            {isEditing ? (
              <div className="mt-4 space-y-4 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
                <input 
                  value={editData.username} 
                  onChange={e => setEditData({...editData, username: e.target.value})}
                  className="w-full bg-black border border-zinc-800 rounded p-2 text-sm outline-none mt-1"
                  placeholder="@username"
                />
                <textarea 
                  value={editData.bio} 
                  onChange={(e) => setEditData({...editData, bio: e.target.value})}
                  className="w-full bg-black border border-zinc-800 rounded p-2 text-sm outline-none h-20 resize-none"
                  placeholder="Bio..."
                />
                <button onClick={handleUpdate} className="vix-gradient w-full py-2 rounded-lg text-xs font-bold">Save Changes</button>
              </div>
            ) : (
              <div className="text-stone-300 text-sm whitespace-pre-wrap mt-1">{user.bio || "No bio yet."}</div>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-zinc-800 mt-10">
        <div className="flex justify-center gap-12 -mt-[1px]">
          <div className="border-t border-white flex items-center gap-2 py-4 cursor-pointer text-xs font-bold uppercase tracking-widest">
            <Grid className="w-4 h-4" /> Posts
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1 md:gap-4 mt-4">
          {posts.map((post) => (
            <div key={post.id} className="aspect-square bg-zinc-900 relative group cursor-pointer overflow-hidden rounded-md">
              {post.media_type === 'video' ? (
                <video src={post.media_url} className="w-full h-full object-cover" />
              ) : (
                <img src={post.media_url} className="w-full h-full object-cover" />
              )}
              <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                 <div className="flex items-center gap-1"><Heart className="w-5 h-5 fill-white" /> <span className="font-bold text-sm">{(post.likes_count || 0) + (post.boosted_likes || 0)}</span></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Profile;
