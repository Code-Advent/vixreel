
import React, { useState, useEffect } from 'react';
import { Search as SearchIcon, X, User, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { UserProfile } from '../types';
import VerificationBadge from './VerificationBadge';

interface SearchProps {
  onSelectUser: (user: UserProfile) => void;
}

const Search: React.FC<SearchProps> = ({ onSelectUser }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Listen for global identity updates (like verification status changes)
    const handleIdentityUpdate = (e: any) => {
      const { id, ...updates } = e.detail;
      setResults(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u));
    };

    window.addEventListener('vixreel-user-updated', handleIdentityUpdate);
    return () => window.removeEventListener('vixreel-user-updated', handleIdentityUpdate);
  }, []);

  useEffect(() => {
    const searchUsers = async () => {
      if (query.length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .ilike('username', `%${query}%`)
        .limit(15);

      if (!error && data) {
        setResults(data as UserProfile[]);
      }
      setLoading(false);
    };

    const timer = setTimeout(searchUsers, 300);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="max-w-[650px] mx-auto py-12 px-4 animate-vix-in">
      <div className="flex flex-col gap-2 mb-10 text-center md:text-left">
        <h2 className="text-3xl font-black uppercase tracking-[0.3em] text-white">Search</h2>
        <p className="text-[11px] text-zinc-600 font-bold uppercase tracking-[0.4em]">Find creators to follow</p>
      </div>
      
      <div className="relative mb-12 group">
        <SearchIcon className="absolute left-7 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-700 group-focus-within:text-pink-500 transition-all duration-300" />
        <input
          type="text"
          placeholder="Search by username..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-zinc-950/50 border border-zinc-900 rounded-[2.5rem] py-6 pl-16 pr-8 outline-none focus:border-pink-500/50 focus:ring-4 focus:ring-pink-500/5 transition-all text-white placeholder:text-zinc-800 text-sm font-medium shadow-2xl"
          autoFocus
        />
        {query && (
          <button onClick={() => setQuery('')} className="absolute right-7 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white p-2 bg-zinc-900 rounded-full transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-6">
            <div className="w-16 h-16 rounded-[1.5rem] bg-zinc-900/50 flex items-center justify-center animate-pulse border border-zinc-800">
               <Loader2 className="w-8 h-8 text-pink-500 animate-spin" />
            </div>
            <span className="text-[11px] font-black uppercase tracking-[0.5em] text-zinc-700 animate-pulse">Searching...</span>
          </div>
        ) : results.length > 0 ? (
          results.map((user) => (
            <div 
              key={user.id}
              onClick={() => onSelectUser(user)}
              className="flex items-center gap-6 p-6 rounded-[3rem] bg-zinc-950/30 border border-zinc-900/50 hover:bg-zinc-900 hover:border-pink-500/30 cursor-pointer transition-all duration-300 group animate-vix-in shadow-xl hover:shadow-pink-500/5"
            >
              <div className={`w-16 h-16 rounded-full p-0.5 transition-transform group-hover:scale-105 duration-500 ${user.is_verified ? 'vix-gradient shadow-2xl shadow-pink-500/20' : 'bg-zinc-800'}`}>
                <div className="w-full h-full rounded-full bg-black p-0.5 overflow-hidden">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} className="w-full h-full object-cover rounded-full" alt={user.username} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-800"><User className="w-8 h-8" /></div>
                  )}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-black text-[15px] flex items-center gap-2 text-zinc-200 group-hover:text-white transition-colors">
                  @{user.username} {user.is_verified && <VerificationBadge size="w-3.5 h-3.5" />}
                </div>
                <div className="text-zinc-600 text-[10px] font-black uppercase tracking-[0.2em] mt-1 truncate">{user.full_name || 'Creator'}</div>
              </div>
              <div className="bg-zinc-900 p-3 rounded-2xl text-zinc-700 group-hover:text-pink-500 transition-all group-hover:rotate-45">
                 <X className="w-5 h-5 rotate-45" />
              </div>
            </div>
          ))
        ) : query.length >= 2 && (
          <div className="text-center py-24 animate-in fade-in zoom-in duration-500">
             <div className="w-20 h-20 bg-zinc-900/30 rounded-[2rem] border border-zinc-900 border-dashed flex items-center justify-center mx-auto mb-8">
                <SearchIcon className="w-8 h-8 text-zinc-800" />
             </div>
             <p className="text-zinc-800 text-[11px] font-black uppercase tracking-[0.5em]">No users found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Search;
