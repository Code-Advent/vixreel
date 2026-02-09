
import React, { useState, useEffect, useRef } from 'react';
import { 
  Grid, Heart, Camera, Settings, User as UserIcon, Loader2, X,
  ShieldCheck, Globe, Lock, EyeOff, Eye, Users, ChevronRight, Trash2
} from 'lucide-react';
import { UserProfile, Post as PostType } from '../types';
import { supabase } from '../lib/supabase';
import { formatNumber, sanitizeFilename } from '../lib/utils';
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
  
  // Social List State
  const [isSocialModalOpen, setIsSocialModalOpen] = useState(false);
  const [socialModalType, setSocialModalType] = useState<'FOLLOWERS' | 'FOLLOWING'>('FOLLOWERS');
  const [socialUsers, setSocialUsers] = useState<UserProfile[]>([]);
  const [socialLoading, setSocialLoading] = useState(false);

  // Added missing state variables to fix visibility and reference errors
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [editUsername, setEditUsername] = useState(user.username);
  const [editBio, setEditBio] = useState(user.bio || '');
  const [editAvatarUrl, setEditAvatarUrl] = useState(user.avatar_url);
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [isPrivate, setIsPrivate] = useState(user.is_private || false);
  const [isFollowingPublic, setIsFollowingPublic] = useState(user.is_following_public !== false);
  const [allowComments, setAllowComments] = useState(user.allow_comments !== false);

  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchUserContent();
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
      
      let totalLikes = 0;
      pData?.forEach(post => totalLikes += (post.likes_count || 0) + (post.boosted_likes || 0));

      setCounts({ followers: fCount || 0, following: ingCount || 0, likes: totalLikes });

      const { data: { session } } = await supabase.auth.getSession();
      if (session && user.id !== session.user.id) {
        const { data } = await supabase.from('follows').select('*').eq('follower_id', session.user.id).eq('following_id', user.id).maybeSingle();
        setIsFollowing(!!data);
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleOpenSocial = async (type: 'FOLLOWERS' | 'FOLLOWING') => {
    if (!isOwnProfile && type === 'FOLLOWING' && !user.is_following_public) {
      alert("This account's following list is private.");
      return;
    }

    setSocialModalType(type);
    setIsSocialModalOpen(true);
    setSocialLoading(true);
    try {
      // Fix: Use explicit foreign key references to pull profile data
      let query = supabase.from('follows').select(`
        *,
        follower:profiles!follower_id(*),
        following:profiles!following_id(*)
      `);

      if (type === 'FOLLOWERS') {
        query = query.eq('following_id', user.id);
      } else {
        query = query.eq('follower_id', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (data) {
        const list = data.map((item: any) => type === 'FOLLOWERS' ? item.follower : item.following);
        setSocialUsers(list.filter(u => u !== null) as UserProfile[]);
      }
    } catch (err) {
      console.error("Social list fetch error", err);
    } finally {
      setSocialLoading(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm("Are you sure you want to delete this artifact forever?")) return;
    try {
      const { error } = await supabase.from('posts').delete().eq('id', postId).eq('user_id', user.id);
      if (error) throw error;
      setPosts(prev => prev.filter(p => p.id !== postId));
      fetchUserContent(); // Update counts
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    }
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
      if (editAvatarFile) {
        const safeName = sanitizeFilename(editAvatarFile.name);
        const fileName = `${user.id}-${Date.now()}-${safeName}`;
        const filePath = `avatars/${fileName}`;
        await supabase.storage.from('avatars').upload(filePath, editAvatarFile);
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
        finalAvatarUrl = publicUrl;
      }
      const { error: updateErr } = await supabase.from('profiles').update({ 
        username: editUsername.toLowerCase().trim(), 
        bio: editBio.trim(), 
        avatar_url: finalAvatarUrl 
      }).eq('id', user.id);
      
      if (updateErr) throw updateErr;
      
      onUpdateProfile({ username: editUsername, bio: editBio, avatar_url: finalAvatarUrl });
      setIsEditModalOpen(false);
    } catch (err: any) { 
      alert(err.message); 
    } finally { 
      setIsSavingProfile(false); 
    }
  };

  const applyPrivacySettings = async () => {
    try {
      const { error } = await supabase.from('profiles').update({ 
        is_private: isPrivate, 
        allow_comments: allowComments, 
        is_following_public: isFollowingPublic 
      }).eq('id', user.id);
      
      if (error) throw error;

      onUpdateProfile({ is_private: isPrivate, allow_comments: allowComments, is_following_public: isFollowingPublic });
      setIsSettingsOpen(false);
    } catch (err) { 
      alert("Failed to update settings."); 
    }
  };

  return (
    <div className="max-w-[935px] mx-auto py-12 px-4 animate-vix-in pb-32">
      <div className="flex justify-between items-center mb-12">
        <h2 className="text-xl font-bold uppercase tracking-widest text-white">Profile</h2>
        {isOwnProfile && (
          <button onClick={() => setIsSettingsOpen(true)} className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-2xl text-zinc-400 hover:text-white">
            <Settings className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="flex flex-col md:flex-row items-center md:items-start gap-12 mb-20">
        <div className="relative w-36 h-36 sm:w-44 sm:h-44 shrink-0">
          <div className="w-full h-full rounded-full p-1 border border-zinc-800">
            <img src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.username}`} className="w-full h-full rounded-full object-cover bg-zinc-900" />
          </div>
        </div>
        <div className="flex-1 space-y-8 text-center md:text-left">
          <div className="flex flex-col sm:flex-row items-center gap-8">
            <h2 className="text-3xl font-bold text-white flex items-center gap-2">@{user.username} {user.is_verified && <VerificationBadge size="w-7 h-7" />}</h2>
            <div className="flex gap-3 w-full sm:w-auto">
              {isOwnProfile ? (
                <button onClick={() => setIsEditModalOpen(true)} className="flex-1 sm:flex-none bg-zinc-900 px-8 py-3 rounded-2xl text-xs font-bold border border-zinc-800 hover:bg-zinc-800 text-white">Edit Profile</button>
              ) : (
                <>
                  <button onClick={handleFollow} className={`flex-1 sm:flex-none px-8 py-3 rounded-2xl text-xs font-bold transition-all ${isFollowing ? 'bg-zinc-900 text-zinc-500 border border-zinc-800' : 'vix-gradient text-white'}`}>
                    {isFollowing ? 'Following' : 'Follow'}
                  </button>
                  <button onClick={() => onMessageUser?.(user)} className="flex-1 sm:flex-none bg-zinc-900 px-8 py-3 rounded-2xl text-xs font-bold border border-zinc-800 text-white">Message</button>
                </>
              )}
            </div>
          </div>
          <div className="flex justify-center md:justify-start gap-10">
            <div className="flex flex-col items-center sm:items-baseline">
              <span className="font-bold text-xl text-white">{posts.length}</span>
              <span className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest">Posts</span>
            </div>
            <div onClick={() => handleOpenSocial('FOLLOWERS')} className="flex flex-col items-center sm:items-baseline cursor-pointer group hover:opacity-70 transition-opacity">
              <span className="font-bold text-xl text-white group-hover:text-pink-500">{counts.followers}</span>
              <span className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest">Followers</span>
            </div>
            <div onClick={() => handleOpenSocial('FOLLOWING')} className="flex flex-col items-center sm:items-baseline cursor-pointer group hover:opacity-70 transition-opacity">
              <span className="font-bold text-xl text-white group-hover:text-pink-500">{counts.following}</span>
              <span className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest">Following</span>
            </div>
          </div>
          <div><div className="font-bold text-white mb-1">{user.full_name || user.username}</div><p className="text-zinc-500 text-sm whitespace-pre-wrap">{user.bio || 'No bio yet.'}</p></div>
        </div>
      </div>

      <div className="border-t border-zinc-900 flex justify-center gap-12 mb-8">
        <button onClick={() => setActiveTab('POSTS')} className={`flex items-center gap-2 py-4 border-t-2 transition-all font-bold text-xs uppercase tracking-widest ${activeTab === 'POSTS' ? 'border-white text-white' : 'border-transparent text-zinc-700'}`}><Grid className="w-4 h-4" /> Posts</button>
        <button onClick={() => setActiveTab('LIKES')} className={`flex items-center gap-2 py-4 border-t-2 transition-all font-bold text-xs uppercase tracking-widest ${activeTab === 'LIKES' ? 'border-white text-white' : 'border-transparent text-zinc-700'}`}><Heart className="w-4 h-4" /> Liked</button>
      </div>

      <div className="grid grid-cols-3 gap-1 sm:gap-4">
        {(activeTab === 'POSTS' ? posts : likedPosts).map((post) => (
          <div key={post.id} className="aspect-square bg-zinc-900 relative group cursor-pointer overflow-hidden rounded-md border border-zinc-800/50 transition-all hover:scale-[1.02]">
            {post.media_type === 'video' ? <video src={post.media_url} className="w-full h-full object-cover" /> : <img src={post.media_url} className="w-full h-full object-cover" />}
            
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-all gap-4">
              <div className="flex items-center gap-2 text-white font-bold"><Heart className="w-5 h-5 fill-white" /> {formatNumber((post.likes_count || 0) + (post.boosted_likes || 0))}</div>
              {isOwnProfile && activeTab === 'POSTS' && (
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDeletePost(post.id); }}
                  className="p-3 bg-red-500/20 text-red-500 rounded-full hover:bg-red-500 hover:text-white transition-all border border-red-500/30"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Social Users Modal */}
      {isSocialModalOpen && (
        <div className="fixed inset-0 z-[10001] bg-black/95 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="w-full max-w-sm bg-zinc-950 border border-zinc-900 rounded-[2.5rem] overflow-hidden shadow-2xl animate-vix-in">
            <div className="p-6 border-b border-zinc-900 flex justify-between items-center">
              <h3 className="font-black text-[10px] uppercase tracking-[0.2em] text-zinc-500">{socialModalType}</h3>
              <button onClick={() => setIsSocialModalOpen(false)}><X className="w-6 h-6 text-zinc-700" /></button>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto max-h-[60vh] no-scrollbar">
              {socialLoading ? (
                <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 text-zinc-800 animate-spin" /></div>
              ) : socialUsers.map(u => (
                <div key={u.id} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-zinc-900/50 transition-colors cursor-pointer group">
                  <img src={u.avatar_url || `https://ui-avatars.com/api/?name=${u.username}`} className="w-10 h-10 rounded-full object-cover border border-zinc-800" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-white flex items-center gap-1.5 truncate">@{u.username} {u.is_verified && <VerificationBadge size="w-3.5 h-3.5" />}</p>
                    <p className="text-[10px] text-zinc-600 font-bold uppercase truncate">{u.full_name}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-800 group-hover:text-pink-500 transition-all" />
                </div>
              ))}
              {!socialLoading && socialUsers.length === 0 && (
                <div className="py-20 text-center opacity-30 flex flex-col items-center">
                  <Users className="w-10 h-10 text-zinc-700 mb-4" />
                  <p className="text-[10px] font-black uppercase tracking-widest">No users found</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isSettingsOpen && (
        <div className="fixed inset-0 z-[10000] bg-black/95 flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-900 rounded-[2.5rem] p-8 space-y-10 animate-vix-in">
            <div className="flex justify-between items-center"><h3 className="font-bold text-lg text-white">Privacy Settings</h3><button onClick={() => setIsSettingsOpen(false)}><X className="w-6 h-6 text-zinc-500" /></button></div>
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-2xl border border-zinc-800">
                <div><div className="text-sm font-bold text-white">Private Account</div><div className="text-[10px] text-zinc-500">Only followers see posts</div></div>
                <button onClick={() => setIsPrivate(!isPrivate)} className={`w-12 h-6 rounded-full p-1 transition-all ${isPrivate ? 'bg-pink-500' : 'bg-zinc-700'}`}><div className={`w-4 h-4 bg-white rounded-full transition-all ${isPrivate ? 'translate-x-6' : 'translate-x-0'}`} /></button>
              </div>
              <div className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-2xl border border-zinc-800">
                <div><div className="text-sm font-bold text-white">Public Following List</div><div className="text-[10px] text-zinc-500">Allow others to see who you follow</div></div>
                <button onClick={() => setIsFollowingPublic(!isFollowingPublic)} className={`w-12 h-6 rounded-full p-1 transition-all ${isFollowingPublic ? 'bg-green-500' : 'bg-zinc-700'}`}><div className={`w-4 h-4 bg-white rounded-full transition-all ${isFollowingPublic ? 'translate-x-6' : 'translate-x-0'}`} /></button>
              </div>
              <div className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-2xl border border-zinc-800">
                <div><div className="text-sm font-bold text-white">Allow Comments</div></div>
                <button onClick={() => setAllowComments(!allowComments)} className={`w-12 h-6 rounded-full p-1 transition-all ${allowComments ? 'bg-green-500' : 'bg-zinc-700'}`}><div className={`w-4 h-4 bg-white rounded-full transition-all ${allowComments ? 'translate-x-6' : 'translate-x-0'}`} /></button>
              </div>
              <button onClick={applyPrivacySettings} className="w-full vix-gradient py-4 rounded-2xl font-bold text-white">Save Settings</button>
              <button onClick={() => { setIsSettingsOpen(false); onLogout?.(); }} className="w-full py-4 border border-red-500/20 text-red-500 rounded-2xl font-bold text-xs uppercase tracking-widest">Logout</button>
            </div>
          </div>
        </div>
      )}

      {isEditModalOpen && (
        <div className="fixed inset-0 z-[10000] bg-black/95 flex items-center justify-center p-6 overflow-y-auto">
          <div className="w-full max-w-lg bg-zinc-950 border border-zinc-900 rounded-[2.5rem] p-8 space-y-8 animate-vix-in">
            <div className="flex justify-between items-center"><h3 className="font-bold text-lg text-white">Edit Profile</h3><button onClick={() => setIsEditModalOpen(false)} className="p-2"><X className="w-6 h-6 text-zinc-500" /></button></div>
            <div className="flex flex-col items-center gap-4">
               <div className="relative group cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
                  <img src={editAvatarUrl || `https://ui-avatars.com/api/?name=${editUsername}`} className="w-24 h-24 rounded-full object-cover bg-zinc-900 border-2 border-zinc-800 group-hover:opacity-50 transition-opacity" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Camera className="w-6 h-6 text-white" /></div>
               </div>
               <button onClick={() => avatarInputRef.current?.click()} className="text-xs font-bold text-pink-500 uppercase tracking-widest">Change Photo</button>
               <input ref={avatarInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) { setEditAvatarFile(file); setEditAvatarUrl(URL.createObjectURL(file)); } }} />
            </div>
            <div className="space-y-6">
              <input value={editUsername} onChange={e => setEditUsername(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-6 py-4 text-sm text-white outline-none" placeholder="Username" />
              <textarea value={editBio} onChange={e => setEditBio(e.target.value)} className="w-full h-32 bg-zinc-900 border border-zinc-800 rounded-2xl px-6 py-4 text-sm text-white outline-none resize-none" placeholder="Bio" />
              <button onClick={saveProfileChanges} disabled={isSavingProfile} className="w-full vix-gradient py-5 rounded-[2rem] font-bold text-white disabled:opacity-50">{isSavingProfile ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
