
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { EngagingVideo } from '../types';
import { Loader2, Heart, MessageCircle, Share2, Music2, AlertCircle } from 'lucide-react';
import { useTranslation } from '../lib/translation';

const EngagingVideos: React.FC = () => {
  const { t } = useTranslation();
  const [videos, setVideos] = useState<EngagingVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('engaging_videos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVideos(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getTikTokEmbedUrl = (url: string) => {
    const match = url.match(/video\/(\d+)/);
    if (match) return `https://www.tiktok.com/embed/v2/${match[1]}`;
    return null;
  };

  const getInstagramEmbedUrl = (url: string) => {
    const match = url.match(/reels\/([A-Za-z0-9_-]+)/) || url.match(/reel\/([A-Za-z0-9_-]+)/) || url.match(/p\/([A-Za-z0-9_-]+)/);
    if (match) return `https://www.instagram.com/reels/${match[1]}/embed`;
    return null;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
        <p className="text-zinc-500 font-bold uppercase tracking-widest text-[10px]">{t('Loading Engaging Content...')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4 text-red-500">
        <AlertCircle className="w-12 h-12" />
        <p className="font-bold">{error}</p>
        <button onClick={fetchVideos} className="px-6 py-2 bg-zinc-800 rounded-full text-white text-xs font-bold uppercase tracking-widest hover:bg-zinc-700 transition-all">
          {t('Retry')}
        </button>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4 opacity-20">
        <Share2 className="w-16 h-16" />
        <p className="font-bold uppercase tracking-[0.3em] text-xs">{t('No engaging videos yet')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-8 pb-32 animate-vix-in">
      {videos.map((video) => {
        const embedUrl = video.platform === 'tiktok' ? getTikTokEmbedUrl(video.video_url) : getInstagramEmbedUrl(video.video_url);
        
        if (!embedUrl) return null;

        return (
          <div key={video.id} className="w-full max-w-[470px] bg-[var(--vix-card)] rounded-[2.5rem] border border-[var(--vix-border)] overflow-hidden shadow-2xl">
            {/* Fake Profile Header - Non-clickable */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full p-0.5 bg-gradient-to-tr from-yellow-400 via-pink-500 to-red-500">
                  <div className="w-full h-full rounded-full p-0.5 bg-[var(--vix-bg)]">
                    <img 
                      src={video.fake_avatar_url || `https://ui-avatars.com/api/?name=${video.fake_username || 'User'}`} 
                      className="w-full h-full rounded-full object-cover" 
                    />
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-[var(--vix-text)]">
                    {video.fake_username || 'Engaging Creator'}
                  </span>
                  <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">
                    {video.platform === 'tiktok' ? 'TikTok' : 'Instagram Reel'}
                  </span>
                </div>
              </div>
            </div>

            {/* Embed Content */}
            <div className="relative aspect-[9/16] bg-black">
              <iframe
                src={embedUrl}
                className="absolute inset-0 w-full h-full border-0"
                allowFullScreen
                allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
              />
            </div>

            {/* Caption & Actions */}
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <button className="text-zinc-400 hover:text-pink-500 transition-all">
                    <Heart className="w-7 h-7" />
                  </button>
                  <button className="text-zinc-400 hover:text-blue-400 transition-all">
                    <MessageCircle className="w-7 h-7" />
                  </button>
                  <button className="text-zinc-400 hover:text-emerald-400 transition-all">
                    <Share2 className="w-7 h-7" />
                  </button>
                </div>
              </div>

              {video.caption && (
                <p className="text-sm text-[var(--vix-text)] leading-relaxed">
                  <span className="font-bold mr-2">@{video.fake_username || 'creator'}</span>
                  {video.caption}
                </p>
              )}

              <div className="flex items-center gap-2 text-zinc-500">
                <Music2 className="w-3 h-3" />
                <span className="text-[10px] font-bold uppercase tracking-widest truncate">
                  {t('Original Audio')} - {video.fake_username || 'Creator'}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default EngagingVideos;
