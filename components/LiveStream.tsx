
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';
import { UserProfile } from '../types';
import VerificationBadge from './VerificationBadge';
import { X, Users as UsersIcon, Heart, Share2, Gift, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';

interface LiveStreamProps {
  currentUser: UserProfile;
  hostUser: UserProfile;
  roomID: string;
  isHost: boolean;
  onClose: () => void;
}

interface FloatingHeart {
  id: number;
  x: number;
  color: string;
  size: number;
}

const LiveStream: React.FC<LiveStreamProps> = ({ currentUser, hostUser, roomID, isHost, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [hearts, setHearts] = useState<FloatingHeart[]>([]);
  const [isLiked, setIsLiked] = useState(false);

  const addHeart = useCallback(() => {
    const id = Date.now();
    const colors = ['#ff4b2b', '#ff416c', '#ff0080', '#ff00cc', '#ffcc00'];
    const newHeart: FloatingHeart = {
      id,
      x: Math.random() * 40 - 20, // Random horizontal offset
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 10 + 20,
    };
    setHearts(prev => [...prev, newHeart]);
    setTimeout(() => {
      setHearts(prev => prev.filter(h => h.id !== id));
    }, 2000);
  }, []);

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
      turnOnCameraWhenJoining: true,
      showMyCameraToggleButton: isHost,
      showMyMicrophoneToggleButton: isHost,
      showAudioVideoSettingsButton: isHost,
      showScreenSharingButton: isHost,
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
    <div className="fixed inset-0 z-[200] bg-black flex flex-col animate-vix-in overflow-hidden">
      {/* Top Overlay */}
      <div className="absolute top-6 left-6 right-6 z-[210] flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-3">
          {/* Creator Info */}
          <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-full pl-1 pr-4 py-1 flex items-center gap-2 pointer-events-auto cursor-pointer hover:bg-black/60 transition-all">
            <div className="w-8 h-8 rounded-full overflow-hidden border border-white/20">
              <img 
                src={hostUser.avatar_url || `https://ui-avatars.com/api/?name=${hostUser.username}`} 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-white text-[11px] font-black leading-none flex items-center gap-1">
                {hostUser.username} {hostUser.is_verified && <VerificationBadge size="w-3 h-3" />}
              </span>
              <div className="flex items-center gap-1 mt-0.5">
                <UsersIcon className="w-2.5 h-2.5 text-white/60" />
                <span className="text-white/60 text-[9px] font-bold">{viewerCount}</span>
              </div>
            </div>
            {!isHost && (
              <button className="ml-2 bg-pink-500 text-white text-[9px] font-black px-3 py-1 rounded-full hover:bg-pink-600 transition-all active:scale-90">
                FOLLOW
              </button>
            )}
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
        <div className="flex flex-col gap-2 max-w-[280px] h-48 overflow-y-auto no-scrollbar mask-fade-top">
          {[
            { user: 'Alex', msg: 'This is amazing! 🔥' },
            { user: 'Sarah', msg: 'Love the content!' },
            { user: 'Mike', msg: 'Joined the stream' },
            { user: 'David', msg: 'Hello from London! 🇬🇧' },
            { user: 'Jessica', msg: 'Wow, so cool!' }
          ].map((chat, i) => (
            <div key={i} className="bg-black/20 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-white/5 animate-vix-in" style={{ animationDelay: `${i * 150}ms` }}>
              <span className="text-yellow-400 text-[11px] font-black mr-2">{chat.user}</span>
              <span className="text-white text-[11px] font-medium">{chat.msg}</span>
            </div>
          ))}
        </div>

        {/* Interaction Bar */}
        <div className="flex items-center justify-between pointer-events-auto">
          <div className="flex-1 max-w-[200px] bg-black/40 backdrop-blur-xl border border-white/10 rounded-full px-4 py-2.5 flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-white/40" />
            <span className="text-white/40 text-xs font-medium">Add comment...</span>
          </div>
          <div className="flex items-center gap-3 relative">
            {/* Animated Hearts Container */}
            <div className="absolute bottom-full right-0 mb-4 pointer-events-none">
              <AnimatePresence>
                {hearts.map(heart => (
                  <motion.div
                    key={heart.id}
                    initial={{ y: 0, opacity: 1, scale: 0.5, x: heart.x }}
                    animate={{ y: -200, opacity: 0, scale: 1.5, x: heart.x + (Math.random() * 40 - 20) }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    className="absolute bottom-0 right-4"
                  >
                    <Heart 
                      fill={heart.color} 
                      color={heart.color} 
                      size={heart.size} 
                      className="drop-shadow-lg"
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <button 
              onClick={() => {
                setIsLiked(!isLiked);
                addHeart();
              }}
              className={`w-11 h-11 backdrop-blur-xl border border-white/10 rounded-full flex items-center justify-center transition-all active:scale-90 ${isLiked ? 'bg-pink-500 text-white border-pink-500' : 'bg-black/40 text-white'}`}
            >
              <Heart className={`w-6 h-6 ${isLiked ? 'fill-current' : ''}`} />
            </button>
            <button className="w-11 h-11 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-all active:scale-90">
              <Share2 className="w-6 h-6" />
            </button>
            <div className="w-11 h-11 bg-gradient-to-tr from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-orange-500/20 cursor-pointer hover:scale-110 transition-all active:scale-90">
              <Gift className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* ZEGOCLOUD Container */}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
};

export default LiveStream;
