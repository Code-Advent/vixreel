
import React, { useState, useEffect } from 'react';
import { Compass, UserPlus, Heart, Grid, Search as SearchIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { UserProfile, Post } from '../types';
import VerificationBadge from './VerificationBadge';

interface ExploreProps {
  currentUserId: string;
  onSelectUser: (user: UserProfile) => void;
}

const Explore: React.FC<ExploreProps> = ({ currentUserId, onSelectUser }) => {
  const [suggestedUsers, setSuggestedUsers] = useState<UserProfile[]>([]);
  const [explorePosts, setExplorePosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchExploreData();

    const handleIdentityUpdate = (e: any) => {
      const { id, ...updates } = e.detail;
      setSuggestedUsers(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u));
      setExplorePosts(prev => prev.map(p => p.user_id === id ? { ...p, user: { ...p.user, ...updates } } : p));
    };

    const handlePostUpdate = (e: any) => {
      const { id, boosted_likes } = e.detail;
      setExplorePosts(prev => prev.map(p => p.id === id ? { ...p, boosted_likes } : p));
    };

    window.addEventListener('vixreel-user-updated', handleIdentityUpdate);
    window.addEventListener('vixreel-post-updated', handlePostUpdate);
    return () => {
      window.removeEventListener('vixreel-user-updated', handleIdentityUpdate);
      window.removeEventListener('vixreel-post-updated', handlePostUpdate);
    };
  }, []);

  const fetchExploreData = async () => {
    setLoading(true);
    try {
      const { data: users } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', currentUserId)
        .order('is_verified', { ascending: false })
        .limit(10);
      
      if (users) setSuggestedUsers(users as UserProfile[]);

      const { data: posts } = await supabase
        .from('posts')
        .select('*, user:profiles(*)')
        .order('boosted_likes', { ascending: false })
        .limit(20);
      
      if (posts) setExplorePosts(posts as any);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[935px] mx-auto py-8 px-4 animate-vix-in pb-20">
      <div className="mb-12">
        <div className="flex items-center justify-between mb-8 px-2">
          <h2 className="text-xl font-black uppercase tracking-[0.2em] flex items-center gap-2 text-[var(--vix-text)]">
            <UserPlus className="w-5 h-5 text-pink-500" /> Suggested for you
          </h2>
          <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Explore Creators</span>
        </div>
        
        <div className="flex gap-4 overflow-x-auto no-scrollbar py-2">
          {suggestedUsers.map(user => (
            <div 
              key={user.id} 
              onClick={() => onSelectUser(user)}
              className="min-w-[180px] bg-[var(--vix-card)] border border-[var(--vix-border)] rounded-[2.5rem] p-6 flex flex-col items-center text-center group cursor-pointer hover:border-pink-500/30 transition-all hover:scale-105"
            >
              <div className={`w-20 h-20 rounded-full mb-4 p-1 ${user.is_verified ? 'vix-gradient shadow-lg shadow-pink-500/10' : 'bg-[var(--vix-secondary)]'}`}>
                <div className="w-full h-full rounded-full border-2 border-[var(--vix-bg)] overflow-hidden bg-[var(--vix-bg)]">
                  <img src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.username}`} className="w-full h-full object-cover" />
                </div>
              </div>
              <h3 className="font-black text-xs mb-1 flex items-center gap-1 group-hover:text-pink-500 transition-colors text-[var(--vix-text)]">
                @{user.username} {user.is_verified && <VerificationBadge size="w-3 h-3" />}
              </h3>
              <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-4 truncate w-full">{user.full_name || 'Creator'}</p>
              <button className="w-full py-2 bg-[var(--vix-secondary)] rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[var(--vix-text)] hover:text-[var(--vix-bg)] transition-all text-[var(--vix-text)]">Follow</button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-8 px-2">
          <h2 className="text-xl font-black uppercase tracking-[0.2em] flex items-center gap-2 text-[var(--vix-text)]">
            <Compass className="w-5 h-5 text-purple-500" /> Trending Now
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-6">
          {loading ? (
             Array.from({length: 9}).map((_, i) => (
                <div key={i} className="aspect-square bg-[var(--vix-secondary)] rounded-2xl animate-pulse"></div>
             ))
          ) : explorePosts.map((post, i) => (
            <div 
              key={post.id} 
              className={`relative aspect-square rounded-[1.5rem] sm:rounded-[2.5rem] overflow-hidden group shadow-2xl border border-[var(--vix-border)] cursor-pointer ${i % 5 === 0 ? 'md:col-span-2 md:row-span-2' : ''}`}
            >
              {post.media_type === 'video' ? (
                <video src={post.media_url} className="w-full h-full object-cover" muted />
              ) : (
                <img src={post.media_url} className="w-full h-full object-cover" alt="Trending" />
              )}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all backdrop-blur-sm gap-4">
                <div className="flex items-center gap-1.5 text-white font-black text-xs">
                  <Heart className="w-4 h-4 fill-white" /> {(post.likes_count || 0) + (post.boosted_likes || 0)}
                </div>
              </div>
              <div className="absolute top-4 left-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                   <span className="text-[10px] font-black text-white">@{post.user.username}</span>
                   {post.user.is_verified && <VerificationBadge size="w-3 h-3" />}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Explore;
