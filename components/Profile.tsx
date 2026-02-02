
import React, { useState, useEffect } from 'react';
import { Grid, Heart, Camera, Play, Video, Settings, User as UserIcon, Loader2, X, Check } from 'lucide-react';
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
  const [isUpdating, setIsUpdating] = useState(false);
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState(user.full_name || '');
  const [editBio, setEditBio] = useState(user.bio || '');
  const [isSaving, setIsSaving] = useState(false);

  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [listType, setListType] = useState<'Followers' | 'Following'>('Followers');
  const [listUsers, setListUsers] = useState<UserProfile[]>([]);
  const [listLoading, setListLoading] = useState(false);

  useEffect(() => {
    fetchUserContent();
    setEditName(user.full_name || '');
    setEditBio(user.bio || '');

    // Reactive verification updates from Admin
    const handleUpdate = (e: any) => {
      if (e.detail.id === user.id) {
        onUpdateProfile({ is_verified: e.detail.is_verified });
      }
    };
    window.addEventListener('vixreel-user-updated', handleUpdate);
    return () => window.removeEventListener('vixreel-user-updated', handleUpdate);
  }, [user.id, user.full_name, user.bio]);

  const fetchUserContent = async () => {
    setIsUpdating(true);
    const { data: pData, count: pCount } = await supabase
      .from('posts')
      .select('*, user:profiles(*)', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (pData) setPosts(pData as any);
    
    const { count: fCount } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', user.id);
    const { count: ingCount } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', user.id);
    
    setCounts({ posts: pCount || 0, followers: fCount || 0, following: ingCount || 0 });

    const { data: { session } } = await supabase.auth.getSession();
    if (session && !isOwnProfile) {
      const { data } = await supabase.from('follows').select('*').eq('follower_id', session.user.id).eq('following_id', user.id).single();
      setIsFollowing(!!data);
    }
    setIsUpdating(false);
  };

  const handleFollow = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    
    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);
    setCounts(prev => ({ ...prev, followers: wasFollowing ? Math.max(0, prev.followers - 1) : prev.followers + 1 }));

    try {
      if (wasFollowing) {
        await supabase.from('follows').delete().eq('follower_id', session.user.id).eq('following_id', user.id);
      } else {
        await supabase.from('follows').insert({ follower_id: session.user.id, following_id: user.id });
      }
    } catch (err) {
      setIsFollowing(wasFollowing);
      setCounts(prev => ({ ...prev, followers: wasFollowing ? prev.followers + 1 : Math.max(0, prev.followers - 1) }));
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: editName, bio: editBio })
      .eq('id', user.id);
    
    if (!error) {
      onUpdateProfile({ full_name: editName, bio: editBio });
      setIsEditModalOpen(false);
    }
    setIsSaving(false);
  };

  const fetchListUsers = async (type: 'Followers' | 'Following') => {
    setListLoading(true);
    setListType(type);
    setIsListModalOpen(true);
    let query;
    if (type === 'Followers') {
      query = supabase.from('follows').select('profiles:follower_id(*)').eq('following_id', user.id);
    } else {
      query = supabase.from('follows').select('profiles:following_id(*)').eq('follower_id', user.id);
    }
    const { data, error } = await query;
    if (!error && data) {
      setListUsers(data.map((item: any) => item.profiles));
    }
    setListLoading(false);
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
    <div className="max-w-[935px] mx-auto py-6 sm:py-12 px-4 animate-vix-in pb-20">
      <div className="flex flex-col md:flex-row items-center md:items-start gap-8 md:gap-20 mb-10 sm:mb-16">
        <div className="relative w-28 h-28 sm:w-40 sm:h-40 shrink-0">
          <div className={`w-full h-full rounded-full p-1 vix-gradient ${isUploadingAvatar ? 'animate-pulse' : ''} shadow-2xl shadow-pink-500/20`}>
            <div className="w-full h-full rounded-full bg-black p-1.5 overflow-hidden">
              {user.avatar_url ? (
                <img src={user.avatar_url} className="w-full h-full rounded-full object-cover" alt={user.username} />
              ) : (
                <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-zinc-800 rounded-full">
                  <UserIcon className="w-12 h-12" />
                </div>
              )}
            </div>
          </div>
          {isOwnProfile && (
            <label className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 hover:opacity-100 cursor-pointer transition-opacity border-2 border-white/20 backdrop-blur-sm">
              <Camera className="w-8 h-8 text-white" />
              <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
            </label>
          )}
        </div>

        <div className="flex-1 space-y-6 text-center md:text-left w-full">
          <div className="flex flex-col sm:flex-row items-center gap-5 sm:gap-8">
            <h2 className="text-2xl font-black flex items-center gap-1.5">
              {user.username}
              {user.is_verified && <VerificationBadge size="w-6 h-6" />}
            </h2>
            <div className="flex gap-2 w-full sm:w-auto">
              {isOwnProfile ? (
                <>
                  <button onClick={() => setIsEditModalOpen(true)} className="flex-1 sm:flex-none bg-zinc-900 px-6 py-2.5 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest border border-zinc-800 hover:bg-zinc-800 transition-all">Edit Journey</button>
                  <button className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-2xl hover:bg-zinc-800 transition-all"><Settings className="w-4 h-4 text-zinc-500" /></button>
                </>
              ) : (
                <>
                  <button onClick={handleFollow} className={`flex-1 sm:flex-none px-8 py-2.5 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all shadow-xl ${isFollowing ? 'bg-zinc-900 border border-zinc-800 text-zinc-500' : 'vix-gradient text-white shadow-pink-500/20'}`}>
                    {isFollowing ? 'Connected' : 'Connect'}
                  </button>
                  <button onClick={() => onMessageUser?.(user)} className="flex-1 sm:flex-none bg-zinc-900 px-8 py-2.5 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest border border-zinc-800 hover:bg-zinc-800 transition-all">Message</button>
                </>
              )}
            </div>
          </div>

          <div className="flex justify-center md:justify-start gap-10 border-y border-zinc-900/50 py-4 sm:border-none sm:py-0">
            <div className="flex flex-col sm:flex-row gap-1 items-center sm:items-baseline">
              <span className="font-black text-lg">{formatNumber(counts.posts)}</span>
              <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Stories</span>
            </div>
            <button onClick={() => fetchListUsers('Followers')} className="flex flex-col sm:flex-row gap-1 items-center sm:items-baseline group hover:opacity-70 transition-opacity">
              <span className="font-black text-lg">{formatNumber(counts.followers)}</span>
              <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Audiences</span>
            </button>
            <button onClick={() => fetchListUsers('Following')} className="flex flex-col sm:flex-row gap-1 items-center sm:items-baseline group hover:opacity-70 transition-opacity">
              <span className="font-black text-lg">{formatNumber(counts.following)}</span>
              <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Following</span>
            </button>
          </div>

          <div className="text-xs sm:text-sm">
            <div className="font-black text-white mb-1.5 uppercase tracking-wider">{user.full_name || user.username}</div>
            <p className="text-zinc-400 font-medium leading-relaxed max-w-sm mx-auto md:mx-0 whitespace-pre-wrap">{user.bio || 'VixReel Digital Creator • Visual Storytelling'}</p>
          </div>
        </div>
      </div>

      <div className="border-t border-zinc-900 pt-6 sm:pt-10">
        <div className="grid grid-cols-3 gap-1 sm:gap-4">
          {posts.map((post) => (
            <div key={post.id} className="aspect-square bg-zinc-950 relative group cursor-pointer overflow-hidden rounded-sm sm:rounded-xl border border-zinc-900/50 hover:border-zinc-700 transition-all shadow-xl">
              {post.media_type === 'video' ? (
                <div className="w-full h-full relative">
                  <video src={post.media_url} className="w-full h-full object-cover" />
                  <div className="absolute top-2 right-2 p-1.5 bg-black/40 backdrop-blur-md rounded-lg border border-white/10">
                    <Video className="w-3.5 h-3.5 text-white fill-white" />
                  </div>
                </div>
              ) : (
                <img src={post.media_url} className="w-full h-full object-cover" alt="VixReel Story" />
              )}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-6 transition-all backdrop-blur-sm">
                <div className="flex flex-col items-center gap-1.5 font-black text-white text-sm sm:text-base">
                  <Heart className="w-5 h-5 sm:w-6 sm:h-6 fill-white text-white" /> 
                  {formatNumber((post.likes_count || 0) + (post.boosted_likes || 0))}
                </div>
              </div>
            </div>
          ))}
          {posts.length === 0 && !isUpdating && (
            <div className="col-span-3 py-20 sm:py-32 text-center flex flex-col items-center gap-6">
              <div className="w-20 h-20 rounded-[2rem] border-2 border-dashed border-zinc-800 flex items-center justify-center">
                 <Camera className="w-8 h-8 text-zinc-800" />
              </div>
              <div className="space-y-2">
                <p className="text-zinc-500 font-black uppercase tracking-[0.3em] text-[10px] sm:text-xs">No Visual Artifacts</p>
                <p className="text-zinc-700 text-[10px] font-bold">Start your VixReel narrative today.</p>
              </div>
            </div>
          )}
          {isUpdating && <div className="col-span-3 py-20 flex justify-center"><Loader2 className="w-8 h-8 text-zinc-800 animate-spin" /></div>}
        </div>
      </div>

      {isEditModalOpen && (
        <div className="fixed inset-0 z-[1000] bg-black/90 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-900 rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in duration-300">
            <div className="p-6 border-b border-zinc-900 flex justify-between items-center">
              <h3 className="font-black uppercase tracking-widest text-xs">Modify Journey</h3>
              <button onClick={() => setIsEditModalOpen(false)}><X className="w-5 h-5 text-zinc-500" /></button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="text-[10px] font-black uppercase text-zinc-600 block mb-2 tracking-widest">Full Presence Name</label>
                <input value={editName} onChange={e => setEditName(e.target.value)} className="w-full bg-black border border-zinc-900 rounded-2xl px-5 py-4 text-sm outline-none focus:border-pink-500/40 transition-all text-white" placeholder="e.g. Alex Rivera" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-zinc-600 block mb-2 tracking-widest">Creative Bio</label>
                <textarea value={editBio} onChange={e => setEditBio(e.target.value)} className="w-full h-32 bg-black border border-zinc-900 rounded-2xl px-5 py-4 text-sm outline-none focus:border-pink-500/40 transition-all resize-none text-white" placeholder="Tell your story..." />
              </div>
              <button onClick={handleSaveProfile} disabled={isSaving} className="w-full vix-gradient py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-pink-500/10 flex items-center justify-center gap-2">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Sync Updates
              </button>
            </div>
          </div>
        </div>
      )}

      {isListModalOpen && (
        <div className="fixed inset-0 z-[1000] bg-black/90 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-900 rounded-[2rem] w-full max-w-md h-[60vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in duration-300">
            <div className="p-6 border-b border-zinc-900 flex justify-between items-center">
              <h3 className="font-black uppercase tracking-widest text-xs">{listType}</h3>
              <button onClick={() => setIsListModalOpen(false)}><X className="w-5 h-5 text-zinc-500" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 no-scrollbar">
              {listLoading ? <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-zinc-800" /></div> : listUsers.length > 0 ? listUsers.map(u => (
                  <div key={u.id} className="flex items-center justify-between p-3 rounded-2xl hover:bg-zinc-900/40 transition-all cursor-pointer">
                    <div className="flex items-center gap-3">
                      <img src={u.avatar_url || `https://ui-avatars.com/api/?name=${u.username}`} className="w-10 h-10 rounded-full object-cover border border-zinc-900" />
                      <div>
                        <div className="font-bold text-sm flex items-center text-white">{u.username} {u.is_verified && <VerificationBadge size="w-3 h-3" />}</div>
                        <div className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">{u.full_name || 'Individual Creator'}</div>
                      </div>
                    </div>
                    <button onClick={() => { setIsListModalOpen(false); if(u.id !== user.id) onMessageUser?.(u); }} className="bg-zinc-800 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-white">View</button>
                  </div>
                )) : <div className="flex flex-col items-center justify-center py-20 text-zinc-800"><UserIcon className="w-10 h-10 mb-4" /><p className="font-black uppercase tracking-widest text-[10px]">No audience found</p></div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
