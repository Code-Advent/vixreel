
import React, { useState, useEffect } from 'react';
import { Shield, ArrowUpCircle, User as UserIcon, Film, Loader2, Search as SearchIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { UserProfile, Post } from '../types';
import VerificationBadge from './VerificationBadge';

const Admin: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserPosts, setSelectedUserPosts] = useState<Post[]>([]);
  const [viewingUser, setViewingUser] = useState<UserProfile | null>(null);
  const [boostAmount, setBoostAmount] = useState<string>('500');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').order('username');
    if (data) setUsers(data);
    setLoading(false);
  };

  const fetchUserPosts = async (userId: string) => {
    const { data } = await supabase.from('posts').select('*, user:profiles(*)').eq('user_id', userId).order('created_at', { ascending: false });
    if (data) setSelectedUserPosts(data as any);
  };

  const handleVerify = async (userId: string, status: boolean) => {
    const { error } = await supabase.from('profiles').update({ is_verified: status }).eq('id', userId);
    if (!error) {
      setUsers(users.map(u => u.id === userId ? { ...u, is_verified: status } : u));
      if (viewingUser?.id === userId) setViewingUser({ ...viewingUser, is_verified: status });
    }
  };

  const handleBoost = async (postId: string) => {
    const amount = parseInt(boostAmount);
    if (isNaN(amount)) return;
    const { data: post } = await supabase.from('posts').select('boosted_likes').eq('id', postId).single();
    const { error } = await supabase.from('posts').update({ boosted_likes: (post?.boosted_likes || 0) + amount }).eq('id', postId);
    if (!error) {
      setSelectedUserPosts(selectedUserPosts.map(p => p.id === postId ? { ...p, boosted_likes: (p.boosted_likes || 0) + amount } : p));
      alert(`Injected ${amount} likes!`);
    }
  };

  const filteredUsers = users.filter(u => u.username.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <Shield className="w-10 h-10 text-purple-500" />
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">VixReel Admin</h1>
          <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">System Overrides Active</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 bg-zinc-950/40 rounded-2xl border border-zinc-900 flex flex-col h-[600px]">
          <div className="p-4 border-b border-zinc-900 relative">
             <SearchIcon className="absolute left-7 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
             <input 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-black border border-zinc-800 rounded-lg py-2 pl-10 pr-4 text-xs outline-none focus:border-purple-500" 
              placeholder="Search users..."
             />
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar">
            {filteredUsers.map(u => (
              <div 
                key={u.id} 
                onClick={() => { setViewingUser(u); fetchUserPosts(u.id); }}
                className={`p-4 flex items-center justify-between cursor-pointer border-b border-white/5 transition-colors ${viewingUser?.id === u.id ? 'bg-zinc-900 border-l-4 border-purple-500' : 'hover:bg-zinc-900/50'}`}
              >
                <div className="flex items-center gap-3">
                  <img src={u.avatar_url || `https://ui-avatars.com/api/?name=${u.username}`} className="w-8 h-8 rounded-full border border-zinc-800" />
                  <span className="text-sm font-bold flex items-center">
                    {u.username} {u.is_verified && <VerificationBadge size="w-3 h-3" />}
                  </span>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleVerify(u.id, !u.is_verified); }}
                  className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${u.is_verified ? 'bg-zinc-800 border-zinc-700 text-zinc-500' : 'bg-purple-500/10 text-purple-400 border-purple-500/30'}`}
                >
                  {u.is_verified ? 'Revoke' : 'Verify'}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-8 space-y-6">
          {viewingUser ? (
            <div className="bg-zinc-950/40 rounded-2xl border border-zinc-900 p-8 h-full flex flex-col">
              <div className="flex items-center gap-6 mb-8">
                <div className="w-20 h-20 rounded-full p-1 vix-gradient">
                  <img src={viewingUser.avatar_url || `https://ui-avatars.com/api/?name=${viewingUser.username}`} className="w-full h-full rounded-full bg-black object-cover" />
                </div>
                <div>
                  <h3 className="text-2xl font-black flex items-center">
                    {viewingUser.username} {viewingUser.is_verified && <VerificationBadge size="w-6 h-6" />}
                  </h3>
                  <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest mt-1">Target Account</p>
                </div>
              </div>

              <div className="bg-black/60 border border-zinc-800 rounded-xl p-6 mb-8">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-4">Injection Payload (Likes)</label>
                <div className="flex gap-4">
                  <input 
                    type="number" 
                    value={boostAmount} 
                    onChange={e => setBoostAmount(e.target.value)}
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 outline-none focus:border-purple-500 text-lg font-bold"
                  />
                  <div className="flex gap-2">
                    {['100', '500', '1000'].map(amt => (
                      <button key={amt} onClick={() => setBoostAmount(amt)} className="px-4 bg-zinc-800 rounded-lg text-xs font-bold hover:bg-zinc-700 transition-colors">{amt}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 overflow-y-auto max-h-[300px] no-scrollbar">
                {selectedUserPosts.map(p => (
                  <div key={p.id} className="relative aspect-square rounded-lg overflow-hidden group border border-white/5">
                    <img src={p.media_url} className="w-full h-full object-cover opacity-60 group-hover:opacity-100" />
                    <button 
                      onClick={() => handleBoost(p.id)}
                      className="absolute inset-0 bg-purple-500/20 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-all"
                    >
                      <ArrowUpCircle className="w-8 h-8 text-white mb-2" />
                      <span className="text-[10px] font-black text-white">INJECT +{boostAmount}</span>
                    </button>
                    <div className="absolute top-2 left-2 text-[8px] font-black bg-black/60 px-2 py-0.5 rounded-full text-zinc-400 border border-white/5">
                      {p.boosted_likes || 0} BOOSTED
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-full border-2 border-zinc-900 border-dashed rounded-2xl flex flex-col items-center justify-center p-20 text-center">
              <UserIcon className="w-12 h-12 text-zinc-800 mb-4" />
              <h3 className="text-zinc-600 font-black uppercase tracking-widest">Select target creator</h3>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Admin;
