import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, Zap, Loader2, StopCircle, Mic, MicOff, Video, VideoOff, Users, MessageCircle, Send } from 'lucide-react';
import { UserProfile, LiveStream } from '../types';
import { supabase } from '../lib/supabase';
import { useTranslation } from '../lib/translation';

interface LiveBroadcastProps {
  currentUser: UserProfile;
  onClose: () => void;
}

const LiveBroadcast: React.FC<LiveBroadcastProps> = ({ currentUser, onClose }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [streamInfo, setStreamInfo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [viewerCount, setViewerCount] = useState(0);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    startPreview();
    return () => stopStream();
  }, []);

  const startPreview = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Preview Error:', err);
      setError('Camera/Mic access denied.');
    }
  };

  const startLive = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Create Mux Stream via our Server
      const response = await fetch('/api/live/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);

      setStreamInfo(data);

      // 2. Register in Supabase
      const { error: dbErr } = await supabase.from('live_streams').insert({
        user_id: currentUser.id,
        stream_key: data.stream_key,
        playback_id: data.playback_id,
        mux_live_stream_id: data.id,
        status: 'active'
      });

      if (dbErr) throw dbErr;

      // 3. Update User Profile Live Status (if possible)
      await supabase.from('profiles').update({ 
        is_live: true, 
        live_playback_id: data.playback_id 
      }).eq('id', currentUser.id);

      setIsLive(true);
      
      // Note: In a real app, we'd use WebRTC or RTMP to send the stream to Mux.
      // Since this is a browser demo, we'll simulate the broadcast.
      // Real RTMP broadcasting usually requires a server-side relay or a specialized library.
      console.log('VixReel: Broadcast logic initialized. RTMP Endpoint: rtmps://global-live.mux.com:443/app');
      console.log('VixReel: Stream Key:', data.stream_key);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const stopStream = async () => {
    if (streamInfo) {
      await supabase.from('live_streams').delete().eq('mux_live_stream_id', streamInfo.id);
      await supabase.from('profiles').update({ is_live: false, live_playback_id: null }).eq('id', currentUser.id);
      await fetch(`/api/live/${streamInfo.id}`, { method: 'DELETE' });
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setIsLive(false);
    onClose();
  };

  const toggleMic = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicEnabled(audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-black flex flex-col animate-vix-in">
      {/* Header */}
      <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-center z-10 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-pink-500 p-0.5">
            <img src={currentUser.avatar_url} className="w-full h-full rounded-full object-cover" />
          </div>
          <div>
            <p className="font-black text-white text-sm">@{currentUser.username}</p>
            {isLive && (
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">LIVE</span>
                <span className="text-[10px] font-black text-white/60 uppercase tracking-widest ml-2 flex items-center gap-1">
                  <Users className="w-3 h-3" /> {viewerCount}
                </span>
              </div>
            )}
          </div>
        </div>
        <button onClick={stopStream} className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all backdrop-blur-md">
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Main Video View */}
      <div className="flex-1 relative overflow-hidden bg-zinc-900">
        <video 
          ref={videoRef} 
          autoPlay 
          muted 
          playsInline 
          className={`w-full h-full object-cover ${!videoEnabled ? 'opacity-0' : 'opacity-100'} transition-opacity duration-500`}
        />
        {!videoEnabled && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-32 h-32 rounded-full bg-zinc-800 flex items-center justify-center">
              <VideoOff className="w-12 h-12 text-zinc-600" />
            </div>
          </div>
        )}

        {/* Live Overlay UI */}
        {isLive && (
          <div className="absolute bottom-32 left-6 right-6 space-y-4 pointer-events-none">
            <div className="max-h-48 overflow-y-auto no-scrollbar space-y-2 pointer-events-auto">
              {messages.map((msg, i) => (
                <div key={i} className="flex items-start gap-2 animate-vix-in">
                  <span className="font-black text-pink-500 text-xs">@{msg.username}</span>
                  <span className="text-white text-xs bg-black/40 px-3 py-1.5 rounded-2xl backdrop-blur-md">{msg.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Controls Footer */}
      <div className="p-8 bg-gradient-to-t from-black to-transparent flex flex-col items-center gap-6">
        {!isLive ? (
          <div className="w-full max-w-md space-y-6">
            <div className="bg-white/5 border border-white/10 p-6 rounded-[2rem] backdrop-blur-xl text-center">
              <Zap className="w-12 h-12 text-pink-500 mx-auto mb-4 animate-pulse" />
              <h2 className="text-white font-black text-xl uppercase tracking-tight mb-2">Initialize Broadcast</h2>
              <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest leading-relaxed">
                Your signal will be transmitted across the VixReel network. Ensure your visual integrity is maintained.
              </p>
            </div>
            
            <div className="flex justify-center gap-4">
              <button onClick={toggleMic} className={`p-5 rounded-full transition-all ${micEnabled ? 'bg-white/10 text-white' : 'bg-red-500 text-white'}`}>
                {micEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
              </button>
              <button onClick={toggleVideo} className={`p-5 rounded-full transition-all ${videoEnabled ? 'bg-white/10 text-white' : 'bg-red-500 text-white'}`}>
                {videoEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
              </button>
            </div>

            <button 
              onClick={startLive} 
              disabled={loading}
              className="w-full vix-gradient py-6 rounded-[2.5rem] text-white font-black uppercase tracking-[0.3em] text-[12px] shadow-2xl shadow-pink-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'GO LIVE NOW'}
            </button>
          </div>
        ) : (
          <div className="w-full max-w-md flex flex-col gap-6">
            <div className="flex items-center gap-3 bg-white/5 p-2 rounded-full border border-white/10 backdrop-blur-xl">
              <input 
                type="text" 
                placeholder="Broadcast a message..." 
                className="flex-1 bg-transparent border-none outline-none text-white text-xs px-4 font-bold"
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
              />
              <button className="p-3 bg-pink-500 rounded-full text-white">
                <Send className="w-4 h-4" />
              </button>
            </div>

            <div className="flex justify-between items-center">
              <div className="flex gap-4">
                <button onClick={toggleMic} className={`p-4 rounded-full transition-all ${micEnabled ? 'bg-white/10 text-white' : 'bg-red-500 text-white'}`}>
                  {micEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                </button>
                <button onClick={toggleVideo} className={`p-4 rounded-full transition-all ${videoEnabled ? 'bg-white/10 text-white' : 'bg-red-500 text-white'}`}>
                  {videoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                </button>
              </div>
              <button 
                onClick={stopStream}
                className="px-8 py-4 bg-red-500 rounded-full text-white font-black uppercase tracking-widest text-[10px] flex items-center gap-2 shadow-xl shadow-red-500/20"
              >
                <StopCircle className="w-4 h-4" /> END BROADCAST
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="absolute top-24 left-6 right-6 bg-red-500/90 backdrop-blur-md p-4 rounded-2xl text-white text-[10px] font-black uppercase tracking-widest text-center animate-shake">
          {error}
        </div>
      )}
    </div>
  );
};

export default LiveBroadcast;
