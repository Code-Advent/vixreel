import React, { useState, useRef, useEffect } from 'react';
import AgoraRTC, { IAgoraRTCClient } from 'agora-rtc-sdk-ng';
import { 
  X, Users, Send, Heart, Share2, Loader2, 
  Gift, Trophy, ShoppingBag, Music, Smile, Eye,
  Plus, MessageCircle
} from 'lucide-react';
import { UserProfile } from '../types';
import { supabase } from '../lib/supabase';
import { useTranslation } from '../lib/translation';
import { formatNumber } from '../lib/utils';

interface LiveViewerProps {
  stream: any;
  currentUser: UserProfile;
  onClose: () => void;
}

const AGORA_APP_ID = import.meta.env.VITE_AGORA_APP_ID || '39f712e5cf114fc084d9265e8987bbe6';

const LiveViewer: React.FC<LiveViewerProps> = ({ stream, currentUser, onClose }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [viewerCount, setViewerCount] = useState(stream.viewer_count || 0);
  const [isLiked, setIsLiked] = useState(false);
  const [hearts, setHearts] = useState<{ id: number; x: number }[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLDivElement>(null);
  const agoraClientRef = useRef<IAgoraRTCClient | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkFollowStatus();
    joinStream();
    initAgora();
    
    const channel = supabase
      .channel(`live-updates-${stream.id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'live_streams',
        filter: `id=eq.${stream.id}` 
      }, (payload: any) => {
        if (payload.new) {
          setViewerCount(payload.new.viewer_count || 0);
          if (payload.new.is_live === false) {
            onClose();
          }
        }
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_messages',
        filter: `stream_id=eq.${stream.id}`
      }, (payload) => {
        fetchNewMessage(payload.new.id);
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_likes',
        filter: `stream_id=eq.${stream.id}`
      }, () => {
        addHeart();
      })
      .subscribe();

    return () => {
      leaveStream();
      supabase.removeChannel(channel);
      if (agoraClientRef.current) {
        agoraClientRef.current.leave();
      }
    };
  }, [stream.id]);

  const initAgora = async () => {
    try {
      const client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
      agoraClientRef.current = client;
      client.setClientRole('audience');

      // Get token for audience
      const response = await fetch('/api/live/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          channelName: stream.channel_name, 
          uid: 0,
          role: 'subscriber'
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Failed to get viewer token');
      }
      const { token, appId } = await response.json();

      client.on('user-published', async (user, mediaType) => {
        await client.subscribe(user, mediaType);
        if (mediaType === 'video') {
          const remoteVideoTrack = user.videoTrack;
          if (videoRef.current && remoteVideoTrack) {
            remoteVideoTrack.play(videoRef.current);
          }
          setLoading(false);
        }
        if (mediaType === 'audio') {
          user.audioTrack?.play();
        }
      });

      await client.join(appId || AGORA_APP_ID, stream.channel_name, token, 0);
    } catch (err: any) {
      console.error('Agora Init Error:', err);
      setError(err.message || 'Failed to connect to stream');
      setLoading(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const checkFollowStatus = async () => {
    const { data } = await supabase
      .from('follows')
      .select('*')
      .eq('follower_id', currentUser.id)
      .eq('following_id', stream.user_id)
      .maybeSingle();
    setIsFollowing(!!data);
  };

  const handleFollow = async () => {
    if (isFollowing) return;
    setIsFollowing(true);
    try {
      await supabase.from('follows').insert({
        follower_id: currentUser.id,
        following_id: stream.user_id
      });
    } catch (err) {
      setIsFollowing(false);
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

  const joinStream = async () => {
    try {
      await supabase.from('live_viewers').upsert({
        stream_id: stream.id,
        user_id: currentUser.id
      });
      await supabase.rpc('increment_live_viewers', { stream_id: stream.id });
      
      // Add join message locally
      setMessages(prev => [...prev, {
        id: `join-${Date.now()}`,
        username: currentUser.username,
        text: 'joined the live stream',
        isSystem: true
      }]);
    } catch (err) {
      console.error('Join Stream Error:', err);
    }
  };

  const leaveStream = async () => {
    try {
      await supabase.from('live_viewers').delete().match({
        stream_id: stream.id,
        user_id: currentUser.id
      });
      await supabase.rpc('decrement_live_viewers', { stream_id: stream.id });
    } catch (err) {
      console.error('Leave Stream Error:', err);
    }
  };

  const handleLike = async () => {
    setIsLiked(true);
    addHeart();
    setTimeout(() => setIsLiked(false), 200);

    try {
      await supabase.from('live_likes').insert({
        stream_id: stream.id,
        user_id: currentUser.id
      });
    } catch (err) {
      console.error('Like Error:', err);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    
    const text = newMessage.trim();
    setNewMessage('');

    try {
      await supabase.from('live_messages').insert({
        stream_id: stream.id,
        user_id: currentUser.id,
        text: text
      });
    } catch (err) {
      console.error('Send Message Error:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-[#0e0e10] flex flex-col md:flex-row animate-vix-in overflow-hidden font-sans text-[#efeff1]">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Top Bar */}
        <div className="h-12 bg-[#18181b] border-b border-[#26262c] flex items-center justify-between px-4 z-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-zinc-800 border border-[#323239]">
              <img src={stream.user?.avatar_url || `https://ui-avatars.com/api/?name=${stream.user?.username}`} className="w-full h-full object-cover" />
            </div>
            <span className="font-bold text-sm">@{stream.user?.username}</span>
            <div className="flex items-center gap-2 ml-2">
              <span className="bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">Live</span>
              <span className="text-red-500 text-xs font-medium flex items-center gap-1">
                <Users className="w-3 h-3" />
                {formatNumber(viewerCount)}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[#26262c] rounded-md transition-colors text-zinc-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Area */}
        <div className="flex-1 relative bg-black group">
          <div 
            ref={videoRef}
            className="w-full h-full"
          />
          
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md z-20">
              <Loader2 className="w-12 h-12 text-purple-500 animate-spin mb-4" />
              <p className="text-white/80 text-[10px] font-black uppercase tracking-[0.4em]">Connecting to stream...</p>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-30 p-6 text-center">
              <div className="bg-red-600/20 p-4 rounded-full mb-4">
                <X className="w-12 h-12 text-red-500" />
              </div>
              <h3 className="text-xl font-bold mb-2">Stream Offline</h3>
              <p className="text-zinc-400 text-sm max-w-xs">{error}</p>
              <button onClick={onClose} className="mt-6 px-6 py-2 bg-[#26262c] hover:bg-[#323239] rounded font-bold text-sm transition-all">
                Go Back
              </button>
            </div>
          )}
        </div>

        {/* Bottom Info Bar */}
        <div className="bg-[#18181b] p-4 border-t border-[#26262c]">
          <div className="flex items-start justify-between">
            <div className="flex gap-4">
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-purple-500 p-0.5">
                <img src={stream.user?.avatar_url || `https://ui-avatars.com/api/?name=${stream.user?.username}`} className="w-full h-full object-cover rounded-full" />
              </div>
              <div>
                <h1 className="text-lg font-bold leading-tight">{stream.title || `${stream.user?.username}'s Stream`}</h1>
                <p className="text-purple-400 text-sm font-medium hover:underline cursor-pointer">@{stream.user?.username}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="bg-[#26262c] text-zinc-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Just Chatting</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={handleFollow}
                disabled={isFollowing || stream.user_id === currentUser.id}
                className={`px-4 py-2 rounded font-bold text-sm transition-all flex items-center gap-2 ${isFollowing ? 'bg-[#26262c] text-zinc-400' : 'bg-[#9147ff] hover:bg-[#772ce8] text-white'}`}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </button>
              <button 
                onClick={handleLike}
                className={`p-2 rounded transition-all ${isLiked ? 'bg-pink-500 text-white' : 'bg-[#26262c] hover:bg-[#323239] text-zinc-400'}`}
              >
                <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
              </button>
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
          {messages.map((msg) => (
            <div key={msg.id} className={`text-sm leading-relaxed animate-vix-in ${msg.isSystem ? 'text-zinc-500 italic' : ''}`}>
              {!msg.isSystem && <span className="font-bold text-purple-400 mr-2">@{msg.username}:</span>}
              <span className={msg.isSystem ? 'text-zinc-500' : 'text-[#efeff1]'}>
                {msg.isSystem && <span className="text-yellow-400 mr-1">@{msg.username}</span>}
                {msg.text}
              </span>
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
            />
            <button 
              type="submit"
              disabled={!newMessage.trim()}
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

export default LiveViewer;
