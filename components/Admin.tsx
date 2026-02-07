
import React, { useState, useEffect } from 'react';
import { Shield, ArrowUpCircle, User as UserIcon, Loader2, Search as SearchIcon, CheckCircle2, XCircle, Lock, ChevronRight, Clock, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { UserProfile, Post } from '../types';
import VerificationBadge from './VerificationBadge';
import { formatNumber } from '../lib/utils';

const Admin: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserPosts, setSelectedUserPosts] = useState<Post[]>([]);
  const [viewingUser, setViewingUser] = useState<UserProfile | null>(null);
  const [boostAmount, setBoostAmount] = useState<string>('500');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Auth state for Admin
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [passError, setPassError] = useState(false);

  const ADMIN_CODE = "VIX-2025";

  useEffect(() => {
    if (isUnlocked) {
      fetchUsers();
    }
  }, [isUnlocked]);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetching all users from profiles table
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (fetchError) throw fetchError;
      
      if (data) {
        setUsers(data as UserProfile[]);
      }
    } catch (err: any) {
      console.error("Admin Fetch Failure:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserPosts = async (userId: string) => {
    const { data } = await supabase.from('posts').select('*, user:profiles(*)').eq('user_id', userId).order('created_at', { ascending: false });
    if (data) setSelectedUserPosts(data as any);
  };

  const handleVerify = async (userId: string, status: boolean) => {
    try {
      const { error: updateError } = await supabase.from('profiles').update({ is_verified: status }).eq('id', userId);
      if (updateError) throw updateError;

      // Update local state for immediate feedback
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_verified: status } : u));
      if (viewingUser?.id === userId) {
        setViewingUser(prev => prev ? { ...prev, is_verified: status } : null);
      }
      
      // Broadcast to components
      window.dispatchEvent(new CustomEvent('vixreel-user-updated', { 
        detail: { id: userId, is_verified: status } 
      }));
    } catch (err: any) {
      alert("Status Update Failed: " + err.message);
    }
  };

  const handleBoost = async (postId: string) => {
    const amount = parseInt(boostAmount);
    if (isNaN(amount) || amount <= 0) return;
    const { data: post } = await supabase.from('posts').select('boosted_likes').eq('id', postId).single();
    const newBoost = (post?.boosted_likes || 0) + amount;
    const { error } = await supabase.from('posts').update({ boosted_likes: newBoost }).eq('id', postId);
    if (!error) {
      setSelectedUserPosts(prev => prev.map(p => p.id === postId ? { ...p, boosted_likes: newBoost } : p));
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_CODE) {
      setIsUnlocked(true);
      setPassError(false);
    } else {
      setPassError(true);
      setTimeout(() => setPassError(false), 2000);
    }
  };

  if (!isUnlocked) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-zinc-950 border border-zinc-900 rounded-[3rem] p-12 shadow-2xl text-center space-y-10 animate-in zoom-in duration-500">
          <div className="w-24 h-24 mx-auto rounded-[2rem] vix-gradient flex items-center justify-center shadow-[0_0_60px_rgba(255,0,128,0.3)] border border-white/10">
            <Lock className="w-10 h-10 text-white" />
          </div>
          <div className="space-y-3">
            <h2 className="text-3xl font-black uppercase tracking-[0.2em] text-white">Grid Access</h2>
            <p className="text-[11px] text-zinc-600 font-bold uppercase tracking-[0.4em]">Administrative Security Protocol</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-6">
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full bg-black border ${passError ? 'border-red-500 animate-shake' : 'border-zinc-800'} rounded-2xl px-6 py-5 text-center text-sm outline-none focus:border-pink-500/50 transition-all font-black tracking-[0.6em] text-white shadow-inner`}
              placeholder="••••••••"
              autoFocus
            />
            <button type="submit" className="w-full vix-gradient py-5 rounded-[2rem] text-white font-black uppercase tracking-widest text-[11px] shadow-2xl shadow-pink-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3">
              Unlock Terminal <ChevronRight className="w-5 h-5" />
            </button>
          </form>
          {passError && <p className="text-red-500 text-[10px] font-black uppercase tracking-widest animate-pulse">Signature Incorrect</p>}
        </div>
      </div>
    );
  }

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-10 max-w-7xl mx-auto pb-32 sm:pb-10 animate-vix-in">
      <div className="flex flex-col sm:flex-row items-center justify-between mb-12 gap-8">
        <div className="flex items-center gap-6">
          <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-[2rem] shadow-2xl">
            <Shield className="w-10 h-10 text-purple-500" />
          </div>
          <div>
            <h1 className="text-3xl font-black uppercase tracking-[0.1em] text-white flex items-center gap-3">
              VixReel <span className="bg-white/5 text-[10px] px-3 py-1 rounded-full border border-white/10 text-zinc-500">MASTER CONTROL</span>
            </h1>
            <p className="text-[11px] text-zinc-600 font-black uppercase tracking-[0.3em] mt-1 italic opacity-60">Identity Moderation & Boost Terminal</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <div className="bg-zinc-900 border border-zinc-800 px-6 py-3 rounded-2xl flex items-center gap-3 group">
              <div className="relative">
                <Users className="w-4 h-4 text-zinc-500 group-hover:text-pink-500 transition-colors" />
                <div className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-pink-500 rounded-full animate-pulse"></div>
              </div>
              <span className="text-[10px] font-black uppercase text-white">{users.length} Active Narrators</span>
           </div>
           <button onClick={() => setIsUnlocked(false)} className="bg-red-500/10 border border-red-500/20 px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-500 hover:text-white transition-all">Relinquish Access</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-5 xl:col-span-4 bg-zinc-950 rounded-[3rem] border border-zinc-900 h-[650px] flex flex-col shadow-2xl overflow-hidden ring-1 ring-white/5">
          <div className="p-8 border-b border-zinc-900 bg-zinc-900/10 relative">
             <SearchIcon className="absolute left-12 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-700" />
             <input 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-black/50 border border-zinc-800 rounded-[1.5rem] py-4 pl-14 pr-6 text-xs outline-none focus:border-purple-500/40 transition-all text-white placeholder:text-zinc-800 font-medium" 
              placeholder="Search handles or emails..."
             />
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-2">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-800">Compiling Directory...</span>
              </div>
            ) : error ? (
              <div className="p-10 text-center space-y-4">
                <p className="text-red-500 text-[10px] font-black uppercase tracking-widest">Signal Failure</p>
                <button onClick={fetchUsers} className="text-white text-[10px] font-bold underline">Retry Sync</button>
              </div>
            ) : filteredUsers.length > 0 ? filteredUsers.map(u => (
              <div 
                key={u.id} 
                onClick={() => { setViewingUser(u); fetchUserPosts(u.id); }}
                className={`p-5 flex items-center justify-between cursor-pointer rounded-[2rem] transition-all border ${viewingUser?.id === u.id ? 'bg-purple-500/10 border-purple-500/30' : 'hover:bg-zinc-900/50 border-transparent'}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full p-[2px] ${u.is_verified ? 'vix-gradient shadow-lg shadow-pink-500/10' : 'bg-zinc-800 border border-zinc-700'}`}>
                    <img src={u.avatar_url || `https://ui-avatars.com/api/?name=${u.username}`} className="w-full h-full rounded-full object-cover bg-black" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-black flex items-center gap-2 text-white">
                      {u.username} 
                      {u.is_verified && <VerificationBadge size="w-4 h-4" />}
                    </span>
                    <div className="flex items-center gap-2 text-[9px] text-zinc-600 font-bold uppercase tracking-tighter mt-1">
                      <Clock className="w-3 h-3" />
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'Sync Pending'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center">
                   {u.is_admin && <Shield className="w-4 h-4 text-pink-500/50 mr-2" />}
                </div>
              </div>
            )) : (
              <div className="h-full flex flex-col items-center justify-center p-12 text-center">
                <p className="text-[10px] font-black uppercase text-zinc-800 tracking-widest">No Narrators Found</p>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-7 xl:col-span-8">
          {viewingUser ? (
            <div className="bg-zinc-950 rounded-[3.5rem] border border-zinc-900 p-8 sm:p-16 shadow-2xl animate-in slide-in-from-right duration-500 relative overflow-hidden ring-1 ring-white/5">
              <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 blur-[100px] rounded-full"></div>
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-10 mb-16 relative z-10">
                <div className="flex items-center gap-8">
                  <div className="w-32 h-32 rounded-full vix-gradient p-1.5 shadow-[0_20px_60px_rgba(255,0,128,0.2)]">
                    <img src={viewingUser.avatar_url || `https://ui-avatars.com/api/?name=${viewingUser.username}`} className="w-full h-full rounded-full border-[6px] border-black object-cover bg-zinc-900" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-4xl font-black flex items-center gap-4 text-white">
                      {viewingUser.username} 
                      {viewingUser.is_verified && <VerificationBadge size="w-10 h-10" />}
                    </h3>
                    <p className="text-sm text-zinc-500 font-medium tracking-tight italic">{viewingUser.email}</p>
                    <div className="flex items-center gap-3 mt-4">
                       <span className={`text-[10px] font-black uppercase px-4 py-1.5 rounded-full border ${viewingUser.is_verified ? 'border-purple-500/40 text-purple-400 bg-purple-500/5 shadow-[0_0_15px_rgba(168,85,247,0.1)]' : 'border-zinc-800 text-zinc-700'}`}>
                          {viewingUser.is_verified ? 'Authorized Account' : 'Registry Pending'}
                       </span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => handleVerify(viewingUser.id, !viewingUser.is_verified)}
                  className={`px-12 py-5 rounded-[2.5rem] text-[11px] font-black uppercase tracking-[0.4em] transition-all shadow-2xl ${viewingUser.is_verified ? 'bg-zinc-900 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white' : 'vix-gradient text-white shadow-pink-500/20 hover:scale-105 active:scale-95'}`}
                >
                  {viewingUser.is_verified ? 'Terminate Auth' : 'Verify Identity'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16 relative z-10">
                 <div className="bg-black/50 border border-zinc-900 rounded-[2.5rem] p-10 space-y-8 shadow-inner">
                    <h4 className="text-[11px] font-black text-zinc-700 uppercase tracking-[0.5em]">Engagement Injector</h4>
                    <div className="flex flex-col gap-5">
                      <div className="relative">
                        <input 
                          type="number" 
                          value={boostAmount} 
                          onChange={e => setBoostAmount(e.target.value)}
                          className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl px-8 py-5 outline-none focus:border-purple-500/40 text-lg font-black text-white shadow-inner"
                          placeholder="00"
                        />
                        <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-zinc-700 uppercase tracking-widest">LIKES</span>
                      </div>
                      <div className="flex gap-3">
                        {['1k', '5k', '10k', '50k'].map(v => (
                          <button key={v} onClick={() => setBoostAmount(v.replace('k', '000'))} className="flex-1 py-3 bg-zinc-900 rounded-xl text-[10px] font-black hover:bg-purple-500/20 hover:text-purple-400 transition-all uppercase border border-white/5 active:scale-90">+{v}</button>
                        ))}
                      </div>
                    </div>
                 </div>

                 <div className="bg-zinc-900/20 border border-zinc-900 rounded-[2.5rem] p-10 flex flex-col justify-center text-center shadow-xl">
                    <p className="text-[10px] text-zinc-600 font-black uppercase tracking-[0.3em] mb-4">Grid Data Profile</p>
                    <div className="flex items-center justify-around">
                       <div className="flex flex-col gap-1">
                          <span className="text-4xl font-black text-white">{selectedUserPosts.length}</span>
                          <span className="text-[9px] text-purple-500/50 font-black uppercase tracking-widest">Artifacts</span>
                       </div>
                       <div className="w-px h-12 bg-zinc-800"></div>
                       <div className="flex flex-col gap-1">
                          <span className="text-4xl font-black text-white">{formatNumber(viewingUser.id.length * 7)}</span>
                          <span className="text-[9px] text-pink-500/50 font-black uppercase tracking-widest">Est. Karma</span>
                       </div>
                    </div>
                 </div>
              </div>

              <div className="space-y-6 relative z-10">
                <h4 className="text-[11px] font-black text-zinc-700 uppercase tracking-[0.5em] px-2">Managed Visual Artifacts</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-h-[400px] overflow-y-auto no-scrollbar pr-2">
                  {selectedUserPosts.map(p => (
                    <div key={p.id} className="relative aspect-square rounded-[2rem] overflow-hidden group border border-zinc-900 shadow-2xl bg-black transition-transform hover:scale-105 duration-500">
                      {p.media_type === 'video' ? <video src={p.media_url} className="w-full h-full object-cover opacity-60" /> : <img src={p.media_url} className="w-full h-full object-cover opacity-60" />}
                      <button 
                        onClick={() => handleBoost(p.id)}
                        className="absolute inset-0 bg-purple-500/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-all backdrop-blur-md"
                      >
                        <ArrowUpCircle className="w-10 h-10 text-white mb-2 animate-bounce" />
                        <span className="text-[9px] font-black text-white uppercase tracking-[0.2em]">Inject {formatNumber(parseInt(boostAmount))}</span>
                      </button>
                      <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-xl text-[9px] font-black border border-white/5 text-white flex items-center gap-1.5">
                        {formatNumber((p.likes_count || 0) + (p.boosted_likes || 0))} <span className="text-pink-500">💖</span>
                      </div>
                    </div>
                  ))}
                  {selectedUserPosts.length === 0 && (
                    <div className="col-span-full h-48 flex flex-col items-center justify-center bg-black/20 rounded-[2.5rem] border border-zinc-900 border-dashed text-zinc-800 gap-4">
                       <Users className="w-10 h-10 opacity-20" />
                       <span className="font-black uppercase text-[11px] tracking-[0.5em]">Grid Data Missing</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full border-2 border-zinc-900 border-dashed rounded-[4rem] flex flex-col items-center justify-center p-24 text-center bg-zinc-950/20 shadow-inner group transition-all hover:bg-zinc-950/30">
              <div className="w-32 h-32 rounded-[2.5rem] bg-zinc-900/50 flex items-center justify-center mb-10 border border-zinc-800 shadow-2xl transition-transform group-hover:scale-110 duration-700">
                <Users className="w-12 h-12 text-zinc-800" />
              </div>
              <h3 className="text-zinc-500 font-black uppercase tracking-[0.6em] text-sm">Standby Mode</h3>
              <p className="text-zinc-800 text-xs mt-4 font-bold max-w-sm leading-loose uppercase tracking-tighter">
                Select a narrator handle from the sidebar directory to initialize administrative identity override and engagement protocols.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Admin;
