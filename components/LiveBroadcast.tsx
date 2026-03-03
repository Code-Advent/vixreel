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
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

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
          event: '*', 
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

      return () => {
        supabase.removeChannel(msgChannel);
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
      
      if (userList.length > viewers.length) {
        const newJoiner = userList.find(u => !viewers.some(v => v.id === u.id));
        if (newJoiner && newJoiner.id !== currentUser.id) {
          setJoinNotification(`@${newJoiner.username} joined`);
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
    <div className="fixed inset-0 z-[2000] bg-black flex flex-col animate-vix-in overflow-hidden">
      {/* Top Bar */}
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-center z-50">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md p-1 pr-4 rounded-full border border-white/10">
            <div className="w-8 h-8 rounded-full border-2 border-pink-500 p-0.5">
              <img src={currentUser.avatar_url || `https://ui-avatars.com/api/?name=${currentUser.username}`} className="w-full h-full rounded-full object-cover" />
            </div>
            <div>
              <p className="font-black text-white text-[10px] leading-tight truncate max-w-[80px]">@{currentUser.username}</p>
              <div className="flex items-center gap-1">
                <Eye className="w-2.5 h-2.5 text-white/60" />
                <span className="text-[9px] font-black text-white/60 uppercase tracking-widest">{formatNumber(viewerCount)}</span>
              </div>
            </div>
            {isLive && (
              <div className="ml-2 bg-pink-500 px-2 py-0.5 rounded-full">
                <span className="text-[8px] font-black text-white uppercase tracking-widest">LIVE</span>
              </div>
            )}
          </div>
          
          {isLive && (
            <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
              <div className={`w-1.5 h-1.5 rounded-full ${streamHealth === 'EXCELLENT' ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`} />
              <span className="text-[8px] font-black text-white/40 uppercase tracking-widest">{streamHealth}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button onClick={stopStream} className="p-2 bg-black/40 hover:bg-black/60 rounded-full text-white transition-all backdrop-blur-md border border-white/10">
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
          className={`w-full h-full object-cover ${!videoEnabled ? 'opacity-0' : 'opacity-100'} transition-opacity duration-500`}
        />

        {/* Right Side Actions */}
        <div className="absolute right-4 bottom-32 flex flex-col items-center gap-5 z-40">
          <button className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-black/60 transition-all">
            <RefreshCw className="w-6 h-6 text-white" />
          </button>
          
          <button className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-black/60 transition-all">
            <Sparkles className="w-6 h-6 text-white" />
          </button>

          <button className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-black/60 transition-all">
            <Wand2 className="w-6 h-6 text-white" />
          </button>

          <button 
            onClick={toggleScreenShare}
            className={`w-11 h-11 rounded-full backdrop-blur-md border border-white/10 flex items-center justify-center transition-all ${isScreenSharing ? 'bg-blue-500' : 'bg-black/40 hover:bg-black/60'}`}
          >
            {isScreenSharing ? <MonitorOff className="w-6 h-6 text-white" /> : <Monitor className="w-6 h-6 text-white" />}
          </button>

          <button className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-black/60 transition-all">
            <Settings className="w-6 h-6 text-white" />
          </button>
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

        {/* Chat Overlay (Bottom Left) */}
        {isLive && (
          <div className="absolute bottom-32 left-4 right-20 z-30 pointer-events-none">
            <div className="max-h-72 overflow-y-auto no-scrollbar space-y-2 pointer-events-auto mask-fade-top">
              {messages.map((msg) => (
                <div key={msg.id} className="flex items-start gap-2 animate-vix-in">
                  <div className="flex items-start gap-2 max-w-[90%]">
                    <img src={msg.avatar_url || `https://ui-avatars.com/api/?name=${msg.username}`} className="w-6 h-6 rounded-full border border-white/10 mt-0.5" />
                    <div className="bg-black/30 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/5">
                      <span className="font-black text-white/60 text-[10px] uppercase tracking-widest mr-2">@{msg.username}</span>
                      <span className="text-white text-xs font-medium leading-relaxed">{msg.text}</span>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          </div>
        )}

        {/* Floating Hearts Container */}
        <div className="absolute bottom-32 right-6 w-16 h-64 pointer-events-none overflow-hidden z-50">
          {hearts.map(heart => (
            <div 
              key={heart.id}
              className="absolute bottom-0 text-pink-500 animate-vix-float-up"
              style={{ left: `${heart.x}%` }}
            >
              <Heart className="w-6 h-6 fill-current" />
            </div>
          ))}
        </div>
      </div>

      {/* Controls Footer */}
      <div className="p-4 bg-gradient-to-t from-black to-transparent z-50">
        {!isLive ? (
          <div className="w-full max-w-md mx-auto space-y-6">
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
          <div className="w-full max-w-md mx-auto flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-white/10 backdrop-blur-xl rounded-full border border-white/10 flex items-center px-4 py-2">
                <form onSubmit={sendMessage} className="flex-1">
                  <input 
                    type="text" 
                    placeholder={t('Say something...')} 
                    className="w-full bg-transparent border-none outline-none text-white text-xs font-bold placeholder:text-white/40"
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                  />
                </form>
              </div>
              
              <button 
                onClick={stopStream}
                className="px-6 py-3 bg-red-500 rounded-full text-white font-black uppercase tracking-widest text-[9px] flex items-center gap-2 shadow-xl shadow-red-500/20"
              >
                <StopCircle className="w-4 h-4" /> END
              </button>
            </div>

            <div className="flex justify-between items-center px-2">
              <div className="flex gap-4">
                <button onClick={toggleMic} className={`p-3 rounded-full transition-all ${micEnabled ? 'bg-white/10 text-white' : 'bg-red-500 text-white'}`}>
                  {micEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                </button>
                <button onClick={toggleVideo} className={`p-3 rounded-full transition-all ${videoEnabled ? 'bg-white/10 text-white' : 'bg-red-500 text-white'}`}>
                  {videoEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                </button>
              </div>
              
              <div className="px-4 py-2 bg-white/5 rounded-full border border-white/5 backdrop-blur-md">
                <p className="text-white/20 text-[8px] font-black uppercase tracking-[0.2em]">VixReel Live Protocol v2.1</p>
              </div>
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
