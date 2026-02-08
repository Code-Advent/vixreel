
import React, { useState, useEffect } from 'react';
import { 
  Grid, Heart, Camera, Settings, User as UserIcon, Loader2, X, Check, 
  ShieldCheck, Globe, Phone, MoreVertical, Lock, MessageSquareOff, EyeOff, Eye,
  LogOut, ShieldAlert, KeyRound, UserMinus, ShieldCheck as VerifiedIcon
} from 'lucide-react';
import { UserProfile, Post as PostType, Story } from '../types';
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
  const [counts, setCounts] = useState({ followers: 0, following: 0, appreciation: 0 });
  const [isFollowing, setIsFollowing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSettingsTerminalOpen, setIsSettingsTerminalOpen] = useState(false);
  
  // Settings State
  const [isPrivate, setIsPrivate] = useState(user.is_private || false);
  const [allowComments, setAllowComments] = useState(user.allow_comments !== false);
  const [newPassword, setNewPassword] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);

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
      
      let totalAppreciation = 0;
      pData?.forEach(post => totalAppreciation += (post.likes_count || 0) + (post.boosted_likes || 0));

      setCounts({ followers: fCount || 0, following: ingCount || 0, appreciation: totalAppreciation });

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

  const applyProtocols = async () => {
    setIsSavingSettings(true);
    try {
      // Update basic settings
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ is_private: isPrivate, allow_comments: allowComments })
        .eq('id', user.id);
      
      if (profileErr) throw profileErr;

      // Update password if present
      if (newPassword.trim().length >= 6) {
        const { error: passErr } = await supabase.auth.updateUser({ password: newPassword });
        if (passErr) throw passErr;
        setNewPassword('');
        alert("Security Signature Synchronized.");
      }

      onUpdateProfile({ is_private: isPrivate, allow_comments: allowComments });
      setIsSettingsTerminalOpen(false);
    } catch (err: any) {
      alert("Protocol Failure: " + (err.message || "Unknown error"));
    } finally {
      setIsSavingSettings(false);
    }
  };

  const currentGridPosts = activeTab === 'POSTS' ? posts : likedPosts;

  return (
    <div className="max-w-[935px] mx-auto py-12 px-4 animate-vix-in pb-32">
      {/* Identity Top Bar */}
      <div className="flex justify-between items-center mb-12">
        <div className="flex items-center gap-3">
           <h2 className="text-xl font-black uppercase tracking-[0.4em] text-white">Identity Core</h2>
           {user.is_private && <Lock className="w-4 h-4 text-zinc-600" />}
        </div>
        {isOwnProfile && (
          <button 
            onClick={() => setIsSettingsTerminalOpen(true)} 
            className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-2xl hover:bg-zinc-800 transition-all text-zinc-400 hover:text-white"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="flex flex-col md:flex-row items-center md:items-start gap-12 mb-20">
        <div className="relative w-36 h-36 sm:w-44 sm:h-44 shrink-0">
          <div className="w-full h-full rounded-full p-1 border border-zinc-800">
            <div className="w-full h-full rounded-full bg-black p-1 overflow-hidden relative group">
              {user.avatar_url ? (
                <img src={user.avatar_url} className="w-full h-full rounded-full object-cover" alt={user.username} />
              ) : (
                <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-zinc-800"><UserIcon className="w-16 h-16" /></div>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-8 text-center md:text-left">
          <div className="flex flex-col sm:flex-row items-center gap-8">
            <h2 className="text-3xl font-black flex items-center gap-2 text-white">
              @{user.username} {user.is_verified && <VerificationBadge size="w-7 h-7" />}
            </h2>
            <div className="flex gap-3 w-full sm:w-auto">
              {isOwnProfile ? (
                <button onClick={() => setIsEditModalOpen(true)} className="flex-1 sm:flex-none bg-zinc-900 px-10 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-zinc-800 hover:bg-zinc-800 transition-all text-white">Override Core</button>
              ) : (
                <>
                  <button onClick={handleFollow} className={`flex-1 sm:flex-none px-10 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${isFollowing ? 'bg-zinc-900 text-zinc-500 border border-zinc-800' : 'vix-gradient text-white shadow-lg'}`}>
                    {isFollowing ? 'Disconnecting' : 'Connect Signal'}
                  </button>
                  <button onClick={() => onMessageUser?.(user)} className="flex-1 sm:flex-none bg-zinc-900 px-10 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-zinc-800 hover:bg-zinc-800 transition-all text-white">Transmit</button>
                </>
              )}
            </div>
          </div>

          <div className="flex justify-center md:justify-start gap-10 sm:gap-16">
            {[
              { val: posts.length, label: 'Artifacts' },
              { val: counts.followers, label: 'Audiences' },
              { val: counts.following, label: 'Signals' },
              { val: counts.appreciation, label: 'Karma', color: 'vix-text-gradient' }
            ].map(s => (
              <div key={s.label} className="flex flex-col items-center sm:items-baseline">
                <span className={`font-black text-2xl ${s.color || 'text-white'}`}>{formatNumber(s.val)}</span>
                <span className="text-zinc-600 text-[10px] font-black uppercase tracking-widest mt-1">{s.label}</span>
              </div>
            ))}
          </div>

          <div className="text-sm">
            <div className="font-black text-white mb-2 uppercase tracking-wider text-lg">{user.full_name || user.username}</div>
            <p className="text-zinc-500 font-medium leading-loose max-w-sm mx-auto md:mx-0">{user.bio || 'Digital Narrator • System ID: ' + user.id.slice(0, 8)}</p>
          </div>
        </div>
      </div>

      {/* Settings Terminal Overlay */}
      {isSettingsTerminalOpen && (
        <div className="fixed inset-0 z-[10000] bg-black/98 flex items-center justify-center p-0 sm:p-8 animate-vix-in">
           <div className="w-full h-full sm:h-auto sm:max-w-2xl bg-zinc-950 border border-zinc-900 sm:rounded-[4rem] flex flex-col overflow-hidden shadow-[0_0_120px_rgba(0,0,0,1)] relative">
              
              <div className="p-10 border-b border-zinc-900 flex justify-between items-center bg-zinc-900/10">
                 <div className="flex items-center gap-4">
                    <ShieldAlert className="w-6 h-6 text-pink-500" />
                    <h3 className="font-black uppercase text-[12px] tracking-[0.5em] text-white">GRID CONFIGURATION</h3>
                 </div>
                 <button 
                  onClick={() => setIsSettingsTerminalOpen(false)} 
                  className="p-3 bg-zinc-900 rounded-full hover:bg-zinc-800 transition-all"
                 >
                    <X className="w-7 h-7 text-zinc-600" />
                 </button>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar p-10 space-y-16">
                 {/* Privacy Protocol Section */}
                 <div className="space-y-8">
                    <h4 className="text-[11px] font-black text-zinc-700 uppercase tracking-widest">Visibility & Access</h4>
                    <div className="space-y-6">
                       <button 
                        onClick={() => setIsPrivate(!isPrivate)} 
                        className="w-full p-8 bg-zinc-900/30 border border-zinc-900 rounded-[2.5rem] flex items-center justify-between group hover:border-pink-500/20 transition-all"
                       >
                          <div className="flex items-center gap-5">
                             <div className="w-12 h-12 rounded-2xl bg-zinc-900 flex items-center justify-center border border-zinc-800">
                                {isPrivate ? <EyeOff className="w-6 h-6 text-pink-500" /> : <Eye className="w-6 h-6 text-zinc-600" />}
                             </div>
                             <div className="text-left">
                                <p className="text-md font-black text-white">Private Fragment</p>
                                <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mt-1">Restrict grid access to followers only</p>
                             </div>
                          </div>
                          <div className={`w-14 h-7 rounded-full p-1.5 transition-all ${isPrivate ? 'bg-pink-500' : 'bg-zinc-800'}`}>
                             <div className={`w-4 h-4 bg-white rounded-full transition-all ${isPrivate ? 'translate-x-7' : 'translate-x-0'}`} />
                          </div>
                       </button>

                       <button 
                        onClick={() => setAllowComments(!allowComments)} 
                        className="w-full p-8 bg-zinc-900/30 border border-zinc-900 rounded-[2.5rem] flex items-center justify-between group hover:border-pink-500/20 transition-all"
                       >
                          <div className="flex items-center gap-5">
                             <div className="w-12 h-12 rounded-2xl bg-zinc-900 flex items-center justify-center border border-zinc-800">
                                {allowComments ? <VerifiedIcon className="w-6 h-6 text-green-500" /> : <MessageSquareOff className="w-6 h-6 text-red-500" />}
                             </div>
                             <div className="text-left">
                                <p className="text-md font-black text-white">Narrative Feedback</p>
                                <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mt-1">{allowComments ? 'Open for inscriptions' : 'Inscriptions disabled'}</p>
                             </div>
                          </div>
                          <div className={`w-14 h-7 rounded-full p-1.5 transition-all ${allowComments ? 'bg-green-500' : 'bg-zinc-800'}`}>
                             <div className={`w-4 h-4 bg-white rounded-full transition-all ${allowComments ? 'translate-x-7' : 'translate-x-0'}`} />
                          </div>
                       </button>
                    </div>
                 </div>

                 {/* Security Override Section */}
                 <div className="space-y-8">
                    <h4 className="text-[11px] font-black text-zinc-700 uppercase tracking-widest">Security Override</h4>
                    <div className="relative group">
                       <KeyRound className="absolute left-8 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-800 group-focus-within:text-pink-500 transition-colors" />
                       <input 
                          type="password" 
                          placeholder="Update Access Signature (Password)" 
                          value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                          className="w-full bg-black border border-zinc-900 rounded-[2rem] py-6 pl-16 pr-8 text-sm outline-none focus:border-pink-500/30 transition-all text-white font-medium shadow-inner"
                       />
                    </div>
                    <p className="text-[9px] text-zinc-800 font-bold uppercase tracking-widest px-4 italic leading-loose">
                      Only modify if your core signal has been compromised. Leave empty to maintain current signature.
                    </p>
                 </div>

                 {/* Session Control */}
                 <button 
                  onClick={() => { setIsSettingsTerminalOpen(false); onLogout?.(); }} 
                  className="w-full p-8 bg-red-500/5 border border-red-500/10 rounded-[2.5rem] flex items-center gap-6 group hover:bg-red-500/10 transition-all"
                 >
                    <div className="w-12 h-12 rounded-2xl bg-zinc-900 flex items-center justify-center border border-zinc-800">
                       <LogOut className="w-6 h-6 text-red-500" />
                    </div>
                    <p className="text-md font-black text-red-500 uppercase tracking-[0.3em]">RELINQUISH SESSION</p>
                 </button>
              </div>

              <div className="p-10 bg-zinc-950 border-t border-zinc-900 flex gap-4">
                 <button 
                    onClick={applyProtocols}
                    disabled={isSavingSettings}
                    className="flex-1 vix-gradient py-6 rounded-[3rem] text-white font-black uppercase tracking-[0.4em] text-[12px] shadow-2xl shadow-pink-500/20 active:scale-95 transition-all flex items-center justify-center gap-4 disabled:opacity-20"
                 >
                    {isSavingSettings ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Apply Protocols'}
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Grid Tabs */}
      <div className="border-t border-zinc-900 flex justify-center gap-16 sm:gap-24 mb-10">
        <button onClick={() => setActiveTab('POSTS')} className={`flex items-center gap-2 py-4 border-t-2 transition-all font-black uppercase tracking-[0.3em] text-[11px] ${activeTab === 'POSTS' ? 'border-white text-white' : 'border-transparent text-zinc-700'}`}><Grid className="w-5 h-5" /> Artifacts</button>
        <button onClick={() => setActiveTab('LIKES')} className={`flex items-center gap-2 py-4 border-t-2 transition-all font-black uppercase tracking-[0.3em] text-[11px] ${activeTab === 'LIKES' ? 'border-white text-white' : 'border-transparent text-zinc-700'}`}><Heart className="w-5 h-5" /> Liked</button>
      </div>

      <div className="pt-4">
        <div className="grid grid-cols-3 gap-1 sm:gap-6">
          {currentGridPosts.map((post) => (
            <div key={post.id} className="aspect-square bg-zinc-900 relative group cursor-pointer overflow-hidden rounded-md sm:rounded-[2.5rem] border border-zinc-800/50 shadow-2xl transition-all hover:scale-[1.02]">
              {post.media_type === 'video' ? (
                <video src={post.media_url} className="w-full h-full object-cover" />
              ) : (
                <img src={post.media_url} className="w-full h-full object-cover" alt="Artifact" />
              )}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all backdrop-blur-sm">
                <Heart className="w-8 h-8 fill-white" />
              </div>
            </div>
          ))}
          {currentGridPosts.length === 0 && (
            <div className="col-span-3 py-32 text-center opacity-20">
               <Grid className="w-16 h-16 mx-auto mb-6" />
               <p className="text-[12px] font-black uppercase tracking-[0.5em]">Void Fragment Detected</p>
            </div>
          )}
        </div>
      </div>

      {isEditModalOpen && (
        <div className="fixed inset-0 z-[10000] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6">
          <div className="w-full max-w-lg bg-zinc-950 border border-zinc-900 rounded-[3rem] p-10 shadow-2xl animate-vix-in">
            <div className="flex justify-between items-center mb-10">
               <h3 className="font-black uppercase text-[11px] tracking-[0.4em] text-zinc-500">Identity Override</h3>
               <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-zinc-900 rounded-full transition-all"><X className="w-6 h-6 text-zinc-700" /></button>
            </div>
            <div className="space-y-8">
              <div className="space-y-2">
                 <label className="text-[10px] font-black uppercase text-zinc-600 tracking-widest ml-4">Handle Signature</label>
                 <input value={user.username} readOnly className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-8 py-5 text-sm text-zinc-500 outline-none cursor-not-allowed opacity-50" />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black uppercase text-zinc-600 tracking-widest ml-4">Narrative Manifesto</label>
                 <textarea placeholder="Update your manifest..." className="w-full h-40 bg-black border border-zinc-900 rounded-2xl px-8 py-5 text-sm outline-none focus:border-pink-500/50 transition-all text-white resize-none shadow-inner" defaultValue={user.bio} />
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="w-full vix-gradient py-6 rounded-[2.5rem] font-black uppercase tracking-[0.3em] text-[12px] shadow-2xl shadow-pink-500/20 active:scale-95 transition-all text-white">Apply Override</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
