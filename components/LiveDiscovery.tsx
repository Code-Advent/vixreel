import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useTranslation } from '../lib/translation';
import { Users, Play, Loader2, Video } from 'lucide-react';
import { formatNumber } from '../lib/utils';

interface LiveDiscoveryProps {
  onJoinLive: (stream: any) => void;
}

const LiveDiscovery: React.FC<LiveDiscoveryProps> = ({ onJoinLive }) => {
  const { t } = useTranslation();
  const [streams, setStreams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLiveStreams();

    const channel = supabase
      .channel('live-discovery')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'live_streams' 
      }, () => {
        fetchLiveStreams();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchLiveStreams = async () => {
    try {
      const { data } = await supabase
        .from('live_streams')
        .select('*, user:profiles(*)')
        .eq('is_live', true)
        .order('viewer_count', { ascending: false });
      
      if (data) setStreams(data);
    } catch (err) {
      console.error('Fetch Live Streams Error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-pink-500 animate-spin mb-4" />
        <p className="text-zinc-500 font-black uppercase tracking-widest text-[10px]">{t('Scanning for signals...')}</p>
      </div>
    );
  }

  return (
    <div className="animate-vix-in pb-20">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-500/10 rounded-2xl flex items-center justify-center">
            <Video className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-[var(--vix-text)]">{t('Live Now')}</h2>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{streams.length} {t('Active Streams')}</p>
          </div>
        </div>
      </div>

      {streams.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 bg-[var(--vix-secondary)]/30 rounded-[3rem] border border-dashed border-[var(--vix-border)]">
          <div className="w-20 h-20 bg-[var(--vix-bg)] rounded-full flex items-center justify-center mb-6 shadow-xl">
            <Video className="w-10 h-10 text-zinc-300" />
          </div>
          <h3 className="text-lg font-black text-[var(--vix-text)] mb-2">{t('No one is live right now')}</h3>
          <p className="text-zinc-500 text-sm max-w-xs text-center">{t('Check back later or follow more creators to see when they go live!')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {streams.map((stream) => (
            <div 
              key={stream.id}
              onClick={() => onJoinLive(stream)}
              className="group relative aspect-[3/4] bg-zinc-900 rounded-[2rem] overflow-hidden cursor-pointer border border-[var(--vix-border)] shadow-2xl hover:scale-[1.02] transition-all"
            >
              {/* Thumbnail / Preview */}
              <div className="absolute inset-0">
                <img 
                  src={stream.user?.cover_url || `https://picsum.photos/seed/${stream.id}/400/600`} 
                  className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity"
                  alt={stream.user?.username}
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
              </div>

              {/* Top Badges */}
              <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
                <div className="bg-red-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full shadow-lg animate-pulse">
                  LIVE
                </div>
                <div className="bg-black/40 backdrop-blur-md px-2 py-0.5 rounded-full flex items-center gap-1 border border-white/10">
                  <Users className="w-2.5 h-2.5 text-white" />
                  <span className="text-[9px] font-bold text-white">{formatNumber(stream.viewer_count || 0)}</span>
                </div>
              </div>

              {/* Bottom Info */}
              <div className="absolute bottom-4 left-4 right-4 space-y-2">
                <div className="flex items-center gap-2">
                  <img 
                    src={stream.user?.avatar_url || `https://ui-avatars.com/api/?name=${stream.user?.username}`} 
                    className="w-8 h-8 rounded-full border-2 border-white/20 object-cover" 
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] font-black text-white truncate">@{stream.user?.username}</span>
                    <span className="text-[9px] text-white/60 font-medium truncate">{stream.title || t('Live Stream')}</span>
                  </div>
                </div>
              </div>

              {/* Play Button Overlay */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30 scale-75 group-hover:scale-100 transition-transform">
                  <Play className="w-6 h-6 text-white fill-white" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LiveDiscovery;
