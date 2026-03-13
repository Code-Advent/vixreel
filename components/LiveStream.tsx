
import React, { useEffect, useRef } from 'react';
import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';
import { UserProfile } from '../types';
import { X } from 'lucide-react';

interface LiveStreamProps {
  currentUser: UserProfile;
  roomID: string;
  isHost: boolean;
  onClose: () => void;
}

const LiveStream: React.FC<LiveStreamProps> = ({ currentUser, roomID, isHost, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);

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

    zp.joinRoom({
      container: containerRef.current,
      scenario: {
        mode: isHost ? ZegoUIKitPrebuilt.LiveStreaming : ZegoUIKitPrebuilt.LiveStreaming,
        config: {
          role: isHost ? ZegoUIKitPrebuilt.Host : ZegoUIKitPrebuilt.Audience,
        },
      },
      showPreJoinView: false,
      onLeaveRoom: () => {
        onClose();
      },
    });

    return () => {
      if (zp) {
        zp.destroy();
      }
    };
  }, [currentUser, roomID, isHost, onClose]);

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col">
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
