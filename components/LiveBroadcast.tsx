import React, { useState, useRef, useEffect } from 'react';
import { 
  X, Loader2, RefreshCw, Sparkles, Wand2,
  Users, Send, Heart, Camera, StopCircle, Share2
} from 'lucide-react';
import { UserProfile } from '../types';
import { supabase } from '../lib/supabase';
import { useTranslation } from '../lib/translation';
import { formatNumber } from '../lib/utils';

interface LiveBroadcastProps {
  currentUser: UserProfile;
  onClose: () => void;
}

import AgoraRTC, { IAgoraRTCClient, IMicrophoneAudioTrack, ICameraVideoTrack } from 'agora-rtc-sdk-ng';

const AGORA_APP_ID = import.meta.env.VITE_AGORA_APP_ID || '39f712e5cf114fc084d9265e8987bbe6';

const LiveBroadcast: React.FC<LiveBroadcastProps> = ({ currentUser, onClose }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [streamData, setStreamData] = useState<{ id: string; channelName: string; token: string; uid: string | number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [hearts, setHearts] = useState<{ id: number; x: number }[]>([]);
  
  const videoRef = useRef<HTMLDivElement>(null);
  const agoraClientRef = useRef<IAgoraRTCClient | null>(null);
  const localTracksRef = useRef<{ videoTrack: ICameraVideoTrack | null; audioTrack: IMicrophoneAudioTrack | null }>({
    videoTrack: null,
    audioTrack: null
  });
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    startPreview();
    return () => {
      stopTracks();
      if (agoraClientRef.current) {
        agoraClientRef.current.leave();
      }
    };
  }, []);

  const stopTracks = () => {
    if (localTracksRef.current.videoTrack) {
      localTracksRef.current.videoTrack.stop();
      localTracksRef.current.videoTrack.close();
      localTracksRef.current.videoTrack = null;
    }
    if (localTracksRef.current.audioTrack) {
      localTracksRef.current.audioTrack.stop();
      localTracksRef.current.audioTrack.close();
      localTracksRef.current.audioTrack = null;
    }
  };

  const startPreview = async () => {
    try {
      stopTracks();
      const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
        {},
        { facingMode: isFrontCamera ? 'user' : 'environment' }
      );
      localTracksRef.current = { videoTrack, audioTrack };
      if (videoRef.current) {
        videoTrack.play(videoRef.current);
      }
    } catch (err) {
      console.error('Preview Error:', err);
      setError('Camera/Mic access denied.');
    }
  };

  const toggleCamera = async () => {
    const nextMode = !isFrontCamera;
    setIsFrontCamera(nextMode);
    if (isLive && localTracksRef.current.videoTrack) {
      try {
        await localTracksRef.current.videoTrack.setDevice(nextMode ? 'user' : 'environment' as any);
      } catch (err) {
        console.error('Toggle Camera Error:', err);
        // Fallback: recreate tracks
        startPreview();
      }
    } else {
      startPreview();
    }
  };

  const startLive = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Get Agora Token from Server
      const channelName = `live_${currentUser.id.substring(0, 8)}_${Date.now()}`;
      const response = await fetch('/api/live/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelName, uid: 0 })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Failed to get streaming token');
      }
      const data = await response.json();

      // 2. Initialize Agora Client
      const client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
      agoraClientRef.current = client;
      client.setClientRole('host');

      await client.join(AGORA_APP_ID, data.channelName, data.token, data.uid);
      
      if (localTracksRef.current.audioTrack && localTracksRef.current.videoTrack) {
        await client.publish([localTracksRef.current.audioTrack, localTracksRef.current.videoTrack]);
      }

      // 3. Insert into live_streams table
      const { data: dbStream, error: dbErr } = await supabase.from('live_streams').insert({
        user_id: currentUser.id,
        channel_name: data.channelName,
        token: data.token,
        is_live: true
      }).select().single();

      if (dbErr) throw dbErr;

      setStreamData({ id: dbStream.id, channelName: data.channelName, token: data.token, uid: data.uid });
      setIsLive(true);
      
      // Update profile
      await supabase.from('profiles').update({ is_live: true, live_channel_name: data.channelName }).eq('id', currentUser.id);

    } catch (err: any) {
      setError(err.message);
      console.error('Start Live Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const endLive = async () => {
    if (!streamData) return;
    try {
      await supabase.from('live_streams').update({ is_live: false }).eq('id', streamData.id);
      await supabase.from('profiles').update({ is_live: false, live_channel_name: null }).eq('id', currentUser.id);
      
      if (agoraClientRef.current) {
        await agoraClientRef.current.leave();
      }
      stopTracks();
      
      setIsLive(false);
      onClose();
    } catch (err) {
      console.error('End Live Error:', err);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !streamData) return;
    
    const text = newMessage.trim();
    setNewMessage('');

    try {
      await supabase.from('live_messages').insert({
        stream_id: streamData.id,
        user_id: currentUser.id,
        text: text
      });
    } catch (err) {
      console.error('Send Message Error:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-black flex flex-col animate-vix-in overflow-hidden font-sans">
      {/* Video Preview / Stream */}
      <div className="flex-1 relative bg-zinc-900">
        <div 
          ref={videoRef} 
          className={`w-full h-full object-cover ${isFrontCamera ? 'scale-x-[-1]' : ''}`}
        />

        {/* Top Overlay */}
        <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start z-50">
          <div className="flex flex-col gap-2">
            {isLive ? (
              <div className="flex items-center gap-2 bg-black/30 backdrop-blur-md p-1 pr-3 rounded-full border border-white/10">
                <div className="w-8 h-8 rounded-full border-2 border-red-500 p-0.5">
                  <img src={currentUser.avatar_url || `https://ui-avatars.com/api/?name=${currentUser.username}`} className="w-full h-full rounded-full object-cover" />
                </div>
                <div className="flex flex-col">
                  <p className="font-bold text-white text-[10px] leading-tight">@{currentUser.username}</p>
                  <div className="flex items-center gap-1">
                    <Users className="w-2.5 h-2.5 text-white/80" />
                    <span className="text-[9px] font-bold text-white/80">{formatNumber(viewerCount)}</span>
                  </div>
                </div>
                <div className="ml-2 bg-red-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full animate-pulse">
                  LIVE
                </div>
              </div>
            ) : (
              <div className="bg-black/30 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">Preview Mode</span>
              </div>
            )}
          </div>

          <button onClick={isLive ? endLive : onClose} className="p-2 bg-black/30 hover:bg-black/50 rounded-full text-white backdrop-blur-md border border-white/10">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Right Actions */}
        <div className="absolute right-4 bottom-32 flex flex-col items-center gap-6 z-40">
          <button onClick={toggleCamera} className="flex flex-col items-center gap-1 group">
            <div className="w-12 h-12 rounded-full bg-black/30 backdrop-blur-md border border-white/10 flex items-center justify-center group-hover:bg-black/50 transition-all">
              <RefreshCw className="w-6 h-6 text-white" />
            </div>
            <span className="text-[10px] font-black text-white drop-shadow-md">Flip</span>
          </button>

          <button className="flex flex-col items-center gap-1 group">
            <div className="w-12 h-12 rounded-full bg-black/30 backdrop-blur-md border border-white/10 flex items-center justify-center group-hover:bg-black/50 transition-all">
              <Sparkles className="w-6 h-6 text-pink-400" />
            </div>
            <span className="text-[10px] font-black text-white drop-shadow-md">Effects</span>
          </button>

          <button className="flex flex-col items-center gap-1 group">
            <div className="w-12 h-12 rounded-full bg-black/30 backdrop-blur-md border border-white/10 flex items-center justify-center group-hover:bg-black/50 transition-all">
              <Wand2 className="w-6 h-6 text-white" />
            </div>
            <span className="text-[10px] font-black text-white drop-shadow-md">Beauty</span>
          </button>
        </div>

        {/* Chat Overlay */}
        {isLive && (
          <div className="absolute bottom-24 left-4 right-20 z-30 pointer-events-none">
            <div className="max-h-[30vh] overflow-y-auto no-scrollbar space-y-1.5 pointer-events-auto flex flex-col justify-end">
              {messages.map((msg) => (
                <div key={msg.id} className="flex items-start gap-2 animate-vix-in">
                  <div className="bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/5 flex flex-col shadow-lg">
                    <span className="font-black text-yellow-400 text-[10px] uppercase tracking-tight mb-0.5">@{msg.username}</span>
                    <span className="text-white text-[13px] font-medium leading-tight">{msg.text}</span>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          </div>
        )}

        {/* Floating Hearts */}
        <div className="absolute bottom-24 right-6 w-20 h-80 pointer-events-none overflow-hidden z-50">
          {hearts.map(heart => (
            <div 
              key={heart.id}
              className="absolute bottom-0 text-pink-500 animate-vix-float-up"
              style={{ left: `${heart.x}%` }}
            >
              <Heart className="w-7 h-7 fill-current drop-shadow-lg" />
            </div>
          ))}
        </div>

        {/* Start Button Overlay */}
        {!isLive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm z-20">
            <button 
              onClick={startLive}
              disabled={loading}
              className="px-12 py-4 bg-pink-500 text-white rounded-full font-black text-lg uppercase tracking-[0.2em] shadow-2xl hover:bg-pink-600 transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : t('Go Live')}
            </button>
          </div>
        )}
      </div>

      {/* Footer Controls */}
      <div className="p-4 bg-black z-50">
        {isLive ? (
          <div className="flex items-center gap-3">
            <form onSubmit={sendMessage} className="flex-1 bg-white/10 backdrop-blur-xl rounded-full border border-white/10 flex items-center px-4 py-2.5">
              <input 
                type="text" 
                placeholder={t('Add comment...')} 
                className="w-full bg-transparent border-none outline-none text-white text-[13px] font-bold placeholder:text-white/40"
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
              />
            </form>
            <button onClick={endLive} className="px-6 py-2.5 bg-red-500 text-white rounded-full font-black text-[11px] uppercase tracking-widest shadow-lg">
              {t('End Live')}
            </button>
          </div>
        ) : (
          <div className="flex justify-center">
            <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.3em]">{t('Ready to broadcast?')}</p>
          </div>
        )}
      </div>

      {error && (
        <div className="absolute top-24 left-6 right-6 bg-red-500/90 backdrop-blur-md p-4 rounded-2xl text-white text-[11px] font-black uppercase tracking-widest text-center z-[3000]">
          {error}
        </div>
      )}
    </div>
  );
};

export default LiveBroadcast;
