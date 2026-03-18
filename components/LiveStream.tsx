
import React, { useEffect, useRef, useState } from 'react';
import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';
import { UserProfile } from '../types';
import { X, Users as UsersIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface LiveStreamProps {
  currentUser: UserProfile;
  roomID: string;
  isHost: boolean;
  onClose: () => void;
}

const LiveStream: React.FC<LiveStreamProps> = ({ currentUser, roomID, isHost, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewerCount, setViewerCount] = useState(0);

  useEffect(() => {
    // Fetch initial viewer count
    const fetchViewerCount = async () => {
      const { data } = await supabase
        .from('live_streams')
        .select('viewer_count')
        .eq('channel_name', roomID)
        .eq('is_live', true)
        .maybeSingle();
      
      if (data) setViewerCount(data.viewer_count || 0);
    };

    fetchViewerCount();

    // Subscribe to changes in viewer count
    const channel = supabase
      .channel(`live_stream_${roomID}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'live_streams',
        filter: `channel_name=eq.${roomID}`
      }, (payload) => {
        if (payload.new) {
          setViewerCount(payload.new.viewer_count || 0);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomID]);

  useEffect(() => {
    const appID = Number(import.meta.env.VITE_ZEGO_APP_ID || 2090682525);
    const serverSecret = import.meta.env.VITE_ZEGO_SERVER_SECRET || "4dd6e36982f14192013351508a3cdf3d";
    
    const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
      appID,
      serverSecret,
      roomID,
      currentUser.id,
      currentUser.username || currentUser.full_name || "User"
    );

    const zp = ZegoUIKitPrebuilt.create(kitToken);

    const startLive = async () => {
      if (isHost) {
        await supabase
          .from('profiles')
          .update({ is_live: true, live_channel_name: roomID })
          .eq('id', currentUser.id);
        
        await supabase.from('live_streams').insert({
          user_id: currentUser.id,
          channel_name: roomID,
          is_live: true
        });
      } else {
        // Increment viewer count
        await supabase.rpc('increment_live_viewers', { stream_channel: roomID });
      }
    };

    const endLive = async () => {
      if (isHost) {
        await supabase
          .from('profiles')
          .update({ is_live: false, live_channel_name: null })
          .eq('id', currentUser.id);
        
        await supabase
          .from('live_streams')
          .update({ is_live: false })
          .eq('user_id', currentUser.id)
          .eq('channel_name', roomID);
      } else {
        // Decrement viewer count
        await supabase.rpc('decrement_live_viewers', { stream_channel: roomID });
      }
    };

    zp.joinRoom({
      container: containerRef.current,
      scenario: {
        mode: ZegoUIKitPrebuilt.LiveStreaming,
        config: {
          role: isHost ? ZegoUIKitPrebuilt.Host : ZegoUIKitPrebuilt.Audience,
        },
      },
      showPreJoinView: false,
      onJoinRoom: () => {
        startLive();
      },
      onLeaveRoom: () => {
        endLive();
        onClose();
      },
    });

    return () => {
      if (zp) {
        endLive();
        zp.destroy();
      }
    };
  }, [currentUser, roomID, isHost, onClose]);

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col animate-vix-in">
      {/* Top Overlay */}
      <div className="absolute top-6 left-6 right-6 z-[210] flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-3">
          {/* Creator Info */}
          <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-full pl-1 pr-4 py-1 flex items-center gap-2 pointer-events-auto cursor-pointer hover:bg-black/60 transition-all">
            <div className="w-8 h-8 rounded-full overflow-hidden border border-white/20">
              <img 
                src={currentUser.avatar_url || `https://ui-avatars.com/api/?name=${currentUser.username}`} 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-white text-[11px] font-black leading-none">{currentUser.username}</span>
              <div className="flex items-center gap-1 mt-0.5">
                <UsersIcon className="w-2.5 h-2.5 text-white/60" />
                <span className="text-white/60 text-[9px] font-bold">{viewerCount}</span>
              </div>
            </div>
            <button className="ml-2 bg-red-500 text-white text-[9px] font-black px-3 py-1 rounded-full hover:bg-red-600 transition-all active:scale-90">
              FOLLOW
            </button>
          </div>

          {/* Live Badge */}
          <div className="bg-red-600 text-white px-3 py-1 rounded-md text-[10px] font-black shadow-lg shadow-red-600/20 flex items-center gap-1.5 pointer-events-auto">
            <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            LIVE
          </div>
        </div>

        <div className="flex items-center gap-3 pointer-events-auto">
          <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-full px-4 py-2 flex items-center gap-2">
            <div className="flex -space-x-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="w-6 h-6 rounded-full border-2 border-black bg-zinc-800 overflow-hidden">
                  <img src={`https://i.pravatar.cc/100?u=${i}`} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
            <span className="text-white text-[10px] font-black ml-1">+{viewerCount > 3 ? viewerCount - 3 : 0}</span>
          </div>
          
          <button 
            onClick={onClose}
            className="p-3 bg-black/40 backdrop-blur-xl border border-white/10 hover:bg-white/10 rounded-full text-white transition-all active:scale-90"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Bottom Overlay (TikTok Style) */}
      <div className="absolute bottom-10 left-6 right-6 z-[210] flex flex-col gap-4 pointer-events-none">
        {/* Mock Chat Messages */}
        <div className="flex flex-col gap-2 max-w-[280px]">
          {[
            { user: 'Alex', msg: 'This is amazing! 🔥' },
            { user: 'Sarah', msg: 'Love the content!' },
            { user: 'Mike', msg: 'Joined the stream' }
          ].map((chat, i) => (
            <div key={i} className="bg-black/20 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-white/5 animate-vix-in" style={{ animationDelay: `${i * 150}ms` }}>
              <span className="text-yellow-400 text-[11px] font-black mr-2">{chat.user}</span>
              <span className="text-white text-[11px] font-medium">{chat.msg}</span>
            </div>
          ))}
        </div>

        {/* Interaction Bar */}
        <div className="flex items-center justify-between pointer-events-auto">
          <div className="flex-1 max-w-[200px] bg-black/40 backdrop-blur-xl border border-white/10 rounded-full px-4 py-2.5">
            <span className="text-white/40 text-xs font-medium">Add comment...</span>
          </div>
          <div className="flex items-center gap-3">
            <button className="w-11 h-11 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-all active:scale-90">
              <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
            </button>
            <button className="w-11 h-11 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-all active:scale-90">
              <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92c0-1.61-1.31-2.92-2.92-2.92z"/></svg>
            </button>
            <div className="w-11 h-11 bg-gradient-to-tr from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-orange-500/20 cursor-pointer hover:scale-110 transition-all active:scale-90">
              <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current"><path d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.65-.5-.65C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36 2.38 3.24L17 10.83 14.92 8H20v6z"/></svg>
            </div>
          </div>
        </div>
      </div>

      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
};

export default LiveStream;
