
import React, { useState, useEffect } from 'react';
import { Shield, ArrowUpCircle, User as UserIcon, Loader2, Search as SearchIcon, CheckCircle2, XCircle, Lock, ChevronRight } from 'lucide-react';
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
    const { data } = await supabase.from('profiles').select('*').order('username');
    if (data) setUsers(data as UserProfile[]);
    setLoading(false);
  };

  const fetchUserPosts = async (userId: string) => {
    const { data } = await supabase.from('posts').select('*, user:profiles(*)').eq('user_id', userId).order('created_at', { ascending: false });
    if (data) setSelectedUserPosts(data as any);
  };

  const handleVerify = async (userId: string, status: boolean) => {
    const { error } = await supabase.from('profiles').update({ is_verified: status }).eq('id', userId);
    if (!error) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_verified: status } : u));
      if (viewingUser?.id === userId) {
        setViewingUser(prev => prev ? { ...prev, is_verified: status } : null);
      }
      // Broadcast update to the entire app
      window.dispatchEvent(new CustomEvent('vixreel-user-updated', { detail: { id: userId, is_verified: status } }));
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
        <div className="w-full max-w-md bg-zinc-950 border border-zinc-900 rounded-[2.5rem] p-10 shadow-2xl text-center space-y-8 animate-in zoom-in duration-500">
          <div className="w-20 h-20 mx-auto rounded-3xl vix-gradient flex items-center justify-center shadow-2xl shadow-pink-500/20">
            <Lock className="w-10 h-10 text-white" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black uppercase tracking-widest text-white">System Override</h2>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em]">Enter Protocol Access Code</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full bg-black border ${passError ? 'border-red-500 animate-shake' : 'border-zinc-800'} rounded-2xl px-6 py-4 text-center text-sm outline-none focus:border-pink-500/50 transition-all font-black tracking-[0.5em]`}
              placeholder="••••••••"
              autoFocus
            />
            <button type="submit" className="w-full vix-gradient py-4 rounded-2xl text-white font-black uppercase tracking-widest text-[10px] shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2">
              Decrypt Terminal <ChevronRight className="w-4 h-4" />
            </button>
          </form>
          {passError && <p className="text-red-500 text-[10px] font-black uppercase tracking-widest animate-pulse">Access Denied: Invalid Code</p>}
        </div>
      </div>
    );
  }

  const filteredUsers = users.filter(u => u.username.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto pb-24 sm:pb-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-2xl">
            <Shield className="w-8 h-8 text-purple-500" />
          </div>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-widest text-white">VixReel Admin</h1>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em]">Live Database Connection: Established</p>
          </div>
        </div>
        <button onClick={() => setIsUnlocked(false)} className="bg-zinc-900 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-colors">Lock Terminal</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
        <div className="lg:col-span-4 bg-zinc-950 rounded-[2rem] border border-zinc-900 h-[500px] sm:h-[600px] flex flex-col shadow-2xl">
          <div className="p-5 border-b border-zinc-900 relative">
             <SearchIcon className="absolute left-9 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
             <input 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-black border border-zinc-800 rounded-2xl py-3 pl-12 pr-4 text-xs outline-none focus:border-purple-500/50 transition-all text-white" 
              placeholder="Search Creators..."
             />
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar p-2">
            {loading ? (
              <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 text-zinc-800 animate-spin" /></div>
            ) : filteredUsers.map(u => (
              <div 
                key={u.id} 
                onClick={() => { setViewingUser(u); fetchUserPosts(u.id); }}
                className={`p-4 flex items-center justify-between cursor-pointer rounded-2xl transition-all mb-1 ${viewingUser?.id === u.id ? 'bg-purple-500/10 border border-purple-500/20' : 'hover:bg-zinc-900 border border-transparent'}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full p-[2px] ${u.is_verified ? 'vix-gradient' : 'bg-zinc-800'}`}>
                    <img src={u.avatar_url || `https://ui-avatars.com/api/?name=${u.username}`} className="w-full h-full rounded-full object-cover bg-black" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold flex items-center gap-1">
                      {u.username} 
                      {u.is_verified && <VerificationBadge size="w-3.5 h-3.5" />}
                    </span>
                    <span className="text-[9px] text-zinc-600 uppercase font-black">{u.id.slice(0, 8)}</span>
                  </div>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleVerify(u.id, !u.is_verified); }}
                  className={`p-2 rounded-xl transition-all ${u.is_verified ? 'text-zinc-500 hover:text-red-400' : 'text-purple-500 hover:text-purple-400 bg-purple-500/10'}`}
                >
                  {u.is_verified ? <XCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-8">
          {viewingUser ? (
            <div className="bg-zinc-950 rounded-[2rem] border border-zinc-900 p-6 sm:p-10 shadow-2xl animate-in slide-in-from-right duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10">
                <div className="flex items-center gap-6">
                  <div className="w-24 h-24 rounded-full vix-gradient p-1">
                    <img src={viewingUser.avatar_url || `https://ui-avatars.com/api/?name=${viewingUser.username}`} className="w-full h-full rounded-full border-4 border-black object-cover" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black flex items-center gap-2">
                      {viewingUser.username} 
                      {viewingUser.is_verified && <VerificationBadge size="w-8 h-8" />}
                    </h3>
                    <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">{viewingUser.email}</p>
                    <p className="text-[10px] text-purple-500 font-black uppercase mt-2 tracking-widest">Creator ID: {viewingUser.id}</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleVerify(viewingUser.id, !viewingUser.is_verified)}
                  className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${viewingUser.is_verified ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'vix-gradient text-white shadow-xl shadow-pink-500/20'}`}
                >
                  {viewingUser.is_verified ? 'Revoke Status' : 'Approve Creator'}
                </button>
              </div>

              <div className="bg-black border border-zinc-900 rounded-[2rem] p-6 mb-10">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Engagement Injection</h4>
                  <div className="text-[10px] font-bold text-purple-400 bg-purple-500/10 px-3 py-1 rounded-full uppercase">Organic Boost Protocol</div>
                </div>
                <div className="flex flex-col sm:flex-row gap-4">
                  <input 
                    type="number" 
                    value={boostAmount} 
                    onChange={e => setBoostAmount(e.target.value)}
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl px-6 py-4 outline-none focus:border-purple-500 text-sm font-bold text-white"
                  />
                  <div className="flex gap-2">
                    {['500', '2500', '10000'].map(v => (
                      <button key={v} onClick={() => setBoostAmount(v)} className="px-5 bg-zinc-800 rounded-2xl text-[10px] font-black hover:bg-zinc-700 transition-colors uppercase">+{v}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-4 max-h-[400px] overflow-y-auto no-scrollbar pr-2">
                {selectedUserPosts.map(p => (
                  <div key={p.id} className="relative aspect-square rounded-2xl overflow-hidden group border border-zinc-900 shadow-xl bg-black">
                    {p.media_type === 'video' ? <video src={p.media_url} className="w-full h-full object-cover opacity-60" /> : <img src={p.media_url} className="w-full h-full object-cover opacity-60" />}
                    <button 
                      onClick={() => handleBoost(p.id)}
                      className="absolute inset-0 bg-purple-500/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-all backdrop-blur-sm"
                    >
                      <ArrowUpCircle className="w-10 h-10 text-white mb-2" />
                      <span className="text-[8px] font-black text-white uppercase tracking-widest">Inject {boostAmount}</span>
                    </button>
                    <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[8px] font-bold border border-white/5">
                      {formatNumber((p.likes_count || 0) + (p.boosted_likes || 0))} ❤️
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-full border-2 border-zinc-900 border-dashed rounded-[3rem] flex flex-col items-center justify-center p-20 text-center bg-zinc-950/20 shadow-inner">
              <div className="w-20 h-20 rounded-full bg-zinc-900/50 flex items-center justify-center mb-6">
                <UserIcon className="w-10 h-10 text-zinc-800" />
              </div>
              <h3 className="text-zinc-500 font-black uppercase tracking-[0.3em] text-sm">Terminal Idle</h3>
              <p className="text-zinc-700 text-xs mt-2 font-bold max-w-xs">Awaiting Creator selection from the database index to enable System Overrides.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Admin;
