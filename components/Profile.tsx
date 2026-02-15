
import React, { useState, useEffect, useRef } from 'react';
import { 
  Grid, Heart, Camera, Settings, User as UserIcon, Loader2, X,
  ShieldCheck, Globe, Lock, EyeOff, Eye, Users, ChevronRight, Trash2,
  MessageSquare, UserCheck, Image as ImageIcon
} from 'lucide-react';
import { UserProfile, Post as PostType } from '../types';
import { supabase } from '../lib/supabase';
import { sanitizeFilename } from '../lib/utils';
import VerificationBadge from './VerificationBadge';

interface ProfileProps {
  user: UserProfile;
  isOwnProfile: boolean;
  onUpdateProfile: (updates: Partial<UserProfile>) => void;
  onMessageUser?: (user: UserProfile) => void;
  onLogout?: () => void;
}

const Profile: React.FC<ProfileProps> = ({ user, isOwnProfile, onUpdateProfile, onMessageUser, onLogout }) => {
  const [posts, setPosts] = useState<PostType[]>([]);
  const [likedPosts, setLikedPosts] = useState<PostType[]>([]);
  const [activeTab, setActiveTab] = useState<'POSTS' | 'LIKES'>('POSTS');
  const [counts, setCounts] = useState({ followers: 0, following: 0, likes: 0 });
  const [isFollowing, setIsFollowing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  
  const [isSocialModalOpen, setIsSocialModalOpen] = useState(false);
  const [socialModalType, setSocialModalType] = useState<'FOLLOWERS' | 'FOLLOWING'>('FOLLOWERS');
  const [socialUsers, setSocialUsers] = useState<UserProfile[]>([]);
  const [socialLoading, setSocialLoading] = useState(false);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [editUsername, setEditUsername] = useState(user.username);
  const [editBio, setEditBio] = useState(user.bio || '');
  const [editAvatarUrl, setEditAvatarUrl] = useState(user.avatar_url);
  const [editCoverUrl, setEditCoverUrl] = useState(user.cover_url);
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [editCoverFile, setEditCoverFile] = useState<File | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [isPrivate, setIsPrivate] = useState(user.is_private || false);
  const [isFollowingPublic, setIsFollowingPublic] = useState(user.is_following_public !== false);
  const [allowComments, setAllowComments] = useState(user.allow_comments !== false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchUserContent();
    setIsPrivate(user.is_private || false);
    setIsFollowingPublic(user.is_following_public !== false);
    setAllowComments(user.allow_comments !== false);

    const handleGlobalDelete = (e: any) => {
      const deletedId = e.detail?.id;
      if (deletedId) {
        setPosts(prev => prev.filter(p => p.id !== deletedId));
        setLikedPosts(prev => prev.filter(p => p.id !== deletedId));
      }
    };

    const handleIdentityUpdate = (e: any) => {
      if (e.detail?.id === user.id) fetchUserContent();
    };

    window.addEventListener('vixreel-post-deleted', handleGlobalDelete);
    window.addEventListener('vixreel-user-updated', handleIdentityUpdate);
    return () => {
      window.removeEventListener('vixreel-post-deleted', handleGlobalDelete);
      window.removeEventListener('vixreel-user-updated', handleIdentityUpdate);
    };
  }, [user.id]);

  const fetchUserContent = async () => {
    setIsUpdating(true);
    try {
      const { data: pData } = await supabase.from('posts').select('*, user:profiles(*)').eq('user_id', user.id).order('created_at', { ascending: false });
      if (pData) setPosts(pData as any);
      const { data: lData } = await supabase.from('likes').select('post:posts(*, user:profiles(*))').eq('user_id', user.id).order('created_at', { ascending: false });
      if (lData) setLikedPosts(lData.map((l: any) => l.post).filter(p => p !== null) as any);
      const { count: fCount } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', user.id);
      const { count: ingCount } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', user.id);
      const { data: freshProfile } = await supabase.from('profiles').select('boosted_followers').eq('id', user.id).maybeSingle();
      const boostedFollowers = freshProfile?.boosted_followers || 0;
      let totalLikes = 0;
      pData?.forEach(post => totalLikes += (post.likes_count || 0) + (post.boosted_likes || 0));
      setCounts({ followers: (fCount || 0) + boostedFollowers, following: ingCount || 0, likes: totalLikes });
      const { data: { session } } = await supabase.auth.getSession();
      if (session && user.id !== session.user.id) {
        const { data } = await supabase.from('follows').select('*').eq('follower_id', session.user.id).eq('following_id', user.id).maybeSingle();
        setIsFollowing(!!data);
      }
    } finally { setIsUpdating(false); }
  };

  const handleToggleSetting = async (key: keyof UserProfile, value: boolean) => {
    if (key === 'is_private') setIsPrivate(value);
    if (key === 'is_following_public') setIsFollowingPublic(value);
    if (key === 'allow_comments') setAllowComments(value);
    try {
      await supabase.from('profiles').update({ [key]: value }).eq('id', user.id);
      onUpdateProfile({ [key]: value });
    } catch (err) { console.error(err); }
  };

  const handleOpenSocial = async (type: 'FOLLOWERS' | 'FOLLOWING') => {
    if (!isOwnProfile && type === 'FOLLOWING' && !user.is_following_public) return;
    setSocialModalType(type);
    setIsSocialModalOpen(true);
    setSocialLoading(true);
    try {
      const { data } = await supabase.from('follows').select(`follower:profiles!follower_id(*), following:profiles!following_id(*)`).eq(type === 'FOLLOWERS' ? 'following_id' : 'follower_id', user.id);
      if (data) {
        const list = data.map((item: any) => type === 'FOLLOWERS' ? item.follower : item.following);
        setSocialUsers(list.filter(u => u !== null) as UserProfile[]);
      }
    } finally { setSocialLoading(false); }
  };

  const handleFollow = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);
    try {
      if (wasFollowing) await supabase.from('follows').delete().eq('follower_id', session.user.id).eq('following_id', user.id);
      else await supabase.from('follows').insert({ follower_id: session.user.id, following_id: user.id });
      fetchUserContent();
    } catch (err) { setIsFollowing(wasFollowing); }
  };

  const saveProfileChanges = async () => {
    setIsSavingProfile(true);
    try {
      let finalAvatarUrl = editAvatarUrl;
      let finalCoverUrl = editCoverUrl;
      if (editAvatarFile) {
        const name = `${user.id}-av-${Date.now()}`;
        await supabase.storage.from('avatars').upload(`avatars/${name}`, editAvatarFile);
        finalAvatarUrl = supabase.storage.from('avatars').getPublicUrl(`avatars/${name}`).data.publicUrl;
      }
      if (editCoverFile) {
        const name = `${user.id}-cv-${Date.now()}`;
        await supabase.storage.from('avatars').upload(`covers/${name}`, editCoverFile);
        finalCoverUrl = supabase.storage.from('avatars').getPublicUrl(`covers/${name}`).data.publicUrl;
      }
      await supabase.from('profiles').update({ 
        username: editUsername.toLowerCase().trim(), bio: editBio.trim(), 
        avatar_url: finalAvatarUrl, cover_url: finalCoverUrl 
      }).eq('id', user.id);
      onUpdateProfile({ username: editUsername, bio: editBio, avatar_url: finalAvatarUrl, cover_url: finalCoverUrl });
      setIsEditModalOpen(false);
    } catch (err: any) { alert(err.message); } finally { setIsSavingProfile(false); }
  };

  return (
    <div className="max-w-[935px] mx-auto animate-vix-in pb-32">
      {/* Cover Photo Area */}
      <div className="relative h-48 sm:h-64 w-full bg-zinc-900 group">
        {user.cover_url ? (
          <img src={user.cover_url} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-zinc-900 to-black flex items-center justify-center opacity-30">
             <ImageIcon className="w-12 h-12 text-zinc-700" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-all"></div>
        
        {/* Profile Overlap Header */}
        <div className="absolute -bottom-12 left-6 sm:left-12 flex items-end gap-6 sm:gap-8">
           <div className="relative">
              <div className="w-28 h-28 sm:w-40 sm:h-40 rounded-full p-1 bg-black ring-4 ring-black shadow-2xl overflow-hidden">
                <img src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.username}`} className="w-full h-full rounded-full object-cover bg-zinc-900" />
              </div>
           </div>
           <div className="pb-4 hidden sm:block">
              <h2 className="text-2xl font-black text-white flex items-center gap-2 drop-shadow-md">
                @{user.username} {user.is_verified && <VerificationBadge size="w-7 h-7" />}
              </h2>
           </div>
        </div>
      </div>

      <div className="mt-20 px-6 sm:px-12 flex flex-col sm:flex-row sm:items-start justify-between gap-8">
        <div className="space-y-6">
          <div className="sm:hidden">
            <h2 className="text-3xl font-black text-white flex items-center gap-2">
              @{user.username} {user.is_verified && <VerificationBadge size="w-7 h-7" />}
            </h2>
          </div>
          <div className="max-w-lg">
            <h3 className="font-bold text-white mb-2">{user.full_name || user.username}</h3>
            <p className="text-zinc-500 text-sm whitespace-pre-wrap leading-relaxed">{user.bio || 'Initial bio signal pending...'}</p>
          </div>
          <div className="flex gap-8 border-t border-zinc-900 pt-6">
            <div onClick={() => handleOpenSocial('FOLLOWERS')} className="flex flex-col cursor-pointer group">
              <span className="font-black text-white text-lg group-hover:text-pink-500 transition-colors">{counts.followers}</span>
              <span className="text-[9px] text-zinc-600 font-black uppercase tracking-widest">Followers</span>
            </div>
            <div onClick={() => handleOpenSocial('FOLLOWING')} className={`flex flex-col cursor-pointer group ${(!isOwnProfile && !user.is_following_public) ? 'opacity-30' : ''}`}>
              <span className="font-black text-white text-lg group-hover:text-pink-500 transition-colors">
                {(!isOwnProfile && !user.is_following_public) ? <Lock className="w-3 h-3" /> : counts.following}
              </span>
              <span className="text-[9px] text-zinc-600 font-black uppercase tracking-widest">Following</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          {isOwnProfile ? (
            <button onClick={() => setIsEditModalOpen(true)} className="bg-zinc-900 px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-zinc-800 hover:bg-zinc-800 text-white transition-all shadow-xl">Edit Profile</button>
          ) : (
            <>
              <button onClick={handleFollow} className={`px-10 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${isFollowing ? 'bg-zinc-900 text-zinc-500 border border-zinc-800' : 'vix-gradient text-white shadow-2xl shadow-pink-500/10'}`}>
                {isFollowing ? 'Following' : 'Follow'}
              </button>
              <button onClick={() => onMessageUser?.(user)} className="bg-zinc-900 px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-zinc-800 text-white shadow-xl hover:bg-zinc-800">Message</button>
            </>
          )}
          {isOwnProfile && (
            <button onClick={() => setIsSettingsOpen(true)} className="p-3 bg-zinc-900 border border-zinc-800 rounded-2xl text-zinc-500 hover:text-white transition-all"><Settings className="w-5 h-5" /></button>
          )}
        </div>
      </div>

      {/* Grid Tabs */}
      <div className="mt-12 px-4 border-t border-zinc-900">
        <div className="flex justify-center gap-12">
          <button onClick={() => setActiveTab('POSTS')} className={`flex items-center gap-2 py-4 border-t-2 transition-all font-black text-[10px] uppercase tracking-widest ${activeTab === 'POSTS' ? 'border-white text-white' : 'border-transparent text-zinc-700'}`}><Grid className="w-4 h-4" /> Posts</button>
          <button onClick={() => setActiveTab('LIKES')} className={`flex items-center gap-2 py-4 border-t-2 transition-all font-black text-[10px] uppercase tracking-widest ${activeTab === 'LIKES' ? 'border-white text-white' : 'border-transparent text-zinc-700'}`}><Heart className="w-4 h-4" /> Liked</button>
        </div>

        <div className="grid grid-cols-3 gap-1 sm:gap-4 mt-4">
          {(activeTab === 'POSTS' ? posts : likedPosts).map((post) => (
            <div key={post.id} className="aspect-square bg-zinc-950 relative group cursor-pointer overflow-hidden rounded-xl border border-zinc-900 shadow-xl transition-transform hover:scale-[1.02]">
              {post.media_type === 'video' ? <video src={post.media_url} className="w-full h-full object-cover" /> : <img src={post.media_url} className="w-full h-full object-cover" />}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all backdrop-blur-sm">
                <Heart className="w-8 h-8 text-white fill-white shadow-2xl" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Social Modal */}
      {isSocialModalOpen && (
        <div className="fixed inset-0 z-[10001] bg-black/95 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="w-full max-w-sm bg-zinc-950 border border-zinc-900 rounded-[3rem] overflow-hidden shadow-2xl animate-vix-in">
            <div className="p-6 border-b border-zinc-900 flex justify-between items-center bg-zinc-900/20">
              <h3 className="font-black text-[10px] uppercase tracking-[0.3em] text-zinc-500">{socialModalType} Registry</h3>
              <button onClick={() => setIsSocialModalOpen(false)}><X className="w-6 h-6 text-zinc-700 hover:text-white" /></button>
            </div>
            <div className="p-4 space-y-2 overflow-y-auto max-h-[60vh] no-scrollbar">
              {socialLoading ? <Loader2 className="w-8 h-8 text-zinc-800 animate-spin mx-auto my-12" /> : socialUsers.map(u => (
                <div key={u.id} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-zinc-900/50 transition-colors cursor-pointer group" onClick={() => { setIsSocialModalOpen(false); if (u.id !== user.id) onMessageUser?.(u); }}>
                  <img src={u.avatar_url || `https://ui-avatars.com/api/?name=${u.username}`} className="w-10 h-10 rounded-full object-cover border border-zinc-800" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-white flex items-center gap-1.5 truncate">@{u.username} {u.is_verified && <VerificationBadge size="w-3.5 h-3.5" />}</p>
                    <p className="text-[9px] text-zinc-600 font-black uppercase truncate tracking-tighter">{u.full_name || 'Individual Creator'}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-800 group-hover:text-pink-500" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal (Expanded for Cover Photo) */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[10000] bg-black/95 flex items-center justify-center p-6 overflow-y-auto no-scrollbar">
          <div className="w-full max-w-lg bg-zinc-950 border border-zinc-900 rounded-[3rem] p-8 sm:p-12 space-y-8 animate-vix-in">
            <div className="flex justify-between items-center">
              <h3 className="font-black uppercase tracking-widest text-white">Modify Identity</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="p-2"><X className="w-6 h-6 text-zinc-500" /></button>
            </div>
            
            <div className="space-y-6">
               {/* Cover Edit */}
               <div className="space-y-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Cover Banner</span>
                  <div className="h-32 w-full bg-zinc-900 rounded-2xl overflow-hidden relative group cursor-pointer border border-zinc-800" onClick={() => coverInputRef.current?.click()}>
                     <img src={editCoverUrl || ''} className="w-full h-full object-cover opacity-50 group-hover:opacity-30 transition-opacity" />
                     <div className="absolute inset-0 flex items-center justify-center"><Camera className="w-6 h-6 text-white" /></div>
                     <input ref={coverInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setEditCoverFile(f); setEditCoverUrl(URL.createObjectURL(f)); } }} />
                  </div>
               </div>

               {/* Avatar Edit */}
               <div className="flex flex-col items-center gap-4">
                  <div className="relative group cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
                     <img src={editAvatarUrl || `https://ui-avatars.com/api/?name=${editUsername}`} className="w-24 h-24 rounded-full object-cover bg-zinc-900 border-2 border-zinc-800 group-hover:opacity-50 shadow-2xl" />
                     <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Camera className="w-6 h-6 text-white" /></div>
                  </div>
                  <input ref={avatarInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setEditAvatarFile(f); setEditAvatarUrl(URL.createObjectURL(f)); } }} />
               </div>

               <div className="space-y-4">
                  <input value={editUsername} onChange={e => setEditUsername(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-6 py-4 text-sm text-white outline-none focus:border-pink-500/50 transition-all" placeholder="Handle" />
                  <textarea value={editBio} onChange={e => setEditBio(e.target.value)} className="w-full h-32 bg-zinc-900 border border-zinc-800 rounded-2xl px-6 py-4 text-sm text-white outline-none resize-none focus:border-pink-500/50 transition-all" placeholder="Narrative bio..." />
                  <button onClick={saveProfileChanges} disabled={isSavingProfile} className="w-full vix-gradient py-5 rounded-[2rem] font-black text-white text-[11px] uppercase tracking-widest disabled:opacity-50 shadow-2xl shadow-pink-500/20 active:scale-95 transition-all">
                    {isSavingProfile ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Synchronize Identity'}
                  </button>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
