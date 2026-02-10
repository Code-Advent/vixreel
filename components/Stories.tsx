
import React, { useState, useEffect } from 'react';
import { Plus, Loader2, X, ChevronLeft, ChevronRight, User as UserIcon } from 'lucide-react';
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
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);

  useEffect(() => {
    fetchStories();

    // Listen for global identity updates (Verification)
    const handleIdentityUpdate = (e: any) => {
      const { id, ...updates } = e.detail;
      setStories(prev => prev.map(story => {
        if (story.user_id === id) {
          return { ...story, user: { ...story.user, ...updates } };
        }
        return story;
      }));
    };

    window.addEventListener('vixreel-user-updated', handleIdentityUpdate);
    return () => window.removeEventListener('vixreel-user-updated', handleIdentityUpdate);
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
    const mType = file.type.startsWith('video') ? 'video' : 'image';

    try {
      const { error: uploadError } = await supabase.storage
        .from('stories')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('stories').getPublicUrl(filePath);
      
      const { error: dbError } = await supabase.from('stories').insert({
        user_id: currentUser.id,
        media_url: publicUrl,
        media_type: mType
      });

      if (dbError) throw dbError;
      await fetchStories();
    } catch (err: any) {
      console.error("Story Error:", err);
      alert("Story upload failed: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  if (loading) return <div className="h-24 w-full animate-pulse bg-zinc-900/10 rounded-xl mb-4"></div>;

  return (
    <>
      <div className="flex gap-4 overflow-x-auto py-4 no-scrollbar w-full max-w-[470px]">
        {/* Add Story Button */}
        <div className="flex flex-col items-center gap-2 min-w-[72px] cursor-pointer group relative">
          <label className="cursor-pointer">
            <div className={`w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center relative group-hover:border-zinc-700 transition-all ${isUploading ? 'animate-pulse' : ''}`}>
              {isUploading ? (
                <Loader2 className="w-6 h-6 text-pink-500 animate-spin" />
              ) : (
                <>
                  <div className="absolute bottom-0 right-0 bg-[#0095f6] rounded-full p-1 border-2 border-black z-10 shadow-lg">
                    <Plus className="text-white w-3 h-3" />
                  </div>
                  {currentUser?.avatar_url ? (
                    <img src={currentUser.avatar_url} className="w-full h-full rounded-full object-cover p-0.5" />
                  ) : (
                    <UserIcon className="w-8 h-8 text-zinc-700" />
                  )}
                </>
              )}
            </div>
            <input type="file" className="hidden" accept="image/*,video/*" onChange={handleStoryUpload} disabled={isUploading} />
          </label>
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">You</span>
        </div>

        {stories.map((story, index) => (
          <div key={story.id} className="flex flex-col items-center gap-2 min-w-[72px] cursor-pointer animate-vix-in" onClick={() => setActiveStoryIndex(index)}>
            <div className="w-16 h-16 rounded-full vix-gradient p-[2px] shadow-xl active:scale-95 transition-transform shadow-pink-500/10">
              <div className="w-full h-full rounded-full bg-black p-[2px]">
                <img src={story.user.avatar_url || `https://ui-avatars.com/api/?name=${story.user.username}`} className="w-full h-full rounded-full object-cover" alt={story.user.username} />
              </div>
            </div>
            <span className="text-[10px] text-white font-bold flex items-center gap-0.5 max-w-full truncate px-1 uppercase tracking-tight">
              {story.user.username} {story.user.is_verified && <VerificationBadge size="w-2.5 h-2.5" />}
            </span>
          </div>
        ))}
      </div>

      {/* Story Viewer Modal */}
      {activeStoryIndex !== null && (
        <div className="fixed inset-0 z-[1000] bg-black/98 flex items-center justify-center animate-in fade-in duration-300">
          <button onClick={() => setActiveStoryIndex(null)} className="absolute top-8 right-8 text-white/50 hover:text-white z-20 p-2 bg-black/40 rounded-full backdrop-blur-md">
            <X className="w-8 h-8" />
          </button>

          {activeStoryIndex > 0 && (
            <button onClick={() => setActiveStoryIndex(activeStoryIndex - 1)} className="absolute left-4 md:left-20 text-white/30 hover:text-white z-10 p-4 transition-all hover:scale-110">
              <ChevronLeft className="w-12 h-12" />
            </button>
          )}

          <div className="w-full max-w-md aspect-[9/16] bg-zinc-950 relative rounded-2xl overflow-hidden shadow-[0_0_120px_rgba(255,0,128,0.2)]">
            <div className="absolute top-0 left-0 right-0 p-5 z-20 flex items-center gap-3 bg-gradient-to-b from-black/80 to-transparent">
              <img 
                src={stories[activeStoryIndex].user.avatar_url || `https://ui-avatars.com/api/?name=${stories[activeStoryIndex].user.username}`} 
                className="w-8 h-8 rounded-full border border-white/20 shadow-lg" 
              />
              <div className="flex flex-col">
                <span className="font-black text-sm text-white flex items-center gap-1 uppercase tracking-widest">
                  {stories[activeStoryIndex].user.username}
                  {stories[activeStoryIndex].user.is_verified && <VerificationBadge size="w-3.5 h-3.5" />}
                </span>
                <span className="text-[10px] text-white/40 font-bold">{new Date(stories[activeStoryIndex].created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>

            {stories[activeStoryIndex].media_type === 'video' ? (
              <video 
                src={stories[activeStoryIndex].media_url} 
                autoPlay 
                className="w-full h-full object-contain" 
                onEnded={() => {
                  if (activeStoryIndex < stories.length - 1) setActiveStoryIndex(activeStoryIndex + 1);
                  else setActiveStoryIndex(null);
                }} 
              />
            ) : (
              <img src={stories[activeStoryIndex].media_url} className="w-full h-full object-contain" alt="Story" />
            )}
          </div>

          {activeStoryIndex < stories.length - 1 && (
            <button onClick={() => setActiveStoryIndex(activeStoryIndex + 1)} className="absolute right-4 md:right-20 text-white/30 hover:text-white z-10 p-4 transition-all hover:scale-110">
              <ChevronRight className="w-12 h-12" />
            </button>
          )}
        </div>
      )}
    </>
  );
};

export default Stories;
