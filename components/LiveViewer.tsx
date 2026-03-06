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
      const response = await fetch(`${window.location.origin}/api/live/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          channelName: stream.playback_id, 
          uid: 0,
          role: 'subscriber'
        })
      });

      if (!response.ok) throw new Error('Failed to get viewer token');
      const { token } = await response.json();

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

      await client.join(AGORA_APP_ID, stream.playback_id, token, 0);
    } catch (err) {
      console.error('Agora Init Error:', err);
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
    <div className="fixed inset-0 z-[2000] bg-black flex flex-col animate-vix-in overflow-hidden font-sans select-none">
      <div className="flex-1 relative bg-zinc-900">
        <div 
          ref={videoRef}
          className="w-full h-full"
        />
        
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md z-20">
            <Loader2 className="w-14 h-14 text-pink-500 animate-spin mb-4" />
            <p className="text-white/80 text-[11px] font-black uppercase tracking-[0.4em]">Connecting...</p>
          </div>
        )}

        {/* Top Bar - Broadcaster Info */}
        <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start z-50 pointer-events-none">
          <div className="flex items-center gap-2 bg-black/30 backdrop-blur-md p-1 pr-3 rounded-full border border-white/10 pointer-events-auto">
            <div className="w-8 h-8 rounded-full border-2 border-red-500 p-0.5 relative">
              <img src={stream.user?.avatar_url || `https://ui-avatars.com/api/?name=${stream.user?.username}`} className="w-full h-full rounded-full object-cover" />
              {!isFollowing && stream.user_id !== currentUser.id && (
                <button 
                  onClick={handleFollow}
                  className="absolute -bottom-1 -right-1 w-4 h-4 bg-pink-500 rounded-full flex items-center justify-center text-white border border-black"
                >
                  <Plus className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
            <div className="flex flex-col">
              <p className="font-bold text-white text-[10px] leading-tight">@{stream.user?.username}</p>
              <div className="flex items-center gap-1">
                <Users className="w-2.5 h-2.5 text-white/80" />
                <span className="text-[9px] font-bold text-white/80">{formatNumber(viewerCount)}</span>
              </div>
            </div>
            <div className="ml-2 bg-red-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full animate-pulse">
              LIVE
            </div>
          </div>

          <button onClick={onClose} className="p-2 bg-black/30 hover:bg-black/50 rounded-full text-white backdrop-blur-md border border-white/10 pointer-events-auto">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Right Actions - Floating Icons */}
        <div className="absolute right-4 bottom-32 flex flex-col items-center gap-6 z-40">
          <button className="flex flex-col items-center gap-1 group">
            <div className="w-11 h-11 rounded-full bg-black/30 backdrop-blur-md border border-white/10 flex items-center justify-center group-hover:bg-black/50 transition-all">
              <Gift className="w-6 h-6 text-pink-400" />
            </div>
            <span className="text-[10px] font-black text-white drop-shadow-md">Gift</span>
          </button>

          <button 
            onClick={handleLike}
            className="flex flex-col items-center gap-1 group"
          >
            <div className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${isLiked ? 'bg-pink-500 scale-125' : 'bg-black/30 backdrop-blur-md border border-white/10 group-hover:bg-black/50'}`}>
              <Heart className={`w-6 h-6 text-white ${isLiked ? 'fill-current' : ''}`} />
            </div>
            <span className="text-[10px] font-black text-white drop-shadow-md">Like</span>
          </button>

          <button className="flex flex-col items-center gap-1 group">
            <div className="w-11 h-11 rounded-full bg-black/30 backdrop-blur-md border border-white/10 flex items-center justify-center group-hover:bg-black/50 transition-all">
              <Share2 className="w-6 h-6 text-white" />
            </div>
            <span className="text-[10px] font-black text-white drop-shadow-md">Share</span>
          </button>
        </div>

        {/* Chat Overlay - TikTok Style */}
        <div className="absolute bottom-24 left-4 right-20 z-30 pointer-events-none">
          <div className="max-h-[35vh] overflow-y-auto no-scrollbar space-y-1.5 pointer-events-auto flex flex-col justify-end">
            {messages.map((msg) => (
              <div key={msg.id} className="flex items-start gap-2 animate-vix-in">
                <div className="bg-black/30 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/5 flex flex-wrap items-center gap-1.5 shadow-lg">
                  {msg.isSystem ? (
                    <span className="text-white/60 text-[12px] font-bold">
                      <span className="text-yellow-400">@{msg.username}</span> {msg.text}
                    </span>
                  ) : (
                    <>
                      <span className="font-black text-yellow-400 text-[11px] uppercase tracking-tight">@{msg.username}</span>
                      <span className="text-white text-[13px] font-medium leading-tight">{msg.text}</span>
                    </>
                  )}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        </div>

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
      </div>

      {/* Footer Controls - TikTok Style */}
      <div className="p-4 bg-black/90 backdrop-blur-xl z-50 border-t border-white/5">
        <div className="flex items-center gap-3">
          <form onSubmit={sendMessage} className="flex-1 bg-white/10 backdrop-blur-xl rounded-full border border-white/10 flex items-center px-4 py-2.5 group focus-within:bg-white/20 transition-all">
            <Smile className="w-5 h-5 text-white/60 mr-3 cursor-pointer hover:text-white transition-colors" />
            <input 
              type="text" 
              placeholder={t('Add comment...')} 
              className="w-full bg-transparent border-none outline-none text-white text-[13px] font-bold placeholder:text-white/40"
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
            />
          </form>
          
          <button 
            onClick={sendMessage}
            className="w-11 h-11 bg-pink-500 rounded-full flex items-center justify-center text-white shadow-xl hover:bg-pink-600 transition-all active:scale-90"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default LiveViewer;
