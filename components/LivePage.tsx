
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { UserProfile } from '../types';
import { useTranslation } from '../lib/translation';
import { Loader2, Video, Users, Play } from 'lucide-react';
import VerificationBadge from './VerificationBadge';

interface LivePageProps {
  onJoinStream: (user: UserProfile) => void;
}

const LivePage: React.FC<LivePageProps> = ({ onJoinStream }) => {
  const { t } = useTranslation();
  const [liveUsers, setLiveUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLiveUsers();

    const profilesChannel = supabase
      .channel('live-users-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'profiles',
        filter: 'is_live=eq.true'
      }, () => {
        fetchLiveUsers();
      })
      .subscribe();

    const streamsChannel = supabase
      .channel('live-streams-updates')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'live_streams'
      }, () => {
        fetchLiveUsers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(streamsChannel);
    };
  }, []);

  const fetchLiveUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*, live_streams!user_id(viewer_count)')
      .eq('is_live', true);

    if (data) {
      // Flatten the data to include viewer_count directly
      const flattened = data.map((u: any) => ({
        ...u,
        viewer_count: u.live_streams?.[0]?.viewer_count || 0
      }));
      setLiveUsers(flattened as any);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <Loader2 className="w-12 h-12 animate-spin text-pink-500 mb-4" />
        <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">{t('Discovering Live Streams...')}</p>
      </div>
    );
  }

  return (
    <div className="animate-vix-in pb-20">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-[var(--vix-text)] flex items-center gap-3">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            {t('Live Now')}
          </h2>
          <p className="text-zinc-500 text-sm mt-1">{t('Watch real-time streams from the community')}</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-full">
          <Users className="w-4 h-4 text-red-500" />
          <span className="text-red-500 font-black text-[10px] uppercase tracking-widest">{liveUsers.length} {t('Active')}</span>
        </div>
      </div>

      {liveUsers.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {liveUsers.map((user) => (
            <div 
              key={user.id} 
              className="group relative aspect-[9/16] bg-[var(--vix-card)] rounded-[2rem] overflow-hidden border border-[var(--vix-border)] hover:border-red-500/50 transition-all cursor-pointer shadow-xl shadow-black/20"
              onClick={() => onJoinStream(user)}
            >
              {/* Preview Background (using avatar as placeholder) */}
              <div className="absolute inset-0">
                <img 
                  src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.username}`} 
                  className="w-full h-full object-cover blur-md opacity-30 scale-110" 
                  alt=""
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/60" />
              </div>

              {/* Live Badge */}
              <div className="absolute top-4 left-4 flex items-center gap-2">
                <div className="bg-red-500 text-white text-[10px] font-black px-3 py-1 rounded-full flex items-center gap-1.5 shadow-lg shadow-red-500/20">
                  <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                  LIVE
                </div>
                <div className="bg-black/40 backdrop-blur-md text-white text-[10px] font-black px-3 py-1 rounded-full flex items-center gap-1.5 border border-white/10">
                  <Users className="w-3 h-3" />
                  {(user as any).viewer_count || 0}
                </div>
              </div>

              {/* User Info */}
              <div className="absolute bottom-0 left-0 right-0 p-6 flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full p-0.5 bg-gradient-to-tr from-red-500 to-pink-500 shadow-lg">
                    <img 
                      src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.username}`} 
                      className="w-full h-full rounded-full object-cover border-2 border-black" 
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-white font-black text-sm flex items-center gap-1">
                      @{user.username}
                      {user.is_verified && <VerificationBadge size="w-3.5 h-3.5" />}
                    </span>
                    <span className="text-white/60 text-[10px] font-bold uppercase tracking-widest">{t('Streaming Now')}</span>
                  </div>
                </div>
                
                <button className="w-full py-3 bg-white text-black rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2 group-hover:bg-red-500 group-hover:text-white transition-all shadow-xl">
                  <Play className="w-4 h-4 fill-current" />
                  {t('Watch Stream')}
                </button>
              </div>

              {/* Hover Effect Overlay */}
              <div className="absolute inset-0 bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            </div>
          ))}
        </div>
      ) : (
        <div className="py-32 flex flex-col items-center justify-center bg-[var(--vix-secondary)]/20 rounded-[3rem] border border-dashed border-[var(--vix-border)]">
          <div className="w-20 h-20 bg-[var(--vix-secondary)] rounded-full flex items-center justify-center mb-6">
            <Video className="w-10 h-10 text-zinc-700" />
          </div>
          <h3 className="text-xl font-black text-[var(--vix-text)] mb-2">{t('No active streams')}</h3>
          <p className="text-zinc-500 text-sm text-center max-w-xs px-6">
            {t('Be the first to go live and start your own community broadcast!') }
          </p>
        </div>
      )}
    </div>
  );
};

export default LivePage;
