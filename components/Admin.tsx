
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Shield, 
  ArrowUpCircle, 
  User as UserIcon, 
  Loader2, 
  Search as SearchIcon, 
  CheckCircle2, 
  XCircle, 
  Lock, 
  ChevronRight, 
  Clock, 
  Users, 
  RefreshCw,
  Film,
  AlertTriangle,
  UserPlus
} from 'lucide-react';
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
  const [followerBoostAmount, setFollowerBoostAmount] = useState<string>('1000');
  const [loading, setLoading] = useState(false);
  const [postsLoading, setPostsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [passError, setPassError] = useState(false);

  const ADMIN_CODE = "VIX-2025";

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .order('updated_at', { ascending: false });
      
      if (fetchError) throw fetchError;
      
      setUsers((data as UserProfile[]) || []);
    } catch (err: any) {
      console.error("Admin Fetch Failure:", err);
      setError(err.message || "Could not load user list.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isUnlocked) {
      fetchUsers();
    }
  }, [isUnlocked, fetchUsers]);

  const fetchUserPosts = async (userId: string) => {
    setPostsLoading(true);
    try {
      const { data, error: postsErr } = await supabase
        .from('posts')
        .select('*, user:profiles(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (postsErr) throw postsErr;
      setSelectedUserPosts((data as Post[]) || []);
    } catch (err) {
      console.error("Failed to fetch user posts:", err);
    } finally {
      setPostsLoading(false);
    }
  };

  const handleVerify = async (userId: string, status: boolean) => {
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ is_verified: status })
        .eq('id', userId);
      
      if (updateError) throw updateError;

      // Update local state
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_verified: status } : u));
      if (viewingUser?.id === userId) {
        setViewingUser(prev => prev ? { ...prev, is_verified: status } : null);
      }
      
      window.dispatchEvent(new CustomEvent('vixreel-user-updated', { 
        detail: { id: userId, is_verified: status } 
      }));
      
    } catch (err: any) {
      alert("Update Failed: " + (err.message || "Error saving verification"));
    }
  };

  const handleBoost = async (postId: string) => {
    const amount = parseInt(boostAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    try {
      const { data: post, error: getErr } = await supabase
        .from('posts')
        .select('boosted_likes')
        .eq('id', postId)
        .maybeSingle();

      if (getErr) throw getErr;
      
      const currentBoost = post?.boosted_likes || 0;
      const newBoost = currentBoost + amount;
      
      const { error: updateErr } = await supabase
        .from('posts')
        .update({ boosted_likes: newBoost })
        .eq('id', postId);
      
      if (updateErr) throw updateErr;

      setSelectedUserPosts(prev => prev.map(p => p.id === postId ? { ...p, boosted_likes: newBoost } : p));
      
      window.dispatchEvent(new CustomEvent('vixreel-post-updated', { 
        detail: { id: postId, boosted_likes: newBoost } 
      }));
      window.dispatchEvent(new CustomEvent('vixreel-engagement-updated'));
    } catch (err: any) {
      alert("Boost Failed: " + (err.message || "Error adding likes"));
    }
  };

  const handleFollowerBoost = async () => {
    if (!viewingUser) return;
    const amount = parseInt(followerBoostAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    try {
      const { data: profile, error: getErr } = await supabase
        .from('profiles')
        .select('boosted_followers')
        .eq('id', viewingUser.id)
        .maybeSingle();

      if (getErr) throw getErr;
      
      const currentBoost = profile?.boosted_followers || 0;
      const newBoost = currentBoost + amount;
      
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ boosted_followers: newBoost })
        .eq('id', viewingUser.id);
      
      if (updateErr) throw updateErr;

      // Update Local State
      setViewingUser(prev => prev ? { ...prev, boosted_followers: newBoost } : null);
      setUsers(prev => prev.map(u => u.id === viewingUser.id ? { ...u, boosted_followers: newBoost } : u));
      
      window.dispatchEvent(new CustomEvent('vixreel-user-updated', { 
        detail: { id: viewingUser.id, boosted_followers: newBoost } 
      }));
      
      alert(`Added ${amount} followers to @${viewingUser.username}.`);
    } catch (err: any) {
      alert("Follower Boost Failed: " + (err.message || "Error adding followers"));
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_CODE) {
      setIsUnlocked(true);
      setPassError(false);
    } else {
      setPassError(true);
      setPassword('');
      setTimeout(() => setPassError(false), 2000);
    }
  };

  if (!isUnlocked) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-zinc-950 border border-zinc-900 rounded-[3rem] p-12 shadow-2xl text-center space-y-10 animate-vix-in">
          <div className="w-24 h-24 mx-auto rounded-[2rem] vix-gradient flex items-center justify-center shadow-[0_0_60px_rgba(255,0,128,0.3)] border border-white/10">
            <Lock className="w-10 h-10 text-white" />
          </div>
          <div className="space-y-3">
            <h2 className="text-3xl font-black uppercase tracking-[0.2em] text-white">Admin Login</h2>
            <p className="text-[11px] text-zinc-600 font-bold uppercase tracking-[0.4em]">Restricted Access</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-6">
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full bg-black border ${passError ? 'border-red-500 animate-pulse' : 'border-zinc-800'} rounded-2xl px-6 py-5 text-center text-sm outline-none focus:border-pink-500/50 transition-all font-black tracking-[0.6em] text-white shadow-inner`}
              placeholder="••••••••"
              autoFocus
              required
            />
            <button type="submit" className="w-full vix-gradient py-5 rounded-[2rem] text-white font-black uppercase tracking-widest text-[11px] shadow-2xl shadow-pink-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3">
              Unlock Panel <ChevronRight className="w-5 h-5" />
            </button>
          </form>
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
              Admin Panel
            </h1>
            <p className="text-[11px] text-zinc-600 font-black uppercase tracking-[0.3em] mt-1 italic opacity-60">Manage Users & Boost Content</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <button onClick={fetchUsers} disabled={loading} className="p-3 bg-zinc-900 border border-zinc-800 rounded-2xl text-zinc-400 hover:text-white transition-all">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
           </button>
           <button onClick={() => setIsUnlocked(false)} className="bg-red-500/10 border border-red-500/20 px-8 py-3 rounded-2xl text-[10px] font-black uppercase text-red-500 hover:bg-red-500 hover:text-white transition-all">Logout Admin</button>
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
              placeholder="Search by username..."
             />
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-2">
            {filteredUsers.map(u => (
              <div 
                key={u.id} 
                onClick={() => { setViewingUser(u); fetchUserPosts(u.id); }}
                className={`p-5 flex items-center justify-between cursor-pointer rounded-[2rem] transition-all border ${viewingUser?.id === u.id ? 'bg-purple-500/10 border-purple-500/30' : 'hover:bg-zinc-900/50 border-transparent'}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full p-[2px] ${u.is_verified ? 'vix-gradient shadow-lg shadow-pink-500/10' : 'bg-zinc-800'}`}>
                    <img src={u.avatar_url || `https://ui-avatars.com/api/?name=${u.username}`} className="w-full h-full rounded-full object-cover bg-black" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-black text-white flex items-center gap-2">
                      {u.username} {u.is_verified && <VerificationBadge size="w-4 h-4" />}
                    </span>
                    <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">{formatNumber(u.boosted_followers || 0)} Boosted</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-7 xl:col-span-8">
          {viewingUser ? (
            <div className="bg-zinc-950 rounded-[3.5rem] border border-zinc-900 p-8 sm:p-16 shadow-2xl animate-vix-in relative overflow-hidden ring-1 ring-white/5">
              <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 blur-[100px] rounded-full"></div>
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-10 mb-16 relative z-10">
                <div className="flex items-center gap-8">
                  <div className="w-32 h-32 rounded-full vix-gradient p-1.5 shadow-[0_20px_60px_rgba(255,0,128,0.2)]">
                    <img src={viewingUser.avatar_url || `https://ui-avatars.com/api/?name=${viewingUser.username}`} className="w-full h-full rounded-full border-[6px] border-black object-cover bg-zinc-900" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-4xl font-black flex items-center gap-4 text-white">
                      {viewingUser.username} {viewingUser.is_verified && <VerificationBadge size="w-10 h-10" />}
                    </h3>
                    <p className="text-sm text-zinc-500 font-medium tracking-tight italic">{viewingUser.email || 'No email'}</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleVerify(viewingUser.id, !viewingUser.is_verified)}
                  className={`px-12 py-5 rounded-[2.5rem] text-[11px] font-black uppercase tracking-[0.4em] transition-all shadow-2xl ${viewingUser.is_verified ? 'bg-zinc-900 text-red-500 border border-red-500/20' : 'vix-gradient text-white'}`}
                >
                  {viewingUser.is_verified ? 'Remove Verification' : 'Verify User'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16 relative z-10">
                 <div className="bg-black/50 border border-zinc-900 rounded-[2.5rem] p-10 space-y-8 shadow-inner">
                    <h4 className="text-[11px] font-black text-zinc-700 uppercase tracking-[0.5em]">Add Likes (Post)</h4>
                    <div className="flex flex-col gap-5">
                      <div className="relative">
                        <input 
                          type="number" 
                          value={boostAmount} 
                          onChange={e => setBoostAmount(e.target.value)}
                          className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl px-8 py-5 text-lg font-black text-white outline-none"
                          placeholder="00"
                        />
                        <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] text-zinc-700 uppercase">LIKES</span>
                      </div>
                      <p className="text-[9px] text-zinc-600 uppercase text-center">Select a post below to add likes.</p>
                    </div>
                 </div>

                 <div className="bg-black/50 border border-zinc-900 rounded-[2.5rem] p-10 space-y-8 shadow-inner">
                    <h4 className="text-[11px] font-black text-zinc-700 uppercase tracking-[0.5em]">Add Followers (Account)</h4>
                    <div className="flex flex-col gap-5">
                      <div className="relative">
                        <input 
                          type="number" 
                          value={followerBoostAmount} 
                          onChange={e => setFollowerBoostAmount(e.target.value)}
                          className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl px-8 py-5 text-lg font-black text-white outline-none"
                          placeholder="00"
                        />
                        <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] text-zinc-700 uppercase">FOLLOWERS</span>
                      </div>
                      <button onClick={handleFollowerBoost} className="w-full py-4 bg-purple-600 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white hover:bg-purple-500 transition-all flex items-center justify-center gap-2 group shadow-xl hover:shadow-purple-500/20 active:scale-95">
                        <UserPlus className="w-4 h-4 group-hover:rotate-12 transition-transform" /> Add Followers
                      </button>
                    </div>
                 </div>
              </div>

              <div className="space-y-6 relative z-10">
                <h4 className="text-[11px] font-black text-zinc-700 uppercase tracking-[0.5em] px-2 flex items-center justify-between">User Posts</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-h-[400px] overflow-y-auto no-scrollbar pr-2">
                  {selectedUserPosts.map(p => (
                    <div key={p.id} className="relative aspect-square rounded-[2rem] overflow-hidden group border border-zinc-900 shadow-2xl bg-black transition-transform hover:scale-105 duration-500">
                      {p.media_type === 'video' ? (
                        <video src={p.media_url} className="w-full h-full object-cover opacity-60" />
                      ) : (
                        <img src={p.media_url} className="w-full h-full object-cover opacity-60" />
                      )}
                      
                      <div className="absolute bottom-4 left-4 flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/5">
                        <ArrowUpCircle className="w-3 h-3 text-pink-500" />
                        <span className="text-[9px] font-black text-white">{formatNumber(p.boosted_likes || 0)}</span>
                      </div>

                      <button 
                        onClick={() => handleBoost(p.id)}
                        className="absolute inset-0 bg-purple-500/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-all backdrop-blur-md"
                      >
                        <ArrowUpCircle className="w-10 h-10 text-white mb-2 animate-bounce" />
                        <span className="text-[9px] font-black text-white uppercase">Add {formatNumber(parseInt(boostAmount))} Likes</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full border-2 border-zinc-900 border-dashed rounded-[4rem] flex flex-col items-center justify-center p-24 text-center bg-zinc-950/20 shadow-inner group">
              <div className="w-32 h-32 rounded-[2.5rem] bg-zinc-900/50 flex items-center justify-center mb-10 border border-zinc-800 shadow-2xl">
                <Users className="w-12 h-12 text-zinc-800" />
              </div>
              <h3 className="text-zinc-500 font-black uppercase tracking-[0.6em] text-sm">Select a user</h3>
              <p className="text-zinc-800 text-xs mt-4 font-bold uppercase tracking-tighter">Choose an account from the left to manage it.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Admin;
