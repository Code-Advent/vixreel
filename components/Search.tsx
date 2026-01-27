
import React, { useState, useEffect } from 'react';
import { Search as SearchIcon, X, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { UserProfile } from '../types';

interface SearchProps {
  onSelectUser: (user: UserProfile) => void;
}

const Search: React.FC<SearchProps> = ({ onSelectUser }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);

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
        .limit(10);

      if (!error && data) {
        setResults(data as UserProfile[]);
      }
      setLoading(false);
    };

    const timer = setTimeout(searchUsers, 300);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="max-w-[600px] mx-auto py-8 px-4">
      <h2 className="text-2xl font-bold mb-6">Search</h2>
      <div className="relative mb-8">
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-500" />
        <input
          type="text"
          placeholder="Search for users..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-12 pr-4 outline-none focus:border-stone-600 transition-colors"
        />
        {query && (
          <button 
            onClick={() => setQuery('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-500 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-2 border-stone-800 border-t-purple-500 rounded-full animate-spin"></div>
          </div>
        ) : results.length > 0 ? (
          results.map((user) => (
            <div 
              key={user.id}
              onClick={() => onSelectUser(user)}
              className="flex items-center gap-4 p-3 rounded-xl hover:bg-zinc-900 cursor-pointer transition-colors group"
            >
              <div className="w-14 h-14 rounded-full bg-zinc-800 overflow-hidden group-hover:p-0.5 group-hover:vix-gradient transition-all">
                <div className="w-full h-full rounded-full bg-black flex items-center justify-center p-0.5">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} className="w-full h-full rounded-full object-cover" alt={user.username} />
                  ) : (
                    <User className="w-6 h-6 text-stone-500" />
                  )}
                </div>
              </div>
              <div>
                <div className="font-semibold">{user.username}</div>
                <div className="text-stone-500 text-sm">{user.full_name || 'No name set'}</div>
              </div>
            </div>
          ))
        ) : query.length >= 2 ? (
          <div className="text-center py-12 text-stone-500">
            No users found matching "{query}"
          </div>
        ) : (
          <div className="text-center py-12 text-stone-500">
            Search for your friends on VixReel
          </div>
        )}
      </div>
    </div>
  );
};

export default Search;
