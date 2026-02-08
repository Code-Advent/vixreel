
import React, { useState, useEffect, useRef } from 'react';
import { 
  Grid, Heart, Camera, Settings, User as UserIcon, Loader2, X, Check, 
  ShieldCheck, Globe, Phone, MoreVertical, Lock, MessageSquareOff, EyeOff, Eye,
  LogOut, ShieldAlert, KeyRound, UserMinus, ShieldCheck as VerifiedIcon, Upload
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
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Edit Form State
  const [editUsername, setEditUsername] = useState(user.username);
  const [editBio, setEditBio] = useState(user.bio || '');
  const [editAvatarUrl, setEditAvatarUrl] = useState(user.avatar_url);
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Settings State
  const [isPrivate, setIsPrivate] = useState(user.is_private || false);
  const [allowComments, setAllowComments] = useState(user.allow_comments !== false);
  const [newPassword, setNewPassword] = useState('');

  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchUserContent();
    const handleEngagementUpdate = () => fetchUserContent();
    window.addEventListener('vixreel-engagement-updated', handleEngagementUpdate);
    return () => window.removeEventListener('vixreel-engagement-updated', handleEngagementUpdate);
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

      // 1. Upload Avatar if changed
      if (editAvatarFile) {
        const safeName = sanitizeFilename(editAvatarFile.name);
        const fileName = `${user.id}-${Date.now()}-${safeName}`;
        const filePath = `avatars/${fileName}`;
        const { error: upErr } = await supabase.storage.from('avatars').upload(filePath, editAvatarFile);
        if (upErr) throw upErr;
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
        finalAvatarUrl = publicUrl;
      }

      // 2. Update Profile Table
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ 
          username: editUsername.toLowerCase().trim(),
          bio: editBio.trim(),
          avatar_url: finalAvatarUrl
        })
        .eq('id', user.id);
      
      if (updateErr) throw updateErr;

      onUpdateProfile({ 
        username: editUsername, 
        bio: editBio, 
        avatar_url: finalAvatarUrl 
      });
      setIsEditModalOpen(false);
      alert("Profile updated successfully!");
    } catch (err: any) {
      alert("Update Failed: " + err.message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const applyPrivacySettings = async () => {
    try {
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ is_private: isPrivate, allow_comments: allowComments })
        .eq('id', user.id);
      
      if (profileErr) throw profileErr;
      
      onUpdateProfile({ is_private: isPrivate, allow_comments: allowComments });
      setIsSettingsOpen(false);
      alert("Settings saved!");
    } catch (err: any) {
      alert("Failed to save settings: " + err.message);
    }
  };

  return (
    <div className="max-w-[935px] mx-auto py-12 px-4 animate-vix-in pb-32">
      {/* Header Area */}
      <div className="flex justify-between items-center mb-12">
        <h2 className="text-xl font-bold uppercase tracking-widest text-white">Profile</h2>
        {isOwnProfile && (
          <button 
            onClick={() => setIsSettingsOpen(true)} 
            className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-2xl text-zinc-400 hover:text-white"
          >
            <Settings className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="flex flex-col md:flex-row items-center md:items-start gap-12 mb-20">
        <div className="relative w-36 h-36 sm:w-44 sm:h-44 shrink-0">
          <div className="w-full h-full rounded-full p-1 border border-zinc-800">
            <img 
              src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.username}`} 
              className="w-full h-full rounded-full object-cover bg-zinc-900" 
            />
          </div>
        </div>

        <div className="flex-1 space-y-8 text-center md:text-left">
          <div className="flex flex-col sm:flex-row items-center gap-8">
            <h2 className="text-3xl font-bold text-white flex items-center gap-2">
              @{user.username} {user.is_verified && <VerificationBadge size="w-7 h-7" />}
            </h2>
            <div className="flex gap-3 w-full sm:w-auto">
              {isOwnProfile ? (
                <button 
                  onClick={() => {
                    setEditUsername(user.username);
                    setEditBio(user.bio || '');
                    setEditAvatarUrl(user.avatar_url);
                    setIsEditModalOpen(true);
                  }} 
                  className="flex-1 sm:flex-none bg-zinc-900 px-8 py-3 rounded-2xl text-xs font-bold border border-zinc-800 hover:bg-zinc-800 text-white"
                >
                  Edit Profile
                </button>
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
            <div className="flex flex-col items-center sm:items-baseline">
              <span className="font-bold text-xl text-white">{counts.followers}</span>
              <span className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest">Followers</span>
            </div>
            <div className="flex flex-col items-center sm:items-baseline">
              <span className="font-bold text-xl text-white">{counts.following}</span>
              <span className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest">Following</span>
            </div>
          </div>

          <div>
            <div className="font-bold text-white mb-1">{user.full_name || user.username}</div>
            <p className="text-zinc-500 text-sm whitespace-pre-wrap">{user.bio || 'No bio yet.'}</p>
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[10000] bg-black/95 flex items-center justify-center p-6 overflow-y-auto">
          <div className="w-full max-w-lg bg-zinc-950 border border-zinc-900 rounded-[2.5rem] p-8 space-y-8 animate-vix-in">
            <div className="flex justify-between items-center">
               <h3 className="font-bold text-lg text-white">Edit Profile</h3>
               <button onClick={() => setIsEditModalOpen(false)} className="p-2"><X className="w-6 h-6 text-zinc-500" /></button>
            </div>

            {/* Avatar Edit */}
            <div className="flex flex-col items-center gap-4">
               <div className="relative group cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
                  <img src={editAvatarUrl || `https://ui-avatars.com/api/?name=${editUsername}`} className="w-24 h-24 rounded-full object-cover bg-zinc-900 border-2 border-zinc-800 group-hover:opacity-50 transition-opacity" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
               </div>
               <button onClick={() => avatarInputRef.current?.click()} className="text-xs font-bold text-pink-500 uppercase tracking-widest">Change Photo</button>
               <input 
                  ref={avatarInputRef} 
                  type="file" 
                  className="hidden" 
                  accept="image/*" 
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setEditAvatarFile(file);
                      setEditAvatarUrl(URL.createObjectURL(file));
                    }
                  }} 
               />
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                 <label className="text-[10px] font-bold uppercase text-zinc-500 ml-4">Username</label>
                 <input 
                   value={editUsername} 
                   onChange={e => setEditUsername(e.target.value)} 
                   className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-6 py-4 text-sm text-white outline-none focus:border-pink-500/50" 
                   placeholder="Your username"
                 />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-bold uppercase text-zinc-500 ml-4">Bio</label>
                 <textarea 
                   value={editBio} 
                   onChange={e => setEditBio(e.target.value)} 
                   className="w-full h-32 bg-zinc-900 border border-zinc-800 rounded-2xl px-6 py-4 text-sm text-white outline-none focus:border-pink-500/50 resize-none" 
                   placeholder="Tell us about yourself..."
                 />
              </div>
              <button 
                onClick={saveProfileChanges} 
                disabled={isSavingProfile}
                className="w-full vix-gradient py-5 rounded-[2rem] font-bold text-white flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {isSavingProfile ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grid Content */}
      <div className="border-t border-zinc-900 flex justify-center gap-12 mb-8">
        <button onClick={() => setActiveTab('POSTS')} className={`flex items-center gap-2 py-4 border-t-2 transition-all font-bold text-xs uppercase tracking-widest ${activeTab === 'POSTS' ? 'border-white text-white' : 'border-transparent text-zinc-700'}`}><Grid className="w-4 h-4" /> Posts</button>
        <button onClick={() => setActiveTab('LIKES')} className={`flex items-center gap-2 py-4 border-t-2 transition-all font-bold text-xs uppercase tracking-widest ${activeTab === 'LIKES' ? 'border-white text-white' : 'border-transparent text-zinc-700'}`}><Heart className="w-4 h-4" /> Liked</button>
      </div>

      <div className="grid grid-cols-3 gap-1 sm:gap-4">
        {(activeTab === 'POSTS' ? posts : likedPosts).map((post) => (
          <div key={post.id} className="aspect-square bg-zinc-900 relative group cursor-pointer overflow-hidden rounded-md border border-zinc-800/50 transition-all hover:scale-[1.02]">
            {post.media_type === 'video' ? (
              <video src={post.media_url} className="w-full h-full object-cover" />
            ) : (
              <img src={post.media_url} className="w-full h-full object-cover" alt="Post" />
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
              <Heart className="w-6 h-6 fill-white" />
            </div>
          </div>
        ))}
      </div>
      
      {/* Settings Modal (Privacy) */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[10000] bg-black/95 flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-900 rounded-[2.5rem] p-8 space-y-10 animate-vix-in">
            <div className="flex justify-between items-center">
               <h3 className="font-bold text-lg text-white">Privacy Settings</h3>
               <button onClick={() => setIsSettingsOpen(false)}><X className="w-6 h-6 text-zinc-500" /></button>
            </div>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-2xl border border-zinc-800">
                <div>
                  <div className="text-sm font-bold text-white">Private Account</div>
                  <div className="text-[10px] text-zinc-500">Only followers can see your posts</div>
                </div>
                <button 
                  onClick={() => setIsPrivate(!isPrivate)} 
                  className={`w-12 h-6 rounded-full p-1 transition-all ${isPrivate ? 'bg-pink-500' : 'bg-zinc-700'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full transition-all ${isPrivate ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-2xl border border-zinc-800">
                <div>
                  <div className="text-sm font-bold text-white">Allow Comments</div>
                  <div className="text-[10px] text-zinc-500">Allow people to comment on your posts</div>
                </div>
                <button 
                  onClick={() => setAllowComments(!allowComments)} 
                  className={`w-12 h-6 rounded-full p-1 transition-all ${allowComments ? 'bg-green-500' : 'bg-zinc-700'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full transition-all ${allowComments ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              <button 
                onClick={applyPrivacySettings} 
                className="w-full vix-gradient py-4 rounded-2xl font-bold text-white"
              >
                Save Settings
              </button>
              
              <button 
                onClick={() => { setIsSettingsOpen(false); onLogout?.(); }}
                className="w-full py-4 border border-red-500/20 text-red-500 rounded-2xl font-bold text-xs"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
