import React, { useState, useRef, useEffect } from 'react';
import { 
  X, Loader2, RefreshCw, Sparkles, Wand2,
  Users, Send, Heart, Camera, StopCircle, Share2,
  MessageCircle, Smile
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
  const [streamTitle, setStreamTitle] = useState(`${currentUser.username}'s Epic Stream`);
  const [category, setCategory] = useState('Just Chatting');
  
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

  useEffect(() => {
    if (streamData?.id) {
      const channel = supabase
        .channel(`live-broadcast-${streamData.id}`)
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'live_streams',
          filter: `id=eq.${streamData.id}` 
        }, (payload: any) => {
          if (payload.new) {
            setViewerCount(payload.new.viewer_count || 0);
          }
        })
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'live_messages',
          filter: `stream_id=eq.${streamData.id}`
        }, async (payload) => {
          const { data } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', payload.new.user_id)
            .single();
          
          setMessages(prev => [...prev, {
            id: payload.new.id,
            username: data?.username || 'User',
            text: payload.new.text,
            created_at: payload.new.created_at
          }]);
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [streamData?.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

      await client.join(data.appId || AGORA_APP_ID, data.channelName, data.token, data.uid);
      
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
    <div className="fixed inset-0 z-[2000] bg-[#0e0e10] flex flex-col md:flex-row animate-vix-in overflow-hidden font-sans text-[#efeff1]">
      {/* Main Content Area (Video + Info) */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Top Bar */}
        <div className="h-12 bg-[#18181b] border-b border-[#26262c] flex items-center justify-between px-4 z-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-zinc-800 border border-[#323239]">
              <img src={currentUser.avatar_url || `https://ui-avatars.com/api/?name=${currentUser.username}`} className="w-full h-full object-cover" />
            </div>
            <span className="font-bold text-sm">@{currentUser.username}</span>
            {isLive && (
              <div className="flex items-center gap-2 ml-2">
                <span className="bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">Live</span>
                <span className="text-red-500 text-xs font-medium flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {formatNumber(viewerCount)}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleCamera} className="p-2 hover:bg-[#26262c] rounded-md transition-colors text-zinc-400 hover:text-white">
              <RefreshCw className="w-5 h-5" />
            </button>
            <button onClick={isLive ? endLive : onClose} className="p-2 hover:bg-[#26262c] rounded-md transition-colors text-zinc-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Video Area */}
        <div className="flex-1 relative bg-black group">
          <div 
            ref={videoRef} 
            className={`w-full h-full ${isFrontCamera ? 'scale-x-[-1]' : ''}`}
          />
          
          {!isLive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-20 p-6">
              <div className="w-full max-w-md bg-[#18181b] p-6 rounded-lg border border-[#26262c] shadow-2xl">
                <h2 className="text-xl font-bold mb-4">Stream Manager</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-1.5">Stream Title</label>
                    <input 
                      type="text" 
                      value={streamTitle}
                      onChange={e => setStreamTitle(e.target.value)}
                      className="w-full bg-[#0e0e10] border border-[#323239] rounded px-3 py-2 text-sm focus:border-purple-500 outline-none transition-all"
                      placeholder="Enter stream title..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-1.5">Category</label>
                    <select 
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      className="w-full bg-[#0e0e10] border border-[#323239] rounded px-3 py-2 text-sm focus:border-purple-500 outline-none transition-all"
                    >
                      <option>Just Chatting</option>
                      <option>Gaming</option>
                      <option>Music</option>
                      <option>Talk Shows</option>
                      <option>Creative</option>
                    </select>
                  </div>
                  <button 
                    onClick={startLive}
                    disabled={loading}
                    className="w-full py-2.5 bg-[#9147ff] hover:bg-[#772ce8] text-white rounded font-bold text-sm transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Start Streaming'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute bottom-4 left-4 right-4 bg-red-600/90 text-white p-3 rounded border border-red-500 flex items-center gap-3 z-[100] animate-vix-in">
              <div className="bg-white/20 p-1.5 rounded">
                <X className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Stream Error</p>
                <p className="text-xs font-bold">{error}</p>
              </div>
              <button onClick={() => setError(null)} className="text-white/60 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Bottom Info Bar */}
        <div className="bg-[#18181b] p-4 border-t border-[#26262c]">
          <div className="flex items-start justify-between">
            <div className="flex gap-4">
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-purple-500 p-0.5">
                <img src={currentUser.avatar_url || `https://ui-avatars.com/api/?name=${currentUser.username}`} className="w-full h-full object-cover rounded-full" />
              </div>
              <div>
                <h1 className="text-lg font-bold leading-tight">{streamTitle}</h1>
                <p className="text-purple-400 text-sm font-medium hover:underline cursor-pointer">@{currentUser.username}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="bg-[#26262c] text-zinc-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">{category}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 bg-[#26262c] hover:bg-[#323239] rounded text-white transition-colors">
                <Share2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar (Chat) */}
      <div className="w-full md:w-80 bg-[#18181b] border-l border-[#26262c] flex flex-col">
        <div className="h-12 flex items-center justify-center border-b border-[#26262c]">
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Stream Chat</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-2">
              <MessageCircle className="w-8 h-8 opacity-20" />
              <p className="text-[10px] font-bold uppercase tracking-tighter">Welcome to the chat!</p>
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className="text-sm leading-relaxed animate-vix-in">
              <span className="font-bold text-purple-400 mr-2">@{msg.username}:</span>
              <span className="text-[#efeff1]">{msg.text}</span>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        <div className="p-4 border-t border-[#26262c]">
          <form onSubmit={sendMessage} className="relative">
            <input 
              type="text" 
              placeholder="Send a message" 
              className="w-full bg-[#26262c] border-2 border-transparent focus:border-purple-500 rounded-md px-3 py-2 text-sm outline-none transition-all placeholder:text-zinc-500"
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              disabled={!isLive}
            />
            <button 
              type="submit"
              disabled={!isLive || !newMessage.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-purple-500 hover:text-purple-400 disabled:opacity-30"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <div className="flex items-center justify-between mt-2 px-1">
            <div className="flex items-center gap-2">
              <Smile className="w-4 h-4 text-zinc-500 hover:text-white cursor-pointer" />
            </div>
            <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Twitch Style</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveBroadcast;
