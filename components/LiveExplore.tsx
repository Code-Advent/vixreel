import React, { useState, useEffect } from 'react';
import { Radio, Users, Play, Loader2, Signal } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { LiveStream, UserProfile } from '../types';
import { useTranslation } from '../lib/translation';

interface LiveExploreProps {
  onSelectStream: (stream: LiveStream) => void;
  onStartBroadcast: () => void;
}

const LiveExplore: React.FC<LiveExploreProps> = ({ onSelectStream, onStartBroadcast }) => {
  const { t } = useTranslation();
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStreams();
    
    const channel = supabase
      .channel('live-explore')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_streams' }, () => {
        fetchStreams();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchStreams = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('live_streams')
        .select('*, user:profiles(*)')
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      
      if (data) setStreams(data as any);
    } catch (err) {
      console.error('Fetch Streams Error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-vix-in pb-20">
      <div className="flex justify-between items-center mb-10 px-2">
        <div>
          <h1 className="text-4xl font-black text-[var(--vix-text)] tracking-tight flex items-center gap-3">
            <Signal className="w-8 h-8 text-pink-500" />
            {t('Live Signals')}
          </h1>
          <p className="text-zinc-500 text-xs font-bold uppercase tracking-[0.3em] mt-2">{t('Real-time broadcasts from the VixReel network')}</p>
        </div>
        <button 
          onClick={onStartBroadcast}
          className="vix-gradient px-6 py-3 rounded-2xl text-white font-black uppercase tracking-widest text-[10px] shadow-xl shadow-pink-500/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
        >
          <Radio className="w-4 h-4" /> {t('Go Live')}
        </button>
      </div>

      {loading ? (
        <div className="py-32 flex flex-col items-center justify-center opacity-40">
          <Loader2 className="w-12 h-12 animate-spin mb-4" />
          <p className="text-[10px] font-black uppercase tracking-widest">{t('Scanning Frequencies...')}</p>
        </div>
      ) : streams.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {streams.map(stream => (
            <div 
              key={stream.id}
              onClick={() => onSelectStream(stream)}
              className="group relative aspect-[9/16] bg-zinc-900 rounded-[2.5rem] overflow-hidden cursor-pointer border border-[var(--vix-border)] hover:border-pink-500/50 transition-all shadow-2xl"
            >
              <img 
                src={`https://image.mux.com/${stream.playback_id}/thumbnail.jpg?time=0`} 
                className="w-full h-full object-cover opacity-60 group-hover:opacity-80 group-hover:scale-110 transition-all duration-700"
                alt="Live Stream Thumbnail"
              />
              
              {/* Overlay UI */}
              <div className="absolute inset-0 p-6 flex flex-col justify-between bg-gradient-to-t from-black/80 via-transparent to-black/40">
                <div className="flex justify-between items-start">
                  <div className="bg-red-500 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-lg">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                    <span className="text-[9px] font-black text-white uppercase tracking-widest">LIVE</span>
                  </div>
                  <div className="bg-black/40 backdrop-blur-md px-3 py-1 rounded-full flex items-center gap-1.5 border border-white/10">
                    <Users className="w-3 h-3 text-white" />
                    <span className="text-[9px] font-black text-white uppercase tracking-widest">{stream.viewer_count || 0}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full border-2 border-pink-500 p-0.5">
                      <img src={stream.user?.avatar_url} className="w-full h-full rounded-full object-cover" />
                    </div>
                    <div>
                      <p className="text-white font-black text-sm">@{stream.user?.username}</p>
                      <p className="text-white/60 text-[9px] font-bold uppercase tracking-widest">{t('Broadcasting Now')}</p>
                    </div>
                  </div>
                  <div className="w-full py-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 flex items-center justify-center gap-2 group-hover:bg-pink-500 transition-all">
                    <Play className="w-4 h-4 text-white fill-white" />
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">{t('Join Stream')}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-40 text-center flex flex-col items-center gap-6 opacity-20">
          <div className="w-24 h-24 rounded-full bg-[var(--vix-secondary)] flex items-center justify-center">
            <Signal className="w-12 h-12" />
          </div>
          <div className="space-y-2">
            <p className="font-black uppercase tracking-[0.4em] text-xs">{t('No active signals found')}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest">{t('Be the first to broadcast your signal')}</p>
          </div>
          <button 
            onClick={onStartBroadcast}
            className="mt-4 px-8 py-4 border-2 border-dashed border-[var(--vix-border)] rounded-full hover:border-pink-500/50 hover:text-pink-500 transition-all font-black text-[10px] uppercase tracking-widest"
          >
            {t('Initialize Signal')}
          </button>
        </div>
      )}
    </div>
  );
};

export default LiveExplore;
