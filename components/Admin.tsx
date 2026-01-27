
import React, { useState, useEffect } from 'react';
import { Shield, CheckCircle, ArrowUpCircle, User as UserIcon, Film, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { UserProfile, Post } from '../types';
import VerificationBadge from './VerificationBadge';

const Admin: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUserPosts, setSelectedUserPosts] = useState<Post[]>([]);
  const [viewingUser, setViewingUser] = useState<UserProfile | null>(null);
  const [boostAmount, setBoostAmount] = useState<string>('100');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('*').order('username');
    if (data) setUsers(data);
  };

  const fetchUserPosts = async (userId: string) => {
    const { data } = await supabase.from('posts').select('*, user:profiles(*)').eq('user_id', userId);
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
    const currentBoost = post?.boosted_likes || 0;
    
    const { error } = await supabase.from('posts').update({ boosted_likes: currentBoost + amount }).eq('id', postId);
    if (!error) {
      alert(`Boosted ${amount} likes!`);
      setSelectedUserPosts(selectedUserPosts.map(p => p.id === postId ? { ...p, boosted_likes: (p.boosted_likes || 0) + amount } : p));
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-8 border-b border-zinc-800 pb-4">
        <Shield className="w-8 h-8 vix-text-gradient" />
        <h1 className="text-3xl font-bold">Admin Panel</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 overflow-hidden">
          <div className="p-4 border-b border-zinc-800 font-bold">All Users ({users.length})</div>
          <div className="max-h-[600px] overflow-y-auto">
            {users.map(user => (
              <div 
                key={user.id} 
                onClick={() => { setViewingUser(user); fetchUserPosts(user.id); }}
                className={`flex items-center justify-between p-4 hover:bg-zinc-800 cursor-pointer transition-colors ${viewingUser?.id === user.id ? 'bg-zinc-800' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <img src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.username}`} className="w-10 h-10 rounded-full" />
                  <div>
                    <div className="font-semibold flex items-center">
                      {user.username} {user.is_verified && <VerificationBadge size="w-3 h-3" />}
                    </div>
                    <div className="text-xs text-stone-500">{user.email}</div>
                  </div>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleVerify(user.id, !user.is_verified); }}
                  className={`px-3 py-1 rounded text-xs font-bold ${user.is_verified ? 'bg-red-500/10 text-red-500' : 'bg-sky-500/10 text-sky-500'}`}
                >
                  {user.is_verified ? 'Unverify' : 'Verify'}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {viewingUser ? (
            <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 p-6 animate-in fade-in duration-300">
              <div className="flex items-center gap-4 mb-6">
                <img src={viewingUser.avatar_url || `https://ui-avatars.com/api/?name=${viewingUser.username}`} className="w-16 h-16 rounded-full border-2 border-zinc-800" />
                <div>
                  <h3 className="text-xl font-bold flex items-center">{viewingUser.username} {viewingUser.is_verified && <VerificationBadge />}</h3>
                  <p className="text-stone-400 text-sm">{viewingUser.full_name || 'No full name'}</p>
                </div>
              </div>

              <div className="mb-4">
                <label className="text-xs text-stone-500 uppercase font-bold">Boost Amount</label>
                <input 
                  type="number" 
                  value={boostAmount} 
                  onChange={e => setBoostAmount(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 mt-1 outline-none focus:border-purple-500"
                />
              </div>

              <h4 className="font-bold mb-4 flex items-center gap-2"><Film className="w-4 h-4" /> User Content</h4>
              <div className="grid grid-cols-2 gap-3 max-h-80 overflow-y-auto">
                {selectedUserPosts.map(post => (
                  <div key={post.id} className="relative group rounded-lg overflow-hidden aspect-square bg-black">
                    {post.media_type === 'video' ? (
                      <video src={post.media_url} className="w-full h-full object-cover opacity-60" />
                    ) : (
                      <img src={post.media_url} className="w-full h-full object-cover opacity-60" />
                    )}
                    <button 
                      onClick={() => handleBoost(post.id)}
                      className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <ArrowUpCircle className="w-8 h-8 mb-1" />
                      <span className="text-[10px] font-bold">BOOST LIKES</span>
                      <span className="text-[10px] text-stone-300">Boost: {post.boosted_likes || 0}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-full bg-zinc-900/50 rounded-2xl border border-zinc-800 border-dashed flex flex-col items-center justify-center p-12 text-stone-500 text-center">
              <UserIcon className="w-16 h-16 mb-4 opacity-20" />
              <p>Select a user to manage their profile and boost content</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Admin;
