
import React, { useState, useEffect } from 'react';
import { Grid, Heart, Camera, Video, Settings, User as UserIcon, Loader2, X, Check, AlertCircle, ChevronLeft, ChevronRight, Plus, ShieldCheck, Globe, Phone } from 'lucide-react';
import { UserProfile, Post as PostType, Story } from '../types';
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
  const [likedPosts, setLikedPosts] = useState<PostType[]>([]);
  const [activeTab, setActiveTab] = useState<'POSTS' | 'LIKES'>('POSTS');
  const [counts, setCounts] = useState({ followers: 0, following: 0, appreciation: 0 });
  const [isFollowing, setIsFollowing] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingStory, setIsUploadingStory] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [editUsername, setEditUsername] = useState(user.username || '');
  const [editName, setEditName] = useState(user.full_name || '');
  const [editBio, setEditBio] = useState(user.bio || '');
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Stories Logic
  const [userStories, setUserStories] = useState<Story[]>([]);
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);

  useEffect(() => {
    fetchUserContent();
    fetchUserStories();
    setEditUsername(user.username || '');
    setEditName(user.full_name || '');
    setEditBio(user.bio || '');

    const handleEngagementUpdate = () => {
      fetchUserContent();
    };
    window.addEventListener('vixreel-engagement-updated', handleEngagementUpdate);
    return () => window.removeEventListener('vixreel-engagement-updated', handleEngagementUpdate);
  }, [user.id]);

  const fetchUserStories = async () => {
    const { data } = await supabase
      .from('stories')
      .select('*, user:profiles(*)')
      .eq('user_id', user.id)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: true });
    
    if (data) setUserStories(data as any);
  };

  const handleStoryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingStory(true);
    const safeFilename = sanitizeFilename(file.name);
    const fileName = `${user.id}-${Date.now()}-${safeFilename}`;
    const filePath = `active/${fileName}`;
    const mType = file.type.startsWith('video') ? 'video' : 'image';

    try {
      const { error: uploadError } = await supabase.storage
        .from('stories')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('stories').getPublicUrl(filePath);
      
      const { error: dbError } = await supabase.from('stories').insert({
        user_id: user.id,
        media_url: publicUrl,
        media_type: mType
      });

      if (dbError) throw dbError;
      await fetchUserStories();
    } catch (err: any) {
      alert("Story transmission failed: " + err.message);
    } finally {
      setIsUploadingStory(false);
    }
  };

  const fetchUserContent = async () => {
    setIsUpdating(true);
    try {
      const { data: pData } = await supabase
        .from('posts')
        .select('*, user:profiles(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (pData) setPosts(pData as any);

      const { data: lData } = await supabase
        .from('likes')
        .select('post:posts(*, user:profiles(*))')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (lData) {
        const validLikedPosts = lData.map((l: any) => l.post).filter(p => p !== null);
        setLikedPosts(validLikedPosts as any);
      }
      
      const { count: fCount } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', user.id);
      const { count: ingCount } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', user.id);
      
      let totalAppreciation = 0;
      if (pData) {
        for (const post of pData) {
          const { count } = await supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', post.id);
          totalAppreciation += (count || 0) + (post.boosted_likes || 0);
        }
      }

      setCounts({ 
        followers: fCount || 0, 
        following: ingCount || 0,
        appreciation: totalAppreciation
      });

      const { data: { session } } = await supabase.auth.getSession();
      if (session && user.id !== session.user.id) {
        const { data } = await supabase.from('follows').select('*').eq('follower_id', session.user.id).eq('following_id', user.id).maybeSingle();
        setIsFollowing(!!data);
      }
    } catch (error) {
      console.error("Profile Sync Error", error);
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
      if (wasFollowing) {
        await supabase.from('follows').delete().eq('follower_id', session.user.id).eq('following_id', user.id);
      } else {
        await supabase.from('follows').insert({ follower_id: session.user.id, following_id: user.id });
      }
      fetchUserContent();
    } catch (err) {
      setIsFollowing(wasFollowing);
    }
  };

  const handleAvatarClick = () => {
    if (userStories.length > 0) {
      setActiveStoryIndex(0);
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setEditError(null);
    const cleanUsername = editUsername.trim().toLowerCase().replace(/\s+/g, '');
    if (!cleanUsername) {
      setEditError("Identity handle required.");
      setIsSaving(false);
      return;
    }
    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ username: cleanUsername, full_name: editName.trim(), bio: editBio.trim() })
        .eq('id', user.id);
      
      if (profileError) {
        if (profileError.code === '23505') throw new Error("Handle occupied by another core.");
        throw profileError;
      }

      onUpdateProfile({ username: cleanUsername, full_name: editName.trim(), bio: editBio.trim() });
      setIsEditModalOpen(false);
    } catch (err: any) {
      setEditError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const getRegionFromPhone = (phone?: string) => {
    if (!phone) return 'Unknown Void';
    if (phone.startsWith('+1')) return 'North America';
    if (phone.startsWith('+44')) return 'United Kingdom';
    if (phone.startsWith('+91')) return 'India';
    if (phone.startsWith('+234')) return 'Nigeria';
    if (phone.startsWith('+61')) return 'Australia';
    if (phone.startsWith('+81')) return 'Japan';
    if (phone.startsWith('+49')) return 'Germany';
    if (phone.startsWith('+33')) return 'France';
    return 'International Grid';
  };

  const currentGridPosts = activeTab === 'POSTS' ? posts : likedPosts;

  // Detect login method from Supabase session if possible
  const [loginMethod, setLoginMethod] = useState<string | null>(null);
  useEffect(() => {
    const checkSession = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      setLoginMethod(authUser?.user_metadata?.login_method || 'EMAIL');
    };
    checkSession();
  }, []);

  const showPhoneDetails = isOwnProfile && loginMethod === 'PHONE';

  return (
    <div className="max-w-[935px] mx-auto py-12 px-4 animate-vix-in pb-20">
      <div className="flex flex-col md:flex-row items-center md:items-start gap-12 mb-16">
        <div className="relative w-32 h-32 sm:w-40 sm:h-40 shrink-0">
          <div 
            onClick={handleAvatarClick}
            className={`w-full h-full rounded-full p-1 cursor-pointer transition-transform active:scale-95 ${userStories.length > 0 ? 'vix-gradient shadow-[0_0_20px_rgba(255,0,128,0.3)]' : 'border border-zinc-800'}`}
          >
            <div className="w-full h-full rounded-full bg-black p-1 overflow-hidden relative group">
              {user.avatar_url ? (
                <img src={user.avatar_url} className="w-full h-full rounded-full object-cover" alt={user.username} />
              ) : (
                <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-zinc-800"><UserIcon className="w-12 h-12" /></div>
              )}
              {isOwnProfile && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-8 h-8 text-white" />
                  <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setIsUploadingAvatar(true);
                    const fileName = `${user.id}-${Date.now()}-${sanitizeFilename(file.name)}`;
                    await supabase.storage.from('avatars').upload(`avatars/${fileName}`, file);
                    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(`avatars/${fileName}`);
                    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
                    onUpdateProfile({ avatar_url: publicUrl });
                    setIsUploadingAvatar(false);
                  }} />
                </div>
              )}
            </div>
          </div>
          {isOwnProfile && (
            <label className="absolute bottom-0 right-0 bg-blue-500 rounded-full p-2 border-4 border-black cursor-pointer hover:scale-110 transition-transform shadow-xl">
              {isUploadingStory ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Plus className="w-4 h-4 text-white" />}
              <input type="file" className="hidden" accept="image/*,video/*" onChange={handleStoryUpload} disabled={isUploadingStory} />
            </label>
          )}
        </div>

        <div className="flex-1 space-y-6 text-center md:text-left">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <h2 className="text-2xl font-black flex items-center gap-1.5">
              @{user.username}
              {user.is_verified && <VerificationBadge size="w-6 h-6" />}
            </h2>
            <div className="flex gap-2 w-full sm:w-auto">
              {isOwnProfile ? (
                <>
                  <button onClick={() => setIsEditModalOpen(true)} className="flex-1 sm:flex-none bg-zinc-900 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-zinc-800 hover:bg-zinc-800 transition-all">Edit Protocol</button>
                  <button onClick={() => setIsSettingsModalOpen(true)} className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800 transition-all"><Settings className="w-4 h-4 text-zinc-500" /></button>
                </>
              ) : (
                <>
                  <button onClick={handleFollow} className={`flex-1 sm:flex-none px-8 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isFollowing ? 'bg-zinc-900 text-zinc-500 border border-zinc-800' : 'vix-gradient text-white shadow-lg'}`}>
                    {isFollowing ? 'Disconnecting' : 'Connect'}
                  </button>
                  <button onClick={() => onMessageUser?.(user)} className="flex-1 sm:flex-none bg-zinc-900 px-8 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-zinc-800 hover:bg-zinc-800 transition-all">Direct Signal</button>
                </>
              )}
            </div>
          </div>

          <div className="flex justify-center md:justify-start gap-10">
            <div className="flex flex-col items-center sm:items-baseline">
              <span className="font-black text-lg">{formatNumber(posts.length)}</span>
              <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Artifacts</span>
            </div>
            <div className="flex flex-col items-center sm:items-baseline">
              <span className="font-black text-lg">{formatNumber(counts.followers)}</span>
              <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Audiences</span>
            </div>
            <div className="flex flex-col items-center sm:items-baseline">
              <span className="font-black text-lg">{formatNumber(counts.following)}</span>
              <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Signals</span>
            </div>
            <div className="flex flex-col items-center sm:items-baseline">
              <span className="font-black text-lg text-pink-500">{formatNumber(counts.appreciation)}</span>
              <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Karma</span>
            </div>
          </div>

          <div className="text-sm">
            <div className="font-black text-white mb-1 uppercase tracking-wider">{user.full_name || user.username}</div>
            <p className="text-zinc-400 font-medium leading-relaxed max-w-sm mx-auto md:mx-0">{user.bio || 'Digital Narrator • VixReel Core'}</p>
          </div>
        </div>
      </div>

      <div className="border-t border-zinc-900 flex justify-center gap-12 sm:gap-16">
        <button 
          onClick={() => setActiveTab('POSTS')} 
          className={`flex items-center gap-2 py-4 border-t-2 transition-all font-black uppercase tracking-widest text-[10px] ${activeTab === 'POSTS' ? 'border-white text-white' : 'border-transparent text-zinc-600'}`}
        >
          <Grid className="w-4 h-4" /> Artifact Grid
        </button>
        <button 
          onClick={() => setActiveTab('LIKES')} 
          className={`flex items-center gap-2 py-4 border-t-2 transition-all font-black uppercase tracking-widest text-[10px] ${activeTab === 'LIKES' ? 'border-white text-white' : 'border-transparent text-zinc-600'}`}
        >
          <Heart className="w-4 h-4" /> Liked Injections
        </button>
      </div>

      <div className="pt-8">
        <div className="grid grid-cols-3 gap-1 sm:gap-4">
          {currentGridPosts.map((post) => (
            <div key={post.id} className="aspect-square bg-zinc-950 relative group cursor-pointer overflow-hidden rounded-sm sm:rounded-2xl shadow-xl border border-zinc-900/50">
              {post.media_type === 'video' ? (
                <video src={post.media_url} className="w-full h-full object-cover" />
              ) : (
                <img src={post.media_url} className="w-full h-full object-cover" alt="Artifact" />
              )}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all backdrop-blur-sm">
                <Heart className="w-5 h-5 fill-white" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-[2000] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-zinc-950 border border-white/5 rounded-[3rem] p-10 shadow-2xl animate-vix-in relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/10 blur-3xl -z-10"></div>
            
            <div className="flex justify-between items-center mb-10">
              <div className="flex items-center gap-3">
                 <ShieldCheck className="w-6 h-6 text-pink-500" />
                 <h3 className="font-black uppercase text-[11px] tracking-[0.3em] text-white">Security Protocol</h3>
              </div>
              <button onClick={() => setIsSettingsModalOpen(false)} className="p-2 hover:bg-zinc-900 rounded-full transition-colors"><X className="w-5 h-5 text-zinc-500" /></button>
            </div>

            <div className="space-y-6">
              <div className="p-6 bg-zinc-900/30 border border-zinc-900 rounded-[2rem] space-y-6">
                 {showPhoneDetails ? (
                   <>
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-zinc-900 flex items-center justify-center border border-zinc-800 shadow-inner">
                          <Globe className="w-5 h-5 text-zinc-500" />
                        </div>
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-1">Region Anchor</p>
                          <p className="text-sm font-bold text-white">{getRegionFromPhone(user.phone)}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-zinc-900 flex items-center justify-center border border-zinc-800 shadow-inner">
                          <Phone className="w-5 h-5 text-zinc-500" />
                        </div>
                        <div className="flex-1">
                          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-1">Mobile Fragment</p>
                          <p className="text-sm font-bold text-white flex items-center justify-between">
                            {user.phone || 'No Fragment Linked'}
                            {user.phone_verified && <Check className="w-4 h-4 text-green-500" />}
                          </p>
                        </div>
                    </div>
                   </>
                 ) : (
                   <div className="flex items-center gap-4 py-4">
                      <div className="w-10 h-10 rounded-2xl bg-zinc-900 flex items-center justify-center border border-zinc-800 shadow-inner">
                        <ShieldCheck className="w-5 h-5 text-zinc-700" />
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-1">Verification Status</p>
                        <p className="text-sm font-bold text-white">Email Linked Protocol</p>
                      </div>
                   </div>
                 )}
              </div>

              <div className="flex flex-col gap-3">
                 <div className="flex items-center justify-between px-2">
                    <span className="text-[10px] font-black uppercase text-zinc-700 tracking-widest">Encryption Level</span>
                    <span className="text-[9px] font-black text-pink-500 uppercase tracking-widest">Layer 4 AES</span>
                 </div>
                 {showPhoneDetails && (
                   <div className="flex items-center justify-between px-2">
                      <span className="text-[10px] font-black uppercase text-zinc-700 tracking-widest">Core Verification</span>
                      <span className={`text-[9px] font-black uppercase tracking-widest ${user.phone_verified ? 'text-green-500' : 'text-yellow-500'}`}>
                        {user.phone_verified ? 'Authenticated' : 'Pending Linkage'}
                      </span>
                   </div>
                 )}
              </div>
              
              <button 
                onClick={() => setIsSettingsModalOpen(false)}
                className="w-full mt-6 py-4 bg-zinc-900 rounded-2xl font-black uppercase tracking-widest text-[10px] text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
              >
                Close Protocol
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditModalOpen && (
        <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-900 rounded-[2.5rem] p-8 shadow-2xl animate-vix-in">
            <h3 className="font-black uppercase text-[10px] tracking-widest text-zinc-500 mb-8">Override Protocol</h3>
            <div className="space-y-5">
              <div>
                <label className="text-[10px] font-black uppercase text-zinc-700 block mb-2 tracking-widest">Identity Handle</label>
                <input value={editUsername} onChange={e => setEditUsername(e.target.value)} className="w-full bg-black border border-zinc-800 rounded-2xl px-4 py-4 text-sm outline-none focus:border-pink-500/50 transition-all text-white" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-zinc-700 block mb-2 tracking-widest">Bio Manifesto</label>
                <textarea value={editBio} onChange={e => setEditBio(e.target.value)} className="w-full h-24 bg-black border border-zinc-800 rounded-2xl px-4 py-4 text-sm outline-none focus:border-pink-500/50 transition-all text-white resize-none" />
              </div>
              <button onClick={handleSaveProfile} disabled={isSaving} className="w-full vix-gradient py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl">
                {isSaving ? 'Synchronizing...' : 'Upload Protocol'}
              </button>
              <button onClick={() => setIsEditModalOpen(false)} className="w-full text-[10px] font-black uppercase text-zinc-500 py-2">Cancel Transmission</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;

