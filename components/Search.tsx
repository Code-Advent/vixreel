
import React, { useState, useEffect } from 'react';
import { Search as SearchIcon, X, User } from 'lucide-react';
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
          placeholder="Search creators..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-12 pr-4 outline-none focus:border-stone-600"
        />
        {query && (
          <button onClick={() => setQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-500">
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
              className="flex items-center gap-4 p-3 rounded-xl hover:bg-zinc-900 cursor-pointer group"
            >
              <div className="w-12 h-12 rounded-full overflow-hidden border border-zinc-800 bg-zinc-900">
                {user.avatar_url ? (
                  <img src={user.avatar_url} className="w-full h-full object-cover" alt={user.username} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-700"><User /></div>
                )}
              </div>
              <div>
                <div className="font-bold flex items-center">
                  {user.username} {user.is_verified && <VerificationBadge />}
                </div>
                <div className="text-stone-500 text-xs">{user.full_name || 'Individual Creator'}</div>
              </div>
            </div>
          ))
        ) : query.length >= 2 && (
          <div className="text-center py-12 text-stone-500 italic">No users found for "{query}"</div>
        )}
      </div>
    </div>
  );
};

export default Search;
