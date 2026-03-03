import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, X, Zap, Loader2, StopCircle, Mic, MicOff, Video, VideoOff, 
  Users, Send, Heart, Monitor, MonitorOff, Gift, Trophy, ShoppingBag, 
  Music, Smile, Eye, Plus, MessageCircle, Settings, Share2, RefreshCw, Sparkles, Wand2
} from 'lucide-react';
import { UserProfile, LiveStream } from '../types';
import { supabase } from '../lib/supabase';
import { useTranslation } from '../lib/translation';
import { formatNumber } from '../lib/utils';

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
  const [hearts, setHearts] = useState<{ id: number; x: number }[]>([]);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const toggleCamera = async () => {
    try {
      const newFacingMode = isFrontCamera ? 'environment' : 'user';
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacingMode },
        audio: true
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      streamRef.current = stream;
      setIsFrontCamera(!isFrontCamera);
    } catch (err) {
      console.error('Toggle Camera Error:', err);
    }
  };

  const addHeart = () => {
    const id = Date.now();
    const x = Math.random() * 100;
    setHearts(prev => [...prev, { id, x }]);
    setTimeout(() => {
      setHearts(prev => prev.filter(h => h.id !== id));
    }, 2000);
  };

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (viewerCount > 0 && Math.random() > 0.7) {
        addHeart();
      }
    }, 500);
    return () => clearInterval(interval);
  }, [viewerCount]);

  useEffect(() => {
    startPreview();
    return () => stopStream();
  }, []);

  useEffect(() => {
    if (isLive && streamInfo) {
      const channel = supabase
        .channel(`live-viewers-${streamInfo.id}`)
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'live_viewers',
          filter: `stream_id=eq.${streamInfo.db_id}` 
        }, async (payload) => {
          const { data: userData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', payload.new.user_id)
            .single();
          
          if (userData && userData.id !== currentUser.id) {
            setJoinNotification(`@${userData.username} joined`);
            setTimeout(() => setJoinNotification(null), 3000);
            
            // Add system message to local chat
            setMessages(prev => [...prev, {
              id: `system-${Date.now()}`,
              username: 'SYSTEM',
              text: `@${userData.username} joined`,
              created_at: new Date().toISOString()
            }]);
          }
          fetchViewers();
        })
        .on('postgres_changes', {
          event: 'DELETE',
          schema: 'public',
          table: 'live_viewers',
          filter: `stream_id=eq.${streamInfo.db_id}`
        }, () => {
          fetchViewers();
        })
        .subscribe();

      fetchViewers();
      fetchMessages();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isLive, streamInfo]);

  useEffect(() => {
    if (isLive && streamInfo) {
      const msgChannel = supabase
        .channel(`live-messages-${streamInfo.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'live_messages',
          filter: `stream_id=eq.${streamInfo.db_id}`
        }, (payload) => {
          fetchNewMessage(payload.new.id);
        })
        .subscribe();

      const likesChannel = supabase
        .channel(`live-likes-${streamInfo.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'live_likes',
          filter: `stream_id=eq.${streamInfo.db_id}`
        }, () => {
          addHeart();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(msgChannel);
        supabase.removeChannel(likesChannel);
      };
    }
  }, [isLive, streamInfo]);

  const fetchMessages = async () => {
    if (!streamInfo?.db_id) return;
    const { data } = await supabase
      .from('live_messages')
      .select('*, user:profiles(*)')
      .eq('stream_id', streamInfo.db_id)
      .order('created_at', { ascending: true })
      .limit(50);
    
    if (data) {
      setMessages(data.map(m => ({
        id: m.id,
        username: m.user?.username || 'Unknown',
        avatar_url: m.user?.avatar_url,
        text: m.text,
        created_at: m.created_at
      })));
    }
  };

  const fetchNewMessage = async (id: string) => {
    const { data } = await supabase
      .from('live_messages')
      .select('*, user:profiles(*)')
      .eq('id', id)
      .single();
    
    if (data) {
      setMessages(prev => [...prev, {
        id: data.id,
        username: data.user?.username || 'Unknown',
        avatar_url: data.user?.avatar_url,
        text: data.text,
        created_at: data.created_at
      }]);
    }
  };

  const fetchViewers = async () => {
    if (!streamInfo?.db_id) return;
    const { data } = await supabase
      .from('live_viewers')
      .select('*, user:profiles(*)')
      .eq('stream_id', streamInfo.db_id);
    
    if (data) {
      const userList = data.map((v: any) => v.user).filter(Boolean);
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
          }
        }
      } catch (err) {
        console.warn('VixReel: Server API failed, falling back to Mock Mode');
      }

      if (!streamData) {
        streamData = {
          id: `mock_${Math.random().toString(36).substr(2, 9)}`,
          stream_key: 'mock_key',
          playback_id: 'mock_playback',
          status: 'active'
        };
      }

      const { data: dbStream, error: dbErr } = await supabase.from('live_streams').insert({
        user_id: currentUser.id,
        stream_key: streamData.stream_key,
        playback_id: streamData.playback_id,
        mux_live_stream_id: streamData.id,
        status: 'active'
      }).select().single();

      if (dbErr) throw dbErr;

      setStreamInfo({ ...streamData, db_id: dbStream.id });

      await supabase.from('profiles').update({ 
        is_live: true, 
        live_playback_id: streamData.playback_id 
      }).eq('id', currentUser.id);

      window.dispatchEvent(new CustomEvent('vixreel-user-updated', { 
        detail: { id: currentUser.id, is_live: true, live_playback_id: streamData.playback_id } 
      }));

      setIsLive(true);
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
      await fetch(`/api/live/${streamInfo.id}`, { method: 'DELETE' }).catch(() => {});
      
      window.dispatchEvent(new CustomEvent('vixreel-user-updated', { 
        detail: { id: currentUser.id, is_live: false, live_playback_id: null } 
      }));
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

  const toggleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        await startPreview();
        setIsScreenSharing(false);
      } else {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
        
        streamRef.current = screenStream;
        if (videoRef.current) {
          videoRef.current.srcObject = screenStream;
        }
        
        screenStream.getVideoTracks()[0].onended = () => {
          toggleScreenShare();
        };
        setIsScreenSharing(true);
      }
    } catch (err) {
      console.error('Screen Share Error:', err);
      setError('Screen share access denied.');
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !streamInfo) return;
    
    const text = newMessage.trim();
    setNewMessage('');

    try {
      const { error } = await supabase.from('live_messages').insert({
        stream_id: streamInfo.db_id,
        user_id: currentUser.id,
        text: text
      });
      if (error) throw error;
    } catch (err) {
      console.error('Send Message Error:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-black flex flex-col animate-vix-in overflow-hidden font-sans">
      {/* Top Bar - TikTok Style */}
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start z-50 pointer-events-none">
        <div className="flex flex-col gap-2 pointer-events-auto">
          {/* Broadcaster Pill */}
          <div className="flex items-center gap-2 bg-black/30 backdrop-blur-md p-1 pr-1 rounded-full border border-white/10">
            <div className="w-9 h-9 rounded-full border-2 border-pink-500 p-0.5">
              <img src={currentUser.avatar_url || `https://ui-avatars.com/api/?name=${currentUser.username}`} className="w-full h-full rounded-full object-cover" />
            </div>
            <div className="flex flex-col">
              <p className="font-bold text-white text-[11px] leading-tight truncate max-w-[70px]">@{currentUser.username}</p>
              <div className="flex items-center gap-1">
                <Users className="w-2.5 h-2.5 text-white/80" />
                <span className="text-[10px] font-bold text-white/80">{formatNumber(viewerCount)}</span>
              </div>
            </div>
            <div className="ml-2 bg-pink-500 text-white text-[10px] font-black px-4 py-2 rounded-full">
              {t('HOST')}
            </div>
          </div>

          {/* Stream Stats Pill */}
          <div className="flex items-center gap-2 bg-black/20 backdrop-blur-sm px-3 py-1 rounded-full w-fit">
            <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            <span className="text-[9px] font-black text-white/90 uppercase tracking-widest">LIVE | {streamHealth === 'EXCELLENT' ? 'EXCELLENT' : 'STABLE'}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 pointer-events-auto">
          {/* Top Viewers */}
          <div className="flex -space-x-2 mr-2">
            {viewers.slice(0, 3).map((v, i) => (
              <div key={v.id || i} className="w-8 h-8 rounded-full border-2 border-white/20 overflow-hidden bg-zinc-800 shadow-lg">
                <img src={v.avatar_url || `https://picsum.photos/seed/viewer${i+20}/100/100`} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
          <button onClick={stopStream} className="p-2.5 bg-red-500 hover:bg-red-600 rounded-full text-white transition-all backdrop-blur-md border border-white/10 shadow-lg">
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Main Video View */}
      <div className="flex-1 relative overflow-hidden bg-zinc-900">
        <video 
          ref={videoRef} 
          autoPlay 
          muted 
          playsInline 
          className={`w-full h-full object-cover ${isFrontCamera ? 'scale-x-[-1]' : ''} ${!videoEnabled ? 'opacity-0' : 'opacity-100'} transition-opacity duration-500`} 
        />
        
        {!isLive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md z-20">
            <div className="w-36 h-36 rounded-full border-4 border-pink-500 p-1.5 mb-8 animate-vix-pulse shadow-2xl">
              <img src={currentUser.avatar_url || `https://ui-avatars.com/api/?name=${currentUser.username}`} className="w-full h-full rounded-full object-cover" />
            </div>
            <button 
              onClick={startLive}
              disabled={loading}
              className="px-12 py-4 bg-pink-500 text-white rounded-full font-black text-lg uppercase tracking-[0.2em] shadow-2xl hover:bg-pink-600 transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : t('Go Live')}
            </button>
            <p className="text-white/40 text-[11px] font-black uppercase tracking-[0.4em] mt-6">{t('VixReel Broadcast Protocol')}</p>
          </div>
        )}

        {/* Right Side Actions - TikTok Style */}
        <div className="absolute right-4 bottom-24 flex flex-col items-center gap-6 z-40">
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
              <Wand2 className="w-6 h-6 text-emerald-400" />
            </div>
            <span className="text-[10px] font-black text-white drop-shadow-md">Beauty</span>
          </button>

          <button onClick={toggleScreenShare} className="flex flex-col items-center gap-1 group">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isScreenSharing ? 'bg-pink-500' : 'bg-black/30 backdrop-blur-md border border-white/10 group-hover:bg-black/50'}`}>
              <Monitor className="w-6 h-6 text-white" />
            </div>
            <span className="text-[10px] font-black text-white drop-shadow-md">Screen</span>
          </button>

          <button className="w-12 h-12 rounded-full bg-black/30 backdrop-blur-md border border-white/10 flex items-center justify-center group-hover:bg-black/50 transition-all">
            <Share2 className="w-6 h-6 text-white" />
          </button>
        </div>

        {/* Chat Overlay - TikTok Style */}
        <div className="absolute bottom-24 left-4 right-20 z-30 pointer-events-none">
          <div className="max-h-[40vh] overflow-y-auto no-scrollbar space-y-2 pointer-events-auto mask-fade-top flex flex-col justify-end">
            {messages.map((msg) => (
              <div key={msg.id} className="flex items-start gap-2 animate-vix-in">
                {msg.username === 'SYSTEM' ? (
                  <div className="bg-white/10 backdrop-blur-sm px-3 py-1 rounded-full border border-white/5 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-pulse" />
                    <span className="text-pink-400 text-[10px] font-black uppercase tracking-widest italic">{msg.text}</span>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 max-w-[90%]">
                    <img src={msg.avatar_url || `https://ui-avatars.com/api/?name=${msg.username}`} className="w-6 h-6 rounded-full border border-white/10 mt-1 shadow-sm" />
                    <div className="bg-black/30 backdrop-blur-md px-3 py-2 rounded-2xl border border-white/5 flex flex-col">
                      <span className="font-black text-pink-400 text-[10px] uppercase tracking-tight mb-0.5">@{msg.username}</span>
                      <span className="text-white text-xs font-medium leading-tight">{msg.text}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Join Notification */}
        {joinNotification && (
          <div className="absolute top-32 left-1/2 -translate-x-1/2 z-50 animate-vix-bounce-in">
            <div className="bg-pink-500/90 backdrop-blur-md px-6 py-2 rounded-full border border-white/20 shadow-2xl flex items-center gap-2">
              <Users className="w-4 h-4 text-white" />
              <span className="text-white font-black text-[11px] uppercase tracking-widest">{joinNotification}</span>
            </div>
          </div>
        )}

        {!videoEnabled && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80 backdrop-blur-sm">
            <div className="w-32 h-32 rounded-full bg-zinc-800 flex items-center justify-center border border-white/10">
              <VideoOff className="w-12 h-12 text-zinc-600" />
            </div>
          </div>
        )}

        {/* Floating Hearts Container */}
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
      </div>

      {/* Footer Controls - TikTok Style */}
      <div className="p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-50">
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-white/10 backdrop-blur-xl rounded-full border border-white/10 flex items-center px-4 py-2.5 group focus-within:bg-white/20 transition-all">
            <Smile className="w-5 h-5 text-white/60 mr-3 cursor-pointer hover:text-white transition-colors" />
            <form onSubmit={sendMessage} className="flex-1">
              <input 
                type="text" 
                placeholder={t('Add comment...')} 
                className="w-full bg-transparent border-none outline-none text-white text-[13px] font-bold placeholder:text-white/40"
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
              />
            </form>
          </div>
          
          <div className="flex gap-2">
            <button onClick={toggleMic} className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${micEnabled ? 'bg-white/10 text-white' : 'bg-red-500 text-white shadow-lg'}`}>
              {micEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>
            <button onClick={toggleVideo} className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${videoEnabled ? 'bg-white/10 text-white' : 'bg-red-500 text-white shadow-lg'}`}>
              {videoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>
            <button 
              onClick={sendMessage}
              className="w-11 h-11 bg-pink-500 rounded-full flex items-center justify-center text-white shadow-xl hover:bg-pink-600 transition-all active:scale-90"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="absolute top-24 left-6 right-6 bg-red-500/90 backdrop-blur-md p-4 rounded-2xl text-white text-[11px] font-black uppercase tracking-widest text-center animate-shake z-[3000]">
          {error}
        </div>
      )}
    </div>
  );
};

export default LiveBroadcast;
