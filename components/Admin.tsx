
import React, { useState, useEffect } from 'react';
import { Shield, ArrowUpCircle, User as UserIcon, Film, Loader2, Search as SearchIcon, CheckCircle } from 'lucide-react';
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
      alert("Please enter a valid positive number for boosting.");
      return;
    }
    const { data: post } = await supabase.from('posts').select('boosted_likes').eq('id', postId).single();
    const { error } = await supabase.from('posts').update({ boosted_likes: (post?.boosted_likes || 0) + amount }).eq('id', postId);
    if (!error) {
      setSelectedUserPosts(selectedUserPosts.map(p => p.id === postId ? { ...p, boosted_likes: (p.boosted_likes || 0) + amount } : p));
    }
  };

  const filteredUsers = users.filter(u => u.username.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="p-6 max-w-6xl mx-auto animate-vix-in">
      <div className="flex items-center gap-4 mb-10 pb-6 border-b border-zinc-800/50">
        <div className="p-3 bg-purple-500/10 rounded-2xl border border-purple-500/20">
          <Shield className="w-8 h-8 text-purple-500" />
        </div>
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter">VixReel Management</h1>
          <p className="text-zinc-600 text-[10px] font-black uppercase tracking-[0.4em]">Authorized Access Only • System Overrides</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 bg-zinc-950/40 rounded-[2rem] border border-white/5 flex flex-col h-[650px] shadow-2xl overflow-hidden">
          <div className="p-5 border-b border-white/5 relative bg-zinc-900/20">
             <SearchIcon className="absolute left-8 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
             <input 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-black/40 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-xs outline-none focus:border-purple-500/50 transition-all" 
              placeholder="Search directory..."
             />
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar">
            {filteredUsers.map(u => (
              <div 
                key={u.id} 
                onClick={() => { setViewingUser(u); fetchUserPosts(u.id); }}
                className={`p-4 flex items-center justify-between cursor-pointer border-b border-white/5 transition-all ${viewingUser?.id === u.id ? 'bg-zinc-900/60 border-l-4 border-purple-500' : 'hover:bg-zinc-900/30 border-l-4 border-transparent'}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full p-[1.5px] ${u.is_verified ? 'vix-gradient' : 'bg-zinc-800'}`}>
                    <img src={u.avatar_url || `https://ui-avatars.com/api/?name=${u.username}`} className="w-full h-full rounded-full bg-black object-cover" alt={u.username} />
                  </div>
                  <span className="text-sm font-bold flex items-center">
                    {u.username} 
                    {u.is_verified && <VerificationBadge size="w-3.5 h-3.5" />}
                  </span>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleVerify(u.id, !u.is_verified); }}
                  className={`text-[9px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full border transition-all active:scale-95 ${u.is_verified ? 'bg-zinc-800 border-zinc-700 text-zinc-400' : 'bg-purple-500/10 text-purple-400 border-purple-500/30 hover:bg-purple-500/20'}`}
                >
                  {u.is_verified ? 'Unverify' : 'Verify'}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-8 space-y-6">
          {viewingUser ? (
            <div className="bg-zinc-950/40 rounded-[2rem] border border-white/5 p-8 h-full flex flex-col shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col md:flex-row items-center gap-8 mb-10 pb-10 border-b border-white/5">
                <div className="w-24 h-24 rounded-full p-1 vix-gradient shadow-2xl">
                  <img src={viewingUser.avatar_url || `https://ui-avatars.com/api/?name=${viewingUser.username}`} className="w-full h-full rounded-full bg-black border-2 border-black object-cover" alt={viewingUser.username} />
                </div>
                <div className="text-center md:text-left">
                  <h3 className="text-3xl font-black flex items-center justify-center md:justify-start gap-1">
                    {viewingUser.username}
                    {viewingUser.is_verified && <VerificationBadge size="w-7 h-7" />}
                  </h3>
                  <p className="text-zinc-500 text-xs font-black uppercase tracking-[0.2em] mt-2">Target Creator Identity</p>
                  <div className="mt-4 flex gap-2">
                    <span className="bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest text-zinc-500">ID: {viewingUser.id.slice(0, 8)}...</span>
                  </div>
                </div>
              </div>

              <div className="bg-black/40 border border-zinc-800 rounded-2xl p-8 mb-10">
                <div className="flex items-center gap-3 mb-6">
                  <ArrowUpCircle className="w-5 h-5 text-purple-500" />
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Like Injection System</h4>
                </div>
                <div className="flex flex-col gap-4">
                  <div className="flex gap-4">
                    <input 
                      type="number" 
                      value={boostAmount} 
                      onChange={e => setBoostAmount(e.target.value)}
                      className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 outline-none focus:border-purple-500 text-xl font-black transition-all"
                      placeholder="Enter amount..."
                    />
                    <div className="flex gap-2">
                      {['100', '500', '1000'].map(amt => (
                        <button key={amt} onClick={() => setBoostAmount(amt)} className={`px-5 rounded-xl text-xs font-black border transition-all ${boostAmount === amt ? 'bg-purple-500 border-purple-400 text-white shadow-lg shadow-purple-500/30' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'}`}>{amt}</button>
                      ))}
                    </div>
                  </div>
                  <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">Type any amount above to inject likes directly into post metadata.</p>
                </div>
              </div>

              <div className="flex-1">
                 <div className="flex items-center gap-3 mb-6">
                  <Film className="w-5 h-5 text-purple-500" />
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Visual Assets ({selectedUserPosts.length})</h4>
                </div>
                <div className="grid grid-cols-3 gap-4 overflow-y-auto max-h-[350px] no-scrollbar pr-2">
                  {selectedUserPosts.map(p => (
                    <div key={p.id} className="relative aspect-square rounded-2xl overflow-hidden group border border-white/5 shadow-xl bg-black">
                      {p.media_type === 'video' ? (
                        <video src={p.media_url} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                      ) : (
                        <img src={p.media_url} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" alt="Post" />
                      )}
                      <button 
                        onClick={() => handleBoost(p.id)}
                        className="absolute inset-0 bg-purple-500/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-all backdrop-blur-sm"
                      >
                        <ArrowUpCircle className="w-10 h-10 text-white mb-2 drop-shadow-2xl" />
                        <span className="text-[10px] font-black text-white uppercase tracking-widest">BOOST +{boostAmount}</span>
                      </button>
                      <div className="absolute top-3 left-3 flex gap-1">
                        <div className="text-[8px] font-black bg-black/80 backdrop-blur-md px-2 py-0.5 rounded-full text-zinc-300 border border-white/5">
                          {p.boosted_likes || 0} INJECTED
                        </div>
                      </div>
                    </div>
                  ))}
                  {selectedUserPosts.length === 0 && (
                    <div className="col-span-3 py-20 text-center border-2 border-zinc-900 border-dashed rounded-[2rem]">
                      <Film className="w-10 h-10 text-zinc-800 mx-auto mb-4" />
                      <p className="text-zinc-600 font-black uppercase text-[10px] tracking-widest">No assets shared</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full border-2 border-zinc-900 border-dashed rounded-[2rem] flex flex-col items-center justify-center p-20 text-center shadow-inner">
              <div className="w-20 h-20 bg-zinc-900/40 rounded-full flex items-center justify-center mb-8 border border-zinc-800/50">
                <UserIcon className="w-10 h-10 text-zinc-700" />
              </div>
              <h3 className="text-zinc-500 font-black uppercase tracking-[0.3em] text-sm">Target Identity Selection Required</h3>
              <p className="text-zinc-700 text-xs mt-4 font-medium max-w-xs leading-relaxed">Choose a creator from the system directory to initiate management protocols and asset overrides.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Admin;
