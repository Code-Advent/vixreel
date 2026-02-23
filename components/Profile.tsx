
import React, { useState, useEffect, useRef } from 'react';
import { 
  Grid, Heart, Camera, Settings, User as UserIcon, Loader2, X,
  ShieldCheck, Globe, Lock, EyeOff, Eye, Users, ChevronRight, Trash2,
  MessageSquare, UserCheck, Image as ImageIcon, MapPin
} from 'lucide-react';
import { UserProfile, Post as PostType, Group } from '../types';
import { supabase } from '../lib/supabase';
import { sanitizeFilename } from '../lib/utils';
import VerificationBadge from './VerificationBadge';
import Post from './Post';

interface ProfileProps {
  user: UserProfile;
  isOwnProfile: boolean;
  onUpdateProfile: (updates: Partial<UserProfile>) => void;
  onMessageUser?: (user: UserProfile) => void;
  onOpenSettings?: () => void;
  onLogout?: () => void;
  onNavigateToGroups?: () => void;
  onSelectGroup?: (group: Group) => void;
  autoEdit?: boolean;
}

const Profile: React.FC<ProfileProps> = ({ user, isOwnProfile, onUpdateProfile, onMessageUser, onLogout, onOpenSettings, onNavigateToGroups, onSelectGroup, autoEdit }) => {
  const [posts, setPosts] = useState<PostType[]>([]);
  const [likedPosts, setLikedPosts] = useState<PostType[]>([]);
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [activeTab, setActiveTab] = useState<'POSTS' | 'LIKES' | 'GROUPS'>('POSTS');
  const [counts, setCounts] = useState({ followers: 0, following: 0, likes: 0 });
  const [isFollowing, setIsFollowing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedPost, setSelectedPost] = useState<PostType | null>(null);
  
  const [isSocialModalOpen, setIsSocialModalOpen] = useState(false);
  const [socialModalType, setSocialModalType] = useState<'FOLLOWERS' | 'FOLLOWING'>('FOLLOWERS');
  const [socialUsers, setSocialUsers] = useState<UserProfile[]>([]);
  const [socialLoading, setSocialLoading] = useState(false);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editUsername, setEditUsername] = useState(user.username);
  const [editBio, setEditBio] = useState(user.bio || '');
  const [editAvatarUrl, setEditAvatarUrl] = useState(user.avatar_url);
  const [editCoverUrl, setEditCoverUrl] = useState(user.cover_url);
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [editCoverFile, setEditCoverFile] = useState<File | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoEdit) setIsEditModalOpen(true);
  }, [autoEdit]);

  useEffect(() => {
    fetchUserContent();

    const handleGlobalDelete = (e: any) => {
      const deletedId = e.detail?.id;
      if (deletedId) {
        setPosts(prev => prev.filter(p => p.id !== deletedId));
        setLikedPosts(prev => prev.filter(p => p.id !== deletedId));
        fetchUserContent(); 
      }
    };

    const handleEngagementUpdate = () => {
      fetchUserContent(); 
    };

    const handleIdentityUpdate = (e: any) => {
      if (e.detail?.id === user.id) fetchUserContent();
    };

    window.addEventListener('vixreel-post-deleted', handleGlobalDelete);
    window.addEventListener('vixreel-user-updated', handleIdentityUpdate);
    window.addEventListener('vixreel-engagement-updated', handleEngagementUpdate);
    window.addEventListener('vixreel-post-updated', handleEngagementUpdate);

    return () => {
      window.removeEventListener('vixreel-post-deleted', handleGlobalDelete);
      window.removeEventListener('vixreel-user-updated', handleIdentityUpdate);
      window.removeEventListener('vixreel-engagement-updated', handleEngagementUpdate);
      window.removeEventListener('vixreel-post-updated', handleEngagementUpdate);
    };
  }, [user.id]);

  const fetchUserContent = async () => {
    setIsUpdating(true);
    try {
      // Fetch posts by the user
      const { data: pData } = await supabase
        .from('posts')
        .select('*, user:profiles(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (pData) {
        const postsWithLikes = await Promise.all(pData.map(async (p: any) => {
          const { count } = await supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', p.id);
          return { ...p, likes_count: count || 0 };
        }));
        setPosts(postsWithLikes as any);
      }

      // Fetch posts liked by the user
      const { data: lData } = await supabase
        .from('likes')
        .select('post:posts(*, user:profiles(*))')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (lData) {
        setLikedPosts(lData.map((l: any) => l.post).filter(p => p !== null) as any);
      }

      // Fetch groups created by the user
      const { data: gData } = await supabase
        .from('groups')
        .select(`
          *,
          creator:profiles(*)
        `)
        .eq('creator_id', user.id)
        .order('created_at', { ascending: false });
      
      if (gData) {
        const groupsWithCounts = await Promise.all(gData.map(async (g) => {
          const { count } = await supabase
            .from('group_members')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', g.id);
          return { ...g, member_count: count || 0 };
        }));
        setUserGroups(groupsWithCounts);
      }

      // CORRECTED: Count followers (people following this user)
      const { count: fCount } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', user.id);

      // CORRECTED: Count following (people this user follows)
      const { count: ingCount } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', user.id);

      const { data: freshProfile } = await supabase.from('profiles').select('boosted_followers').eq('id', user.id).maybeSingle();
      const boostedFollowers = freshProfile?.boosted_followers || 0;
      
      let totalLikesSum = 0;
      if (pData && pData.length > 0) {
        const postIds = pData.map(p => p.id);
        const { count: realLikesTotal } = await supabase.from('likes').select('*', { count: 'exact', head: true }).in('post_id', postIds);
        const totalBoosted = pData.reduce((acc, p) => acc + (p.boosted_likes || 0), 0);
        totalLikesSum = (realLikesTotal || 0) + totalBoosted;
      }

      setCounts({ 
        followers: (fCount || 0) + boostedFollowers, 
        following: ingCount || 0, 
        likes: totalLikesSum 
      });

      const { data: { session } } = await supabase.auth.getSession();
      if (session && user.id !== session.user.id) {
        const { data } = await supabase.from('follows').select('*').eq('follower_id', session.user.id).eq('following_id', user.id).maybeSingle();
        setIsFollowing(!!data);
      }
    } catch (err) {
      console.error("Profile content fetch error:", err);
    } finally { 
      setIsUpdating(false); 
    }
  };

  const handleOpenSocial = async (type: 'FOLLOWERS' | 'FOLLOWING') => {
    if (isOwnProfile) {
      // Owner can always see
    } else {
      // Privacy check for followers
      if (type === 'FOLLOWERS') {
        if (user.show_followers_to === 'ONLY_ME') return;
        if (user.show_followers_to === 'FOLLOWERS' && !isFollowing) return;
      }
      // Privacy check for following
      if (type === 'FOLLOWING' && !user.is_following_public) return;
      
      // General private account check
      if (user.is_private && !isFollowing) return;
    }

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

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditUsername(user.username);
    setEditBio(user.bio || '');
    setEditAvatarUrl(user.avatar_url);
    setEditCoverUrl(user.cover_url);
    setEditAvatarFile(null);
    setEditCoverFile(null);
  };

  const saveProfileChanges = async () => {
    if (!editUsername.trim()) {
      alert("Username cannot be empty.");
      return;
    }

    setIsSavingProfile(true);
    try {
      const { data: { user: authUser }, error: sessionError } = await supabase.auth.getUser();
      if (sessionError || !authUser) {
        throw new Error("Identity verification failed. Please re-authenticate.");
      }
      
      const activeUid = authUser.id;
      let finalAvatarUrl = editAvatarUrl;
      let finalCoverUrl = editCoverUrl;

      // Helper for uploading
      const uploadMedia = async (file: File, type: 'avatar' | 'cover') => {
        // Validation
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`${type === 'avatar' ? 'Avatar' : 'Cover'} file is too large (max 10MB).`);
        }
        if (!file.type.startsWith('image/')) {
          throw new Error(`${type === 'avatar' ? 'Avatar' : 'Cover'} must be an image.`);
        }

        const ext = file.name.split('.').pop() || 'png';
        const safeName = sanitizeFilename(file.name);
        const path = `${activeUid}/${type}-${Date.now()}-${safeName}`;
        
        const { error: uploadErr } = await supabase.storage
          .from('avatars')
          .upload(path, file, { 
            upsert: true,
            contentType: file.type
          });
        
        if (uploadErr) {
          console.error(`${type} Upload Fail:`, uploadErr);
          throw new Error(`${type === 'avatar' ? 'Avatar' : 'Cover'} Sync: ${uploadErr.message}`);
        }
        
        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(path);
          
        return publicUrl;
      };

      if (editAvatarFile) {
        finalAvatarUrl = await uploadMedia(editAvatarFile, 'avatar');
      }

      if (editCoverFile) {
        finalCoverUrl = await uploadMedia(editCoverFile, 'cover');
      }

      const { error: updateErr } = await supabase
        .from('profiles')
        .update({
          username: editUsername.toLowerCase().trim(),
          bio: editBio.trim(),
          avatar_url: finalAvatarUrl,
          cover_url: finalCoverUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', activeUid);

      if (updateErr) throw updateErr;

      onUpdateProfile({ 
        username: editUsername.toLowerCase().trim(), 
        bio: editBio.trim(), 
        avatar_url: finalAvatarUrl, 
        cover_url: finalCoverUrl 
      });
      
      setIsEditModalOpen(false);
      setEditAvatarFile(null);
      setEditCoverFile(null);
      
      // Notify other components
      window.dispatchEvent(new CustomEvent('vixreel-user-updated', { 
        detail: { 
          id: activeUid,
          username: editUsername.toLowerCase().trim(),
          bio: editBio.trim(),
          avatar_url: finalAvatarUrl,
          cover_url: finalCoverUrl
        } 
      }));

    } catch (err: any) {
      console.error("VixReel Identity Sync Error:", err);
      alert(err.message || "Failed to synchronize profile changes.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <div className="max-w-[935px] mx-auto animate-vix-in pb-32">
      <div className="relative h-48 sm:h-64 w-full bg-[var(--vix-secondary)] group">
        {user.cover_url ? (
          <img src={user.cover_url} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[var(--vix-secondary)] to-[var(--vix-bg)] flex items-center justify-center opacity-30">
             <ImageIcon className="w-12 h-12 text-zinc-700" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-all"></div>
        
        <div className="absolute -bottom-12 left-6 sm:left-12 flex items-end gap-6 sm:gap-8">
           <div className="relative">
              <div className="w-28 h-28 sm:w-40 sm:h-40 rounded-full p-1 bg-[var(--vix-bg)] ring-4 ring-[var(--vix-bg)] shadow-2xl overflow-hidden">
                <img src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.username}`} className="w-full h-full rounded-full object-cover bg-[var(--vix-secondary)]" />
              </div>
           </div>
           <div className="pb-4 hidden sm:block">
              <h2 className="text-2xl font-black text-white flex items-center gap-1.5 drop-shadow-md">
                @{user.username} {user.is_verified && <VerificationBadge size="w-4 h-4" />}
              </h2>
           </div>
        </div>
      </div>

      <div className="mt-20 px-6 sm:px-12 flex flex-col items-center sm:items-start sm:flex-row justify-between gap-10">
        <div className="space-y-6 w-full sm:w-auto text-center sm:text-left">
          <div className="sm:hidden">
            <h2 className="text-3xl font-black text-[var(--vix-text)] flex items-center justify-center gap-1.5">
              @{user.username} {user.is_verified && <VerificationBadge size="w-5 h-5" />}
            </h2>
          </div>
          <div className="max-w-lg mx-auto sm:mx-0 space-y-2">
            <h3 className="font-bold text-[var(--vix-text)]">{user.full_name || user.username}</h3>
            {user.location && !user.is_location_private && (
              <div className="flex items-center justify-center sm:justify-start gap-1 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                <MapPin className="w-3 h-3 text-pink-500" />
                {user.location}
              </div>
            )}
            <p className="text-zinc-500 text-sm whitespace-pre-wrap leading-relaxed">{user.bio || 'Initial bio signal pending...'}</p>
          </div>
          
          <div className="flex justify-center sm:justify-start gap-12 border-t border-[var(--vix-border)] pt-6">
            <div 
              onClick={() => handleOpenSocial('FOLLOWERS')} 
              className={`flex flex-col items-center cursor-pointer group ${(!isOwnProfile && (user.show_followers_to === 'ONLY_ME' || (user.show_followers_to === 'FOLLOWERS' && !isFollowing) || (user.is_private && !isFollowing))) ? 'opacity-30' : ''}`}
            >
              <span className="font-black text-[var(--vix-text)] text-lg group-hover:text-blue-500 transition-colors">
                {(!isOwnProfile && (user.show_followers_to === 'ONLY_ME' || (user.show_followers_to === 'FOLLOWERS' && !isFollowing) || (user.is_private && !isFollowing))) ? <Lock className="w-3 h-3" /> : counts.followers}
              </span>
              <span className="text-[9px] text-zinc-600 font-black uppercase tracking-widest">Followers</span>
            </div>
            <div 
              onClick={() => handleOpenSocial('FOLLOWING')} 
              className={`flex flex-col items-center cursor-pointer group ${(!isOwnProfile && (!user.is_following_public || (user.is_private && !isFollowing))) ? 'opacity-30' : ''}`}
            >
              <span className="font-black text-[var(--vix-text)] text-lg group-hover:text-blue-500 transition-colors">
                {(!isOwnProfile && (!user.is_following_public || (user.is_private && !isFollowing))) ? <Lock className="w-3 h-3" /> : counts.following}
              </span>
              <span className="text-[9px] text-zinc-600 font-black uppercase tracking-widest">Following</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="font-black text-[var(--vix-text)] text-lg">{counts.likes}</span>
              <span className="text-[9px] text-zinc-600 font-black uppercase tracking-widest">Likes</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-center">
          {isOwnProfile ? (
            <div className="flex items-center gap-3">
              <button onClick={() => setIsEditModalOpen(true)} className="bg-[var(--vix-secondary)] px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-[var(--vix-border)] hover:bg-[var(--vix-card)] text-[var(--vix-text)] transition-all shadow-xl">Edit Profile</button>
              <button 
                onClick={onNavigateToGroups}
                className="p-3 bg-[var(--vix-secondary)] rounded-2xl text-zinc-700 hover:text-pink-500 transition-all border border-[var(--vix-border)] shadow-xl"
                title="Communities"
              >
                <Users className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <>
              <button onClick={handleFollow} className={`px-10 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${isFollowing ? 'bg-[var(--vix-secondary)] text-zinc-500 border border-[var(--vix-border)]' : 'vix-gradient text-white shadow-2xl shadow-blue-500/10'}`}>
                {isFollowing ? 'Following' : 'Follow'}
              </button>
              <button onClick={() => onMessageUser?.(user)} className="bg-[var(--vix-secondary)] px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-[var(--vix-border)] text-[var(--vix-text)] shadow-xl hover:bg-[var(--vix-card)]">Message</button>
            </>
          )}
          {isOwnProfile && (
            <button onClick={onOpenSettings} className="p-3 bg-[var(--vix-secondary)] border border-[var(--vix-border)] rounded-2xl text-zinc-500 hover:text-[var(--vix-text)] transition-all"><Settings className="w-5 h-5" /></button>
          )}
        </div>
      </div>

      <div className="mt-12 px-4 border-t border-[var(--vix-border)]">
        <div className="flex justify-center gap-12">
          <button onClick={() => setActiveTab('POSTS')} className={`flex items-center gap-2 py-4 border-t-2 transition-all font-black text-[10px] uppercase tracking-widest ${activeTab === 'POSTS' ? 'border-[var(--vix-text)] text-[var(--vix-text)]' : 'border-transparent text-zinc-500'}`}><Grid className="w-4 h-4" /> Posts</button>
          <button onClick={() => setActiveTab('LIKES')} className={`flex items-center gap-2 py-4 border-t-2 transition-all font-black text-[10px] uppercase tracking-widest ${activeTab === 'LIKES' ? 'border-[var(--vix-text)] text-[var(--vix-text)]' : 'border-transparent text-zinc-500'}`}><Heart className="w-4 h-4" /> Liked</button>
          {!isOwnProfile && (
            <button onClick={() => setActiveTab('GROUPS')} className={`flex items-center gap-2 py-4 border-t-2 transition-all font-black text-[10px] uppercase tracking-widest ${activeTab === 'GROUPS' ? 'border-[var(--vix-text)] text-[var(--vix-text)]' : 'border-transparent text-zinc-500'}`}><Users className="w-4 h-4" /> Groups</button>
          )}
        </div>

        {activeTab === 'GROUPS' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            {userGroups.length === 0 ? (
              <div className="col-span-full py-20 text-center space-y-4 opacity-20">
                <Users className="w-16 h-16 mx-auto" />
                <p className="font-black uppercase tracking-widest text-xs">No groups created yet</p>
              </div>
            ) : (
              userGroups.map(group => (
                <div 
                  key={group.id} 
                  onClick={() => onSelectGroup?.(group)}
                  className="bg-[var(--vix-card)] border border-[var(--vix-border)] rounded-[2rem] overflow-hidden shadow-xl hover:border-pink-500/30 transition-all cursor-pointer group"
                >
                  <div className="h-24 relative">
                    <img src={group.cover_url} className="w-full h-full object-cover" alt={group.name} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  </div>
                  <div className="p-4 space-y-1">
                    <h3 className="text-sm font-black text-[var(--vix-text)] group-hover:text-pink-500 transition-colors">{group.name}</h3>
                    <div className="flex items-center gap-2">
                      <Users className="w-3 h-3 text-zinc-700" />
                      <span className="text-[9px] text-zinc-700 font-black uppercase tracking-widest">{group.member_count} Members</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1 sm:gap-4 mt-4">
            {(activeTab === 'POSTS' ? posts : likedPosts).map((post) => (
              <div 
                key={post.id} 
                onClick={() => setSelectedPost(post)}
                className="aspect-square bg-[var(--vix-card)] relative group cursor-pointer overflow-hidden rounded-xl border border-[var(--vix-border)] shadow-xl transition-transform hover:scale-[1.02]"
              >
                {post.media_type === 'video' ? <video src={post.media_url} className="w-full h-full object-cover" /> : <img src={post.media_url} className="w-full h-full object-cover" />}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all backdrop-blur-sm">
                  <Heart className="w-8 h-8 text-white fill-white shadow-2xl" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedPost && (
        <div className="fixed inset-0 z-[10002] bg-black/95 flex items-center justify-center p-4 backdrop-blur-xl animate-vix-in">
          <button 
            onClick={() => setSelectedPost(null)}
            className="absolute top-8 right-8 p-3 text-white/50 hover:text-white transition-colors bg-white/10 rounded-full border border-white/10 z-[10003]"
          >
            <X className="w-8 h-8" />
          </button>
          <div className="w-full max-w-lg">
             <Post 
               post={selectedPost} 
               currentUserId={user.id} 
               onDelete={(id) => {
                 setPosts(prev => prev.filter(p => p.id !== id));
                 setSelectedPost(null);
               }}
               onUpdate={fetchUserContent}
               onSelectUser={(u) => {
                 setSelectedPost(null);
                 // If it's a different user, we might need to handle navigation
                 // but for now we'll just close the modal
               }}
             />
          </div>
        </div>
      )}

      {isSocialModalOpen && (
        <div className="fixed inset-0 z-[10001] bg-[var(--vix-bg)]/95 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="w-full max-w-sm bg-[var(--vix-card)] border border-[var(--vix-border)] rounded-[2.5rem] overflow-hidden shadow-2xl animate-vix-in">
            <div className="p-6 border-b border-[var(--vix-border)] flex justify-between items-center bg-[var(--vix-secondary)]/20">
              <h3 className="font-black text-[10px] uppercase tracking-[0.3em] text-zinc-500">{socialModalType} Registry</h3>
              <button onClick={() => setIsSocialModalOpen(false)}><X className="w-6 h-6 text-zinc-700 hover:text-[var(--vix-text)]" /></button>
            </div>
            <div className="p-4 space-y-2 overflow-y-auto max-h-[60vh] no-scrollbar">
              {socialLoading ? <Loader2 className="w-8 h-8 text-zinc-800 animate-spin mx-auto my-12" /> : socialUsers.map(u => (
                <div key={u.id} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-[var(--vix-secondary)]/50 transition-colors cursor-pointer group" onClick={() => { setIsSocialModalOpen(false); if (u.id !== user.id) onMessageUser?.(u); }}>
                  <img src={u.avatar_url || `https://ui-avatars.com/api/?name=${u.username}`} className="w-10 h-10 rounded-full object-cover border border-[var(--vix-border)]" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-[var(--vix-text)] flex items-center gap-1.5 truncate">@{u.username} {u.is_verified && <VerificationBadge size="w-3.5 h-3.5" />}</p>
                    <p className="text-[9px] text-zinc-600 font-black uppercase truncate tracking-tighter">{u.full_name || 'Individual Creator'}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-800 group-hover:text-blue-500" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {isEditModalOpen && (
        <div className="fixed inset-0 z-[10000] bg-[var(--vix-bg)]/95 flex items-center justify-center p-6 overflow-y-auto no-scrollbar">
          <div className="w-full max-w-lg bg-[var(--vix-card)] border border-[var(--vix-border)] rounded-[3rem] p-8 sm:p-12 space-y-8 animate-vix-in">
            <div className="flex justify-between items-center">
              <h3 className="font-black uppercase tracking-widest text-[var(--vix-text)]">Modify Identity</h3>
              <button onClick={closeEditModal} className="p-2"><X className="w-6 h-6 text-zinc-500 hover:text-[var(--vix-text)]" /></button>
            </div>
            
            <div className="space-y-6">
               <div className="space-y-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Cover Banner</span>
                  <div className="h-32 w-full bg-[var(--vix-secondary)] rounded-2xl overflow-hidden relative group cursor-pointer border border-[var(--vix-border)]" onClick={() => coverInputRef.current?.click()}>
                     {editCoverUrl ? (
                       <img src={editCoverUrl} className="w-full h-full object-cover opacity-50 group-hover:opacity-30 transition-opacity" />
                     ) : (
                       <div className="w-full h-full flex items-center justify-center bg-[var(--vix-secondary)]"><ImageIcon className="w-10 h-10 text-zinc-800" /></div>
                     )}
                     <div className="absolute inset-0 flex items-center justify-center"><Camera className="w-6 h-6 text-white" /></div>
                     <input ref={coverInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => { 
                       const f = e.target.files?.[0]; 
                       if (f) { 
                         setEditCoverFile(f); 
                         setEditCoverUrl(URL.createObjectURL(f)); 
                       } 
                     }} />
                  </div>
               </div>

               <div className="flex flex-col items-center gap-4">
                  <div className="relative group cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
                     <img src={editAvatarUrl || `https://ui-avatars.com/api/?name=${editUsername}`} className="w-24 h-24 rounded-full object-cover bg-[var(--vix-secondary)] border-2 border-[var(--vix-border)] group-hover:opacity-50 shadow-2xl" />
                     <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Camera className="w-6 h-6 text-white" /></div>
                  </div>
                  <input ref={avatarInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => { 
                    const f = e.target.files?.[0]; 
                    if (f) { 
                      setEditAvatarFile(f); 
                      setEditAvatarUrl(URL.createObjectURL(f)); 
                    } 
                  }} />
               </div>

               <div className="space-y-4">
                  <input value={editUsername} onChange={e => setEditUsername(e.target.value)} className="w-full bg-[var(--vix-secondary)] border border-[var(--vix-border)] rounded-2xl px-6 py-4 text-sm text-[var(--vix-text)] outline-none focus:border-blue-500/50 transition-all" placeholder="Handle" />
                  <textarea value={editBio} onChange={e => setEditBio(e.target.value)} className="w-full h-32 bg-[var(--vix-secondary)] border border-[var(--vix-border)] rounded-2xl px-6 py-4 text-sm text-[var(--vix-text)] outline-none resize-none focus:border-blue-500/50 transition-all" placeholder="Narrative bio..." />
                  <button onClick={saveProfileChanges} disabled={isSavingProfile} className="w-full vix-gradient py-5 rounded-[2rem] font-black text-white text-[11px] uppercase tracking-widest disabled:opacity-50 shadow-2xl shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-3">
                    {isSavingProfile ? <><Loader2 className="w-5 h-5 animate-spin" /> Transmitting...</> : 'Synchronize Identity'}
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
