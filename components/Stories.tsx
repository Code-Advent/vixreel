
import React, { useState, useEffect } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Story, UserProfile } from '../types';
import { sanitizeFilename } from '../lib/utils';
import VerificationBadge from './VerificationBadge';

interface StoriesProps {
  currentUser?: UserProfile | null;
}

const Stories: React.FC<StoriesProps> = ({ currentUser }) => {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetchStories();
  }, []);

  const fetchStories = async () => {
    const { data } = await supabase
      .from('stories')
      .select('*, user:profiles(*)')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });
    
    if (data) setStories(data as any);
    setLoading(false);
  };

  const handleStoryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    setIsUploading(true);
    const safeFilename = sanitizeFilename(file.name);
    const fileName = `${currentUser.id}-${Date.now()}-${safeFilename}`;
    const filePath = `active/${fileName}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('stories')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('stories').getPublicUrl(filePath);
      
      const { error: dbError } = await supabase.from('stories').insert({
        user_id: currentUser.id,
        media_url: publicUrl
      });

      if (dbError) throw dbError;
      
      await fetchStories();
    } catch (err: any) {
      alert("Story upload failed: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  if (loading) return <div className="h-24 w-full animate-pulse bg-zinc-900/20 rounded-xl"></div>;

  return (
    <div className="flex gap-4 overflow-x-auto py-4 no-scrollbar w-full max-w-[470px]">
      {/* Add Story Button */}
      <div className="flex flex-col items-center gap-2 min-w-[72px] cursor-pointer group relative">
        <label className="cursor-pointer">
          <div className={`w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center relative group-hover:border-zinc-700 transition-colors ${isUploading ? 'animate-spin border-t-pink-500' : ''}`}>
            {isUploading ? (
              <Loader2 className="w-6 h-6 text-pink-500 animate-spin" />
            ) : (
              <>
                <div className="absolute bottom-0 right-0 bg-[#0095f6] rounded-full p-1 border-2 border-black">
                  <Plus className="text-white w-3 h-3" />
                </div>
                <UserIcon className="w-8 h-8 text-zinc-700" />
              </>
            )}
          </div>
          <input type="file" className="hidden" accept="image/*" onChange={handleStoryUpload} disabled={isUploading} />
        </label>
        <span className="text-[10px] text-zinc-400">Your Story</span>
      </div>

      {stories.map(story => (
        <div key={story.id} className="flex flex-col items-center gap-2 min-w-[72px] cursor-pointer">
          <div className="w-16 h-16 rounded-full vix-gradient p-[2px] shadow-lg active:scale-95 transition-transform">
            <div className="w-full h-full rounded-full bg-black p-[2px]">
               <img src={story.user.avatar_url || `https://ui-avatars.com/api/?name=${story.user.username}`} className="w-full h-full rounded-full object-cover" alt={story.user.username} />
            </div>
          </div>
          <span className="text-[10px] text-white font-medium flex items-center gap-0.5 max-w-full truncate px-1">
            {story.user.username} {story.user.is_verified && <VerificationBadge size="w-2.5 h-2.5" />}
          </span>
        </div>
      ))}
      
      {stories.length === 0 && !isUploading && (
        <div className="flex items-center text-[10px] text-stone-600 italic px-4">No other stories</div>
      )}
    </div>
  );
};

const UserIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
);

export default Stories;
