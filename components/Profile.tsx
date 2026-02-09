
import React, { useState, useEffect, useRef } from 'react';
import { 
  Grid, Heart, Camera, Settings, User as UserIcon, Loader2, X,
  ShieldCheck, Globe, Lock, EyeOff, Eye, Users, ChevronRight, Trash2,
  MessageSquare, UserCheck
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
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Individual privacy states
  const [isPrivate, setIsPrivate] = useState(user.is_private || false);
  const [isFollowingPublic, setIsFollowingPublic] = useState(user.is_following_public !== false);
  const [allowComments, setAllowComments] = useState(user.allow_comments !== false);

  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchUserContent();
    // Sync local states if user prop changes
    setIsPrivate(user.is_private || false);
    setIsFollowingPublic(user.is_following_public !== false);
    setAllowComments(user.allow_comments !== false);

    // Global listener to remove posts deleted from other tabs (e.g. Feed)
    const handleGlobalDelete = (e: any) => {
      const deletedId = e.detail?.id;
      if (deletedId) {
        setPosts(prev => prev.filter(p => p.id !== deletedId));
        setLikedPosts(prev => prev.filter(p => p.id !== deletedId));
      }
    };

    // Global listener for user profile updates (like verification or follower boost)
    const handleIdentityUpdate = (e: any) => {
      if (e.detail?.id === user.id) {
        fetchUserContent(); // Simple refresh for profile stats
      }
    };

    window.addEventListener('vixreel-post-deleted', handleGlobalDelete);
    window.addEventListener('vixreel-user-updated', handleIdentityUpdate);
    return () => {
      window.removeEventListener('vixreel-post-deleted', handleGlobalDelete);
      window.removeEventListener('vixreel-user-updated', handleIdentityUpdate);
    };
  }, [user.id, user.is_private, user.is_following_public, user.allow_comments]);

  const fetchUserContent = async () => {
    setIsUpdating(true);
    try {
      const { data: pData } = await supabase.from('posts').select('*, user:profiles(*)').eq('user_id', user.id).order('created_at', { ascending: false });
      if (pData) setPosts(pData as any);

      const { data: lData } = await supabase.from('likes').select('post:posts(*, user:profiles(*))').eq('user_id', user.id).order('created_at', { ascending: false });
      if (lData) setLikedPosts(lData.map((l: any) => l.post).filter(p => p !== null) as any);
      
      const { count: fCount } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', user.id);
      const { count: ingCount } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', user.id);
      
      // Get the latest profile data for boosted followers
      const { data: freshProfile } = await supabase.from('profiles').select('boosted_followers').eq('id', user.id).maybeSingle();
      const boostedFollowers = freshProfile?.boosted_followers || 0;

      let totalLikes = 0;
      pData?.forEach(post => totalLikes += (post.likes_count || 0) + (post.boosted_likes || 0));

      setCounts({ 
        followers: (fCount || 0) + boostedFollowers, 
        following: ingCount || 0, 
        likes: totalLikes 
      });

      const { data: { session } } = await supabase.auth.getSession();
      if (session && user.id !== session.user.id) {
        const { data } = await supabase.from('follows').select('*').eq('follower_id', session.user.id).eq('following_id', user.id).maybeSingle();
        setIsFollowing(!!data);
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleSetting = async (key: keyof UserProfile, value: boolean) => {
    if (key === 'is_private') setIsPrivate(value);
    if (key === 'is_following_public') setIsFollowingPublic(value);
    if (key === 'allow_comments') setAllowComments(value);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ [key]: value })
        .eq('id', user.id);

      if (error) throw error;
      onUpdateProfile({ [key]: value });
    } catch (err: any) {
      console.error("Failed to sync setting:", err);
      if (key === 'is_private') setIsPrivate(!value);
      if (key === 'is_following_public') setIsFollowingPublic(!value);
      if (key === 'allow_comments') setAllowComments(!value);
    }
  };

  const handleOpenSocial = async (type: 'FOLLOWERS' | 'FOLLOWING') => {
    if (!isOwnProfile && type === 'FOLLOWING' && !user.is_following_public) return;

    setSocialModalType(type);
    setIsSocialModalOpen(true);
    setSocialLoading(true);
    setSocialUsers([]);
    
    try {
      const { data, error } = await supabase
        .from('follows')
        .select(`
          follower:profiles!follower_id(*),
          following:profiles!following_id(*)
        `)
        .eq(type === 'FOLLOWERS' ? 'following_id' : 'follower_id', user.id);

      if (error) throw error;
      if (data) {
        const list = data.map((item: any) => type === 'FOLLOWERS' ? item.follower : item.following);
        setSocialUsers(list.filter(u => u !== null) as UserProfile[]);
      }
    } catch (err) {
      console.error("Social retrieval failure:", err);
    } finally {
      setSocialLoading(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm("Permanently delete this artifact from the grid?")) return;
    
    const postToDelete = posts.find(p => p.id === postId);
    if (!postToDelete) return;

    try {
      const pathParts = postToDelete.media_url.split('/public/posts/');
      if (pathParts.length > 1) {
        const mediaPath = pathParts[1];
        await supabase.storage.from('posts').remove([mediaPath]);
      }

      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId)
        .eq('user_id', user.id);

      if (error) throw error;

      setPosts(prev => prev.filter(p => p.id !== postId));
      setLikedPosts(prev => prev.filter(p => p.id !== postId));
      setCounts(prev => ({ ...prev, likes: prev.likes - (postToDelete.likes_count || 0) }));
      window.dispatchEvent(new CustomEvent('vixreel-post-deleted', { detail: { id: postId } }));
      
    } catch (err: any) {
      console.error("Deletion error:", err);
      alert("System failure during deletion: " + err.message);
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
        const fileName = `${user.id}-${Date.now()}-${sanitizeFilename(editAvatarFile.name)}`;
        await supabase.storage.from('avatars').upload(`avatars/${fileName}`, editAvatarFile);
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(`avatars/${fileName}`);
        finalAvatarUrl = publicUrl;
      }
      await supabase.from('profiles').update({ 
        username: editUsername.toLowerCase().trim(), bio: editBio.trim(), avatar_url: finalAvatarUrl 
      }).eq('id', user.id);
      
      onUpdateProfile({ username: editUsername, bio: editBio, avatar_url: finalAvatarUrl });
      setIsEditModalOpen(false);
    } catch (err: any) { alert(err.message); } finally { setIsSavingProfile(false); }
  };

  return (
    <div className="max-w-[935px] mx-auto py-12 px-4 animate-vix-in pb-32">
      <div className="flex justify-between items-center mb-12">
        <h2 className="text-xl font-bold uppercase tracking-widest text-white">Profile</h2>
        {isOwnProfile && (
          <button onClick={() => setIsSettingsOpen(true)} className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-2xl text-zinc-400 hover:text-white transition-all hover:border-pink-500/30 group">
            <Settings className="w-5 h-5 group-hover:rotate-90 transition-transform duration-500" />
          </button>
        )}
      </div>

      <div className="flex flex-col md:flex-row items-center md:items-start gap-12 mb-20">
        <div className="relative w-36 h-36 sm:w-44 sm:h-44 shrink-0">
          <div className="w-full h-full rounded-full p-1 border border-zinc-800 ring-2 ring-pink-500/10">
            <img src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.username}`} className="w-full h-full rounded-full object-cover bg-zinc-900 shadow-2xl" />
          </div>
        </div>
        <div className="flex-1 space-y-8 text-center md:text-left">
          <div className="flex flex-col sm:flex-row items-center gap-8">
            <h2 className="text-3xl font-bold text-white flex items-center gap-2">@{user.username} {user.is_verified && <VerificationBadge size="w-7 h-7" />}</h2>
            <div className="flex gap-3 w-full sm:w-auto">
              {isOwnProfile ? (
                <button onClick={() => setIsEditModalOpen(true)} className="flex-1 sm:flex-none bg-zinc-900 px-8 py-3 rounded-2xl text-xs font-bold border border-zinc-800 hover:bg-zinc-800 text-white transition-all">Edit Profile</button>
              ) : (
                <>
                  <button onClick={handleFollow} className={`flex-1 sm:flex-none px-8 py-3 rounded-2xl text-xs font-bold transition-all ${isFollowing ? 'bg-zinc-900 text-zinc-500 border border-zinc-800' : 'vix-gradient text-white shadow-lg'}`}>
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
              <span className="font-bold text-xl text-white group-hover:text-pink-500 transition-colors">{counts.followers}</span>
              <span className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest">Followers</span>
            </div>
            <div onClick={() => handleOpenSocial('FOLLOWING')} className={`flex flex-col items-center sm:items-baseline cursor-pointer group hover:opacity-70 transition-opacity ${(!isOwnProfile && !user.is_following_public) ? 'cursor-not-allowed opacity-30' : ''}`}>
              <span className="font-bold text-xl text-white group-hover:text-pink-500 transition-colors">
                {(!isOwnProfile && !user.is_following_public) ? <Lock className="w-4 h-4 inline" /> : counts.following}
              </span>
              <span className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest">Following</span>
            </div>
          </div>
          <div><div className="font-bold text-white mb-1">{user.full_name || user.username}</div><p className="text-zinc-500 text-sm whitespace-pre-wrap">{user.bio || 'Initial bio signal pending...'}</p></div>
        </div>
      </div>

      <div className="border-t border-zinc-900 flex justify-center gap-12 mb-8">
        <button onClick={() => setActiveTab('POSTS')} className={`flex items-center gap-2 py-4 border-t-2 transition-all font-bold text-xs uppercase tracking-widest ${activeTab === 'POSTS' ? 'border-white text-white' : 'border-transparent text-zinc-700'}`}><Grid className="w-4 h-4" /> Posts</button>
        <button onClick={() => setActiveTab('LIKES')} className={`flex items-center gap-2 py-4 border-t-2 transition-all font-bold text-xs uppercase tracking-widest ${activeTab === 'LIKES' ? 'border-white text-white' : 'border-transparent text-zinc-700'}`}><Heart className="w-4 h-4" /> Liked</button>
      </div>

      <div className="grid grid-cols-3 gap-1 sm:gap-4">
        {(activeTab === 'POSTS' ? posts : likedPosts).map((post) => (
          <div key={post.id} className="aspect-square bg-zinc-950 relative group cursor-pointer overflow-hidden rounded-md border border-zinc-900 transition-all hover:scale-[1.02]">
            {post.media_type === 'video' ? <video src={post.media_url} className="w-full h-full object-cover" /> : <img src={post.media_url} className="w-full h-full object-cover" />}
            
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-all gap-5 backdrop-blur-[2px]">
              <div className="text-white drop-shadow-[0_0_15px_rgba(255,0,128,0.5)]">
                <Heart className="w-10 h-10 fill-white animate-pulse" />
              </div>
              
              {isOwnProfile && activeTab === 'POSTS' && (
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDeletePost(post.id); }}
                  className="p-3 bg-red-500/10 text-red-500 rounded-full hover:bg-red-500 hover:text-white transition-all border border-red-500/20 shadow-xl"
                  title="Delete Post"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Social Modal */}
      {isSocialModalOpen && (
        <div className="fixed inset-0 z-[10001] bg-black/95 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="w-full max-sm bg-zinc-950 border border-zinc-900 rounded-[2.5rem] overflow-hidden shadow-2xl animate-vix-in">
            <div className="p-6 border-b border-zinc-900 flex justify-between items-center bg-zinc-900/10">
              <h3 className="font-black text-[10px] uppercase tracking-[0.2em] text-zinc-500">{socialModalType} Registry</h3>
              <button onClick={() => setIsSocialModalOpen(false)}><X className="w-6 h-6 text-zinc-700 hover:text-white transition-colors" /></button>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto max-h-[60vh] no-scrollbar">
              {socialLoading ? (
                <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 text-zinc-800 animate-spin" /></div>
              ) : socialUsers.map(u => (
                <div key={u.id} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-zinc-900/50 transition-colors cursor-pointer group" onClick={() => { setIsSocialModalOpen(false); onMessageUser?.(u); }}>
                  <img src={u.avatar_url || `https://ui-avatars.com/api/?name=${u.username}`} className="w-10 h-10 rounded-full object-cover border border-zinc-800" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-white flex items-center gap-1.5 truncate">@{u.username} {u.is_verified && <VerificationBadge size="w-3.5 h-3.5" />}</p>
                    <p className="text-[10px] text-zinc-600 font-bold uppercase truncate tracking-tighter">{u.full_name || 'Individual Creator'}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-800 group-hover:text-pink-500 transition-all" />
                </div>
              ))}
              {!socialLoading && socialUsers.length === 0 && (
                <div className="py-20 text-center opacity-30 flex flex-col items-center">
                  <Users className="w-10 h-10 text-zinc-700 mb-4" />
                  <p className="text-[10px] font-black uppercase tracking-[0.3em]">No Identity Fragments Located</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal (Privacy Node) */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[10000] bg-black/95 flex items-center justify-center p-6 backdrop-blur-sm">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-900 rounded-[2.5rem] p-8 space-y-10 animate-vix-in">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg text-white">Privacy Node</h3>
              <button onClick={() => setIsSettingsOpen(false)}><X className="w-6 h-6 text-zinc-500 hover:text-white transition-colors" /></button>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-5 bg-zinc-900/50 rounded-2xl border border-zinc-800 group transition-all hover:border-pink-500/20">
                <div className="flex items-start gap-4">
                  <Lock className="w-5 h-5 text-zinc-600 mt-1 shrink-0" />
                  <div>
                    <div className="text-sm font-bold text-white">Encrypted Profile</div>
                    <div className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mt-1">Only followers see artifacts</div>
                  </div>
                </div>
                <button 
                  onClick={() => handleToggleSetting('is_private', !isPrivate)} 
                  className={`w-12 h-6 rounded-full p-1 transition-all ${isPrivate ? 'bg-pink-500' : 'bg-zinc-700'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full transition-all ${isPrivate ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-5 bg-zinc-900/50 rounded-2xl border border-zinc-800 group transition-all hover:border-pink-500/20">
                <div className="flex items-start gap-4">
                  <UserCheck className="w-5 h-5 text-zinc-600 mt-1 shrink-0" />
                  <div>
                    <div className="text-sm font-bold text-white">Public Connections</div>
                    <div className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mt-1">Anyone can see following list</div>
                  </div>
                </div>
                <button 
                  onClick={() => handleToggleSetting('is_following_public', !isFollowingPublic)} 
                  className={`w-12 h-6 rounded-full p-1 transition-all ${isFollowingPublic ? 'bg-pink-500' : 'bg-zinc-700'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full transition-all ${isFollowingPublic ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-5 bg-zinc-900/50 rounded-2xl border border-zinc-800 group transition-all hover:border-pink-500/20">
                <div className="flex items-start gap-4">
                  <MessageSquare className="w-5 h-5 text-zinc-600 mt-1 shrink-0" />
                  <div>
                    <div className="text-sm font-bold text-white">Allow Interactions</div>
                    <div className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mt-1">Enable global comment portal</div>
                  </div>
                </div>
                <button 
                  onClick={() => handleToggleSetting('allow_comments', !allowComments)} 
                  className={`w-12 h-6 rounded-full p-1 transition-all ${allowComments ? 'bg-pink-500' : 'bg-zinc-700'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full transition-all ${allowComments ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="pt-6">
                <button 
                  onClick={() => { setIsSettingsOpen(false); onLogout?.(); }} 
                  className="w-full py-5 border border-red-500/20 text-red-500 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] hover:bg-red-500 hover:text-white transition-all shadow-xl shadow-red-500/5"
                >
                  Relinquish Primary Session
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[10000] bg-black/95 flex items-center justify-center p-6 overflow-y-auto no-scrollbar">
          <div className="w-full max-w-lg bg-zinc-950 border border-zinc-900 rounded-[3rem] p-10 space-y-8 animate-vix-in">
            <div className="flex justify-between items-center"><h3 className="font-bold text-lg text-white">Modify Identity</h3><button onClick={() => setIsEditModalOpen(false)} className="p-2"><X className="w-6 h-6 text-zinc-500" /></button></div>
            <div className="flex flex-col items-center gap-4">
               <div className="relative group cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
                  <img src={editAvatarUrl || `https://ui-avatars.com/api/?name=${editUsername}`} className="w-28 h-28 rounded-full object-cover bg-zinc-900 border-2 border-zinc-800 group-hover:opacity-50 transition-all shadow-2xl" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Camera className="w-8 h-8 text-white" /></div>
               </div>
               <input ref={avatarInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) { setEditAvatarFile(file); setEditAvatarUrl(URL.createObjectURL(file)); } }} />
            </div>
            <div className="space-y-6">
              <input value={editUsername} onChange={e => setEditUsername(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-6 py-4 text-sm text-white outline-none focus:border-pink-500/30 transition-all" placeholder="Handle" />
              <textarea value={editBio} onChange={e => setEditBio(e.target.value)} className="w-full h-32 bg-zinc-900 border border-zinc-800 rounded-2xl px-6 py-4 text-sm text-white outline-none resize-none focus:border-pink-500/30 transition-all" placeholder="Narrative bio..." />
              <button onClick={saveProfileChanges} disabled={isSavingProfile} className="w-full vix-gradient py-5 rounded-[2rem] font-black text-white text-[11px] uppercase tracking-widest disabled:opacity-50 shadow-2xl shadow-pink-500/20 transition-all hover:scale-[1.02]">
                {isSavingProfile ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Synchronize Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
