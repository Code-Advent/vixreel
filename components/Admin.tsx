
import React, { useState, useEffect } from 'react';
import { Shield, CheckCircle, ArrowUpCircle, User as UserIcon, Film, X, Search as SearchIcon, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { UserProfile, Post } from '../types';
import VerificationBadge from './VerificationBadge';

const Admin: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserPosts, setSelectedUserPosts] = useState<Post[]>([]);
  const [viewingUser, setViewingUser] = useState<UserProfile | null>(null);
  const [boostAmount, setBoostAmount] = useState<string>('100');
  const [loading, setLoading] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

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
    setVerifyingId(userId);
    const { error } = await supabase.from('profiles').update({ is_verified: status }).eq('id', userId);
    
    if (!error) {
      setUsers(users.map(u => u.id === userId ? { ...u, is_verified: status } : u));
      if (viewingUser?.id === userId) {
        setViewingUser({ ...viewingUser, is_verified: status });
      }
    } else {
      alert("Verification update failed: " + error.message);
    }
    setVerifyingId(null);
  };

  const handleBoost = async (postId: string) => {
    const amount = parseInt(boostAmount);
    if (isNaN(amount)) return;
    
    const { data: post } = await supabase.from('posts').select('boosted_likes').eq('id', postId).single();
    const currentBoost = post?.boosted_likes || 0;
    
    const { error } = await supabase.from('posts').update({ boosted_likes: currentBoost + amount }).eq('id', postId);
    if (!error) {
      alert(`Successfully added ${amount} boosted likes to this post.`);
      setSelectedUserPosts(selectedUserPosts.map(p => p.id === postId ? { ...p, boosted_likes: (p.boosted_likes || 0) + amount } : p));
    }
  };

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (u.email || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 max-w-6xl mx-auto animate-vix-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b border-zinc-800 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-500/10 rounded-2xl border border-purple-500/20">
            <Shield className="w-8 h-8 text-purple-400" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight">ADMIN CONSOLE</h1>
            <p className="text-[10px] uppercase tracking-[0.4em] text-zinc-600 font-bold">System Management & Moderation</p>
          </div>
        </div>

        <div className="relative w-full md:w-64">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input 
            type="text" 
            placeholder="Search users..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 outline-none text-xs focus:border-purple-500/50 transition-all"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* User List Sidebar */}
        <div className="lg:col-span-5 bg-zinc-950/40 rounded-[2rem] border border-white/5 overflow-hidden flex flex-col h-[600px] shadow-2xl">
          <div className="p-5 border-b border-white/5 bg-zinc-900/20 flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Global Users ({filteredUsers.length})</span>
            {loading && <Loader2 className="w-3 h-3 animate-spin text-zinc-500" />}
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar">
            {filteredUsers.length > 0 ? filteredUsers.map(user => (
              <div 
                key={user.id} 
                onClick={() => { setViewingUser(user); fetchUserPosts(user.id); }}
                className={`flex items-center justify-between p-4 hover:bg-zinc-800/40 cursor-pointer transition-all border-l-4 ${viewingUser?.id === user.id ? 'bg-zinc-800/60 border-purple-500' : 'border-transparent'}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full p-[1.5px] ${user.is_verified ? 'vix-gradient' : 'bg-zinc-800'}`}>
                    <img src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.username}`} className="w-full h-full rounded-full object-cover bg-black" />
                  </div>
                  <div>
                    <div className="font-bold text-sm flex items-center gap-1.5">
                      {user.username} {user.is_verified && <VerificationBadge size="w-3.5 h-3.5" />}
                    </div>
                    <div className="text-[10px] text-zinc-600 font-medium truncate max-w-[150px]">{user.email || 'No email associated'}</div>
                  </div>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleVerify(user.id, !user.is_verified); }}
                  disabled={verifyingId === user.id}
                  className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 ${user.is_verified ? 'bg-zinc-800 text-zinc-400 border border-zinc-700' : 'bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20'}`}
                >
                  {verifyingId === user.id ? 'Updating...' : (user.is_verified ? 'Unverify' : 'Verify')}
                </button>
              </div>
            )) : (
              <div className="p-20 text-center flex flex-col items-center gap-4">
                <UserIcon className="w-12 h-12 text-zinc-800" />
                <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">No matching users</p>
              </div>
            )}
          </div>
        </div>

        {/* User Detail Area */}
        <div className="lg:col-span-7 space-y-6">
          {viewingUser ? (
            <div className="bg-zinc-950/40 rounded-[2rem] border border-white/5 p-8 animate-in fade-in slide-in-from-bottom-4 duration-500 shadow-2xl h-full flex flex-col">
              <div className="flex flex-col md:flex-row items-center gap-6 mb-8 pb-8 border-b border-white/5">
                <div className="w-24 h-24 rounded-full p-[2px] vix-gradient shadow-2xl">
                  <img src={viewingUser.avatar_url || `https://ui-avatars.com/api/?name=${viewingUser.username}`} className="w-full h-full rounded-full border-2 border-black object-cover" />
                </div>
                <div className="text-center md:text-left space-y-2">
                  <h3 className="text-3xl font-black tracking-tighter flex items-center justify-center md:justify-start gap-3">
                    {viewingUser.username} {viewingUser.is_verified && <VerificationBadge size="w-8 h-8" />}
                  </h3>
                  <p className="text-zinc-500 text-sm font-medium">{viewingUser.full_name || 'Individual Creator'}</p>
                  <div className="flex gap-2 pt-1">
                    <span className="px-3 py-1 bg-zinc-900 rounded-full text-[9px] font-black uppercase tracking-widest text-zinc-400">ID: {viewingUser.id.slice(0, 8)}...</span>
                    {viewingUser.is_admin && <span className="px-3 py-1 bg-purple-500/10 text-purple-400 rounded-full text-[9px] font-black uppercase tracking-widest border border-purple-500/20">Administrator</span>}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600 flex items-center gap-2">
                    <ArrowUpCircle className="w-4 h-4 text-purple-500" /> Like Injection Tools
                  </h4>
                  <div className="bg-black/40 border border-zinc-800 rounded-2xl p-6 space-y-4">
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Boost Increment</label>
                      <div className="flex gap-2">
                        {['100', '500', '1000'].map(val => (
                          <button 
                            key={val} 
                            onClick={() => setBoostAmount(val)}
                            className={`flex-1 py-2 rounded-xl text-[10px] font-bold border transition-all ${boostAmount === val ? 'bg-purple-500 text-white border-purple-400 shadow-lg shadow-purple-500/20' : 'bg-zinc-900 text-zinc-400 border-zinc-800'}`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Custom Amount</label>
                      <input 
                        type="number" 
                        value={boostAmount} 
                        onChange={e => setBoostAmount(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-xs outline-none focus:border-purple-500 transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600 flex items-center gap-2">
                    <Film className="w-4 h-4 text-purple-500" /> Account Metrics
                  </h4>
                  <div className="bg-black/40 border border-zinc-800 rounded-2xl p-6 grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-zinc-900/50 rounded-xl">
                      <div className="text-xl font-black">{selectedUserPosts.length}</div>
                      <div className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Total Posts</div>
                    </div>
                    <div className="text-center p-4 bg-zinc-900/50 rounded-xl">
                      <div className="text-xl font-black">{selectedUserPosts.reduce((acc, p) => acc + (p.boosted_likes || 0), 0)}</div>
                      <div className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Boosted Likes</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600">User Visual Content</h4>
                <div className="grid grid-cols-3 gap-3 overflow-y-auto max-h-[300px] no-scrollbar pr-2">
                  {selectedUserPosts.map(post => (
                    <div key={post.id} className="relative group rounded-2xl overflow-hidden aspect-square bg-black border border-white/5 shadow-xl">
                      {post.media_type === 'video' ? (
                        <video src={post.media_url} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                      ) : (
                        <img src={post.media_url} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                      )}
                      <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full text-[8px] font-bold text-zinc-400">
                        {post.boosted_likes || 0} BOOSTED
                      </div>
                      <button 
                        onClick={() => handleBoost(post.id)}
                        className="absolute inset-0 flex flex-col items-center justify-center bg-purple-500/40 opacity-0 group-hover:opacity-100 transition-all backdrop-blur-[2px]"
                      >
                        <ArrowUpCircle className="w-8 h-8 mb-2 drop-shadow-2xl" />
                        <span className="text-[10px] font-black uppercase tracking-widest">INJECT +{boostAmount}</span>
                      </button>
                    </div>
                  ))}
                  {selectedUserPosts.length === 0 && (
                    <div className="col-span-3 py-12 text-center border-2 border-zinc-900 border-dashed rounded-3xl flex flex-col items-center gap-4">
                      <Film className="w-10 h-10 text-zinc-800" />
                      <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">No media uploaded</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full bg-zinc-950/20 rounded-[2rem] border-2 border-zinc-900 border-dashed flex flex-col items-center justify-center p-20 text-center shadow-inner">
              <div className="w-20 h-20 bg-zinc-900/50 rounded-full flex items-center justify-center mb-8 border border-zinc-800">
                <UserIcon className="w-10 h-10 text-zinc-700" />
              </div>
              <h3 className="text-xl font-black tracking-tight text-zinc-600 uppercase mb-2">Awaiting Selection</h3>
              <p className="text-zinc-700 text-xs font-medium max-w-[240px] leading-relaxed">Select a creator from the directory to manage their verification and visual assets.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Admin;
