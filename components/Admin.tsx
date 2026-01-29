
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
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid amount.");
      return;
    }
    const { data: post } = await supabase.from('posts').select('boosted_likes').eq('id', postId).single();
    const newBoost = (post?.boosted_likes || 0) + amount;
    const { error } = await supabase.from('posts').update({ boosted_likes: newBoost }).eq('id', postId);
    if (!error) {
      setSelectedUserPosts(selectedUserPosts.map(p => p.id === postId ? { ...p, boosted_likes: newBoost } : p));
      alert(`Successfully added ${amount} likes.`);
    }
  };

  const filteredUsers = users.filter(u => u.username.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <Shield className="w-8 h-8 text-purple-500" />
        <h1 className="text-2xl font-bold uppercase tracking-widest">Admin Overrides</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 bg-zinc-950 rounded-xl border border-zinc-900 h-[600px] flex flex-col">
          <div className="p-4 border-b border-zinc-900 relative">
             <SearchIcon className="absolute left-7 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
             <input 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-black border border-zinc-800 rounded-lg py-2 pl-10 pr-4 text-xs outline-none" 
              placeholder="Search creators..."
             />
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar">
            {filteredUsers.map(u => (
              <div 
                key={u.id} 
                onClick={() => { setViewingUser(u); fetchUserPosts(u.id); }}
                className={`p-4 flex items-center justify-between cursor-pointer border-b border-white/5 ${viewingUser?.id === u.id ? 'bg-zinc-900' : 'hover:bg-zinc-900/40'}`}
              >
                <div className="flex items-center gap-2">
                  <img src={u.avatar_url || `https://ui-avatars.com/api/?name=${u.username}`} className="w-8 h-8 rounded-full" />
                  <span className="text-sm font-bold flex items-center">{u.username} {u.is_verified && <VerificationBadge size="w-3 h-3" />}</span>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleVerify(u.id, !u.is_verified); }}
                  className={`text-[9px] font-bold uppercase px-3 py-1 rounded-full border ${u.is_verified ? 'bg-zinc-800 border-zinc-700 text-zinc-500' : 'bg-purple-900/30 text-purple-400 border-purple-500/50'}`}
                >
                  {u.is_verified ? 'Unverify' : 'Verify'}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-8">
          {viewingUser ? (
            <div className="bg-zinc-950 rounded-xl border border-zinc-900 p-8">
              <div className="flex items-center gap-4 mb-8">
                <img src={viewingUser.avatar_url || `https://ui-avatars.com/api/?name=${viewingUser.username}`} className="w-16 h-16 rounded-full border-2 border-purple-500" />
                <h3 className="text-2xl font-bold flex items-center">{viewingUser.username} {viewingUser.is_verified && <VerificationBadge size="w-6 h-6" />}</h3>
              </div>

              <div className="bg-black border border-zinc-800 rounded-lg p-6 mb-8">
                <label className="text-xs font-bold text-zinc-500 uppercase block mb-3">Like Injection Amount</label>
                <div className="flex gap-4">
                  <input 
                    type="number" 
                    value={boostAmount} 
                    onChange={e => setBoostAmount(e.target.value)}
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 outline-none focus:border-purple-500"
                  />
                  <div className="flex gap-2">
                    {['100', '500', '1000'].map(v => (
                      <button key={v} onClick={() => setBoostAmount(v)} className="px-3 bg-zinc-800 rounded text-xs hover:bg-zinc-700">{v}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {selectedUserPosts.map(p => (
                  <div key={p.id} className="relative aspect-square rounded-lg overflow-hidden group border border-zinc-800">
                    <img src={p.media_url} className="w-full h-full object-cover opacity-60" />
                    <button 
                      onClick={() => handleBoost(p.id)}
                      className="absolute inset-0 bg-purple-500/20 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity"
                    >
                      <ArrowUpCircle className="w-8 h-8 text-white mb-2" />
                      <span className="text-[10px] font-bold text-white uppercase">Inject +{boostAmount}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-full border-2 border-zinc-900 border-dashed rounded-xl flex flex-col items-center justify-center p-20 text-center">
              <UserIcon className="w-12 h-12 text-zinc-800 mb-4" />
              <p className="text-zinc-600 font-bold uppercase text-sm">Select creator to manage</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Admin;
