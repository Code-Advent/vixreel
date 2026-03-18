
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { UserProfile } from '../types';
import { useTranslation } from '../lib/translation';
import { Loader2, Video, Users, Play, Heart, MessageCircle, Plus } from 'lucide-react';
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
    <div className="h-screen w-full bg-black overflow-y-scroll snap-y snap-mandatory no-scrollbar">
      {liveUsers.length > 0 ? (
        liveUsers.map((user) => (
          <div 
            key={user.id} 
            className="h-screen w-full snap-start relative flex flex-col justify-end pb-24 px-4"
            onClick={() => onJoinStream(user)}
          >
            {/* Background Preview */}
            <div className="absolute inset-0 z-0">
              <img 
                src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.username}`} 
                className="w-full h-full object-cover opacity-50 blur-sm" 
                alt=""
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
            </div>

            {/* Live Badge & Viewer Count */}
            <div className="absolute top-12 left-4 z-10 flex items-center gap-2">
              <div className="bg-red-600 text-white text-[11px] font-black px-3 py-1 rounded-sm flex items-center gap-1.5 shadow-lg">
                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                LIVE
              </div>
              <div className="bg-black/40 backdrop-blur-md text-white text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1.5 border border-white/10">
                <Users className="w-3.5 h-3.5" />
                {(user as any).viewer_count || 0}
              </div>
            </div>

            {/* User Info & Interaction */}
            <div className="relative z-10 flex flex-col gap-4 max-w-md animate-vix-in">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full p-0.5 bg-gradient-to-tr from-red-500 to-pink-500 shadow-xl">
                  <img 
                    src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.username}`} 
                    className="w-full h-full rounded-full object-cover border-2 border-black" 
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-white font-black text-lg flex items-center gap-1 drop-shadow-md">
                    @{user.username}
                    {user.is_verified && <VerificationBadge size="w-4 h-4" />}
                  </span>
                  <span className="text-white/80 text-xs font-medium drop-shadow-md">{t('Streaming Now')}</span>
                </div>
              </div>
              
              <p className="text-white/90 text-sm line-clamp-2 drop-shadow-md">
                {t('Join the conversation and watch this live broadcast!')}
              </p>

              <button className="w-full py-4 bg-red-600 text-white rounded-lg font-black text-sm uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-red-700 transition-all shadow-2xl active:scale-95">
                <Play className="w-5 h-5 fill-current" />
                {t('Watch Stream')}
              </button>
            </div>

            {/* Side Actions (TikTok style) */}
            <div className="absolute right-4 bottom-32 z-10 flex flex-col items-center gap-6">
              <div className="flex flex-col items-center gap-1">
                <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 hover:bg-white/20 transition-all cursor-pointer">
                  <Heart className="w-6 h-6 text-white" />
                </div>
                <span className="text-white text-[10px] font-bold">{(user as any).viewer_count * 12}</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 hover:bg-white/20 transition-all cursor-pointer">
                  <MessageCircle className="w-6 h-6 text-white" />
                </div>
                <span className="text-white text-[10px] font-bold">{(user as any).viewer_count * 3}</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 hover:bg-white/20 transition-all cursor-pointer">
                  <Plus className="w-6 h-6 text-white" />
                </div>
                <span className="text-white text-[10px] font-bold">{t('Share')}</span>
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className="h-screen w-full flex flex-col items-center justify-center bg-black px-6 text-center">
          <div className="w-24 h-24 bg-zinc-900 rounded-full flex items-center justify-center mb-8 border border-zinc-800">
            <Video className="w-12 h-12 text-zinc-700" />
          </div>
          <h3 className="text-2xl font-black text-white mb-3">{t('No active streams')}</h3>
          <p className="text-zinc-500 text-sm max-w-xs leading-relaxed">
            {t('Be the first to go live and start your own community broadcast!') }
          </p>
          <button className="mt-8 px-8 py-3 bg-white text-black rounded-full font-black text-xs uppercase tracking-widest hover:bg-zinc-200 transition-all">
            {t('Go Live')}
          </button>
        </div>
      )}
    </div>
  );
};

export default LivePage;
