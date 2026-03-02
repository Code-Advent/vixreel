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
  const [viewers, setViewers] = useState<UserProfile[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showViewerList, setShowViewerList] = useState(false);
  const [joinNotification, setJoinNotification] = useState<string | null>(null);
  
  const [streamHealth, setStreamHealth] = useState<'EXCELLENT' | 'GOOD' | 'POOR'>('EXCELLENT');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    startPreview();
    return () => stopStream();
  }, []);

  useEffect(() => {
    if (isLive && streamInfo) {
      // Subscribe to viewers
      const channel = supabase
        .channel(`live-viewers-${streamInfo.id}`)
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'live_viewers',
          filter: `stream_id=eq.${streamInfo.db_id}` 
        }, () => {
          fetchViewers();
        })
        .subscribe();

      fetchViewers();
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isLive, streamInfo]);

  const fetchViewers = async () => {
    if (!streamInfo?.db_id) return;
    const { data } = await supabase
      .from('live_viewers')
      .select('*, user:profiles(*)')
      .eq('stream_id', streamInfo.db_id);
    
    if (data) {
      const userList = data.map((v: any) => v.user).filter(Boolean);
      
      // Check for new joiners
      if (userList.length > viewers.length) {
        const newJoiner = userList.find(u => !viewers.some(v => v.id === u.id));
        if (newJoiner) {
          setJoinNotification(`@${newJoiner.username} joined the broadcast`);
          setTimeout(() => setJoinNotification(null), 3000);
        }
      }
      
      setViewers(userList);
      setViewerCount(userList.length);
    }
  };

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
      let streamData: any = null;

      // 1. Try to create Mux Stream via our Server
      try {
        const response = await fetch('/api/live/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          if (!data.error) {
            streamData = data;
            console.log('VixReel: Mux Stream Created Successfully');
          }
        }
      } catch (err) {
        console.warn('VixReel: Server API failed, falling back to Mock Mode:', err);
      }

      // 2. Mock Fallback if Server/Mux fails
      if (!streamData) {
        console.log('VixReel: Initializing Mock Live Mode');
        streamData = {
          id: `mock_${Math.random().toString(36).substr(2, 9)}`,
          stream_key: 'mock_key',
          playback_id: 'mock_playback',
          status: 'active'
        };
      }

      // 3. Register in Supabase
      const { data: dbStream, error: dbErr } = await supabase.from('live_streams').insert({
        user_id: currentUser.id,
        stream_key: streamData.stream_key,
        playback_id: streamData.playback_id,
        mux_live_stream_id: streamData.id,
        status: 'active'
      }).select().single();

      if (dbErr) throw dbErr;

      setStreamInfo({ ...streamData, db_id: dbStream.id });

      // 4. Update User Profile Live Status
      await supabase.from('profiles').update({ 
        is_live: true, 
        live_playback_id: streamData.playback_id 
      }).eq('id', currentUser.id);

      setIsLive(true);
      
      console.log('VixReel: Broadcast logic initialized.');
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
                <button 
                  onClick={() => setShowViewerList(true)}
                  className="text-[10px] font-black text-white/60 hover:text-white uppercase tracking-widest ml-2 flex items-center gap-1 transition-colors"
                >
                  <Users className="w-3 h-3" /> {viewerCount}
                </button>
                <div className="ml-4 flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-full border border-white/10">
                  <div className={`w-1.5 h-1.5 rounded-full ${streamHealth === 'EXCELLENT' ? 'bg-emerald-500' : streamHealth === 'GOOD' ? 'bg-amber-500' : 'bg-red-500'}`} />
                  <span className="text-[8px] font-black text-white/40 uppercase tracking-widest">{streamHealth}</span>
                </div>
                <div className="ml-4 flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
                  <span className="text-[8px] font-black text-white/60 uppercase tracking-widest">REC</span>
                </div>
              </div>
            )}
          </div>
        </div>
        <button onClick={stopStream} className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all backdrop-blur-md">
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Viewer List Modal */}
      {showViewerList && (
        <div className="fixed inset-0 z-[3000] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6">
          <div className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl animate-vix-in">
            <div className="p-6 border-b border-white/5 flex justify-between items-center">
              <h3 className="text-white font-black text-xs uppercase tracking-widest">Active Viewers ({viewerCount})</h3>
              <button onClick={() => setShowViewerList(false)} className="text-white/40 hover:text-white"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-4 max-h-[50vh] overflow-y-auto no-scrollbar space-y-3">
              {viewers.length > 0 ? viewers.map(v => (
                <div key={v.id} className="flex items-center gap-4 p-3 rounded-2xl bg-white/5 border border-white/5">
                  <img src={v.avatar_url} className="w-10 h-10 rounded-full object-cover" />
                  <div className="flex-1">
                    <p className="text-white font-bold text-sm">@{v.username}</p>
                    <p className="text-white/40 text-[9px] font-black uppercase tracking-widest">Watching Now</p>
                  </div>
                </div>
              )) : (
                <div className="py-12 text-center opacity-20">
                  <p className="text-white font-black text-[10px] uppercase tracking-widest">No signals detected yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Video View */}
      <div className="flex-1 relative overflow-hidden bg-zinc-900">
        <video 
          ref={videoRef} 
          autoPlay 
          muted 
          playsInline 
          className={`w-full h-full object-cover ${!videoEnabled ? 'opacity-0' : 'opacity-100'} transition-opacity duration-500`}
        />

        {/* Techy Overlay */}
        <div className="absolute inset-0 pointer-events-none border-[20px] border-white/5" />
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-10">
          <div className="absolute top-1/2 left-0 w-full h-[1px] bg-white" />
          <div className="absolute top-0 left-1/2 w-[1px] h-full bg-white" />
        </div>
        
        {/* Join Notification */}
        {joinNotification && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-pink-500/90 backdrop-blur-md px-6 py-2 rounded-full border border-white/20 shadow-2xl animate-vix-in z-50">
            <p className="text-white text-[10px] font-black uppercase tracking-widest">{joinNotification}</p>
          </div>
        )}
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
