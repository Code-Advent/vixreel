
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
        if (isHost) startLive();
      },
      onLeaveRoom: () => {
        if (isHost) endLive();
        onClose();
      },
    });

    return () => {
      if (zp) {
        if (isHost) endLive();
        zp.destroy();
      }
    };
  }, [currentUser, roomID, isHost, onClose]);

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col">
      <div className="absolute top-4 left-4 z-[210] flex items-center gap-2">
        <div className="bg-red-500 text-white px-2 py-0.5 rounded text-[10px] font-black animate-pulse">
          LIVE
        </div>
        <div className="bg-black/40 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold text-white border border-white/10 flex items-center gap-1">
          <UsersIcon className="w-3 h-3" />
          {viewerCount}
        </div>
        <div className="bg-black/40 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold text-white border border-white/10">
          {roomID}
        </div>
      </div>
      <div className="absolute top-4 right-4 z-[210]">
        <button 
          onClick={onClose}
          className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
};

export default LiveStream;
