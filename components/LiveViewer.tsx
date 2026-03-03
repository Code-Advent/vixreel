import React, { useState, useRef, useEffect } from 'react';
import Hls from 'hls.js';
import { 
  X, Users, Send, Heart, Share2, Loader2, Signal, 
  Gift, Trophy, ShoppingBag, Music, Smile, Eye, Plus,
  MessageCircle
} from 'lucide-react';
import { UserProfile, LiveStream } from '../types';
import { supabase } from '../lib/supabase';
import { useTranslation } from '../lib/translation';
import { formatNumber } from '../lib/utils';

interface LiveViewerProps {
  stream: LiveStream;
  currentUser: UserProfile;
  onClose: () => void;
}

const LiveViewer: React.FC<LiveViewerProps> = ({ stream, currentUser, onClose }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [viewerCount, setViewerCount] = useState(stream.viewer_count || 0);
  const [isLiked, setIsLiked] = useState(false);
  const [hearts, setHearts] = useState<{ id: number; x: number }[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
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
    if (videoRef.current && stream.playback_id) {
      if (stream.playback_id === 'mock_playback') {
        setLoading(false);
        return;
      }
      const video = videoRef.current;
      const src = `https://stream.mux.com/${stream.playback_id}.m3u8`;

      if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(src);
        hls.attachMedia(video);
        hlsRef.current = hls;
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(e => console.error('Play Error:', e));
          setLoading(false);
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = src;
        video.addEventListener('loadedmetadata', () => {
          video.play().catch(e => console.error('Play Error:', e));
          setLoading(false);
        });
      }
    }

    incrementViewerCount();
    checkFollowing();

    if (stream.id) {
      fetchMessages();
      
      const channel = supabase
        .channel(`live-messages-${stream.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'live_messages',
          filter: `stream_id=eq.${stream.id}`
        }, (payload) => {
          fetchNewMessage(payload.new.id);
        })
        .subscribe();

      return () => {
        if (hlsRef.current) hlsRef.current.destroy();
        decrementViewerCount();
        supabase.removeChannel(channel);
      };
    }

    return () => {
      if (hlsRef.current) hlsRef.current.destroy();
      decrementViewerCount();
    };
  }, [stream.playback_id, stream.id]);

  const checkFollowing = async () => {
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
    const { error } = await supabase.from('follows').insert({
      follower_id: currentUser.id,
      following_id: stream.user_id
    });
    if (!error) setIsFollowing(true);
  };

  const fetchMessages = async () => {
    if (!stream.id) return;
    const { data } = await supabase
      .from('live_messages')
      .select('*, user:profiles(*)')
      .eq('stream_id', stream.id)
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

  const incrementViewerCount = async () => {
    if (!stream.id || !currentUser.id) return;
    try {
      await supabase.from('live_viewers').upsert({
        stream_id: stream.id,
        user_id: currentUser.id
      });
      
      setMessages(prev => [...prev, {
        id: `system-${Date.now()}`,
        username: 'SYSTEM',
        text: `@${currentUser.username} joined`,
        created_at: new Date().toISOString()
      }]);
      
      const { data: countData } = await supabase
        .from('live_viewers')
        .select('*', { count: 'exact', head: true })
        .eq('stream_id', stream.id);
      
      if (countData !== null) {
        await supabase.from('live_streams').update({ viewer_count: countData }).eq('id', stream.id);
        setViewerCount(countData);
      }
    } catch (err) {
      console.error('Increment Viewer Error:', err);
    }
  };

  const decrementViewerCount = async () => {
    if (!stream.id || !currentUser.id) return;
    try {
      await supabase.from('live_viewers').delete().match({
        stream_id: stream.id,
        user_id: currentUser.id
      });
      
      const { data: countData } = await supabase
        .from('live_viewers')
        .select('*', { count: 'exact', head: true })
        .eq('stream_id', stream.id);
      
      if (countData !== null) {
        await supabase.from('live_streams').update({ viewer_count: countData }).eq('id', stream.id);
        setViewerCount(countData);
      }
    } catch (err) {
      console.error('Decrement Viewer Error:', err);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !stream.id) return;
    
    const text = newMessage.trim();
    setNewMessage('');

    try {
      const { error } = await supabase.from('live_messages').insert({
        stream_id: stream.id,
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
              <img src={stream.user?.avatar_url || `https://ui-avatars.com/api/?name=${stream.user?.username}`} className="w-full h-full rounded-full object-cover" />
            </div>
            <div>
              <p className="font-black text-white text-[10px] leading-tight truncate max-w-[80px]">@{stream.user?.username}</p>
              <div className="flex items-center gap-1">
                <Eye className="w-2.5 h-2.5 text-white/60" />
                <span className="text-[9px] font-black text-white/60 uppercase tracking-widest">{formatNumber(viewerCount)}</span>
              </div>
            </div>
            {!isFollowing && stream.user_id !== currentUser.id && (
              <button 
                onClick={handleFollow}
                className="ml-2 bg-pink-500 text-white text-[9px] font-black px-3 py-1 rounded-full hover:bg-pink-600 transition-colors"
              >
                {t('Follow')}
              </button>
            )}
          </div>
          
          <div className="hidden sm:flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
            <Trophy className="w-3 h-3 text-yellow-500" />
            <span className="text-[9px] font-black text-white uppercase tracking-widest">#1 Ranking</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="w-7 h-7 rounded-full border-2 border-white/20 overflow-hidden bg-zinc-800">
                <img src={`https://picsum.photos/seed/viewer${i}/100/100`} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
          <button onClick={onClose} className="p-2 bg-black/40 hover:bg-black/60 rounded-full text-white transition-all backdrop-blur-md border border-white/10">
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Video Player */}
      <div className="flex-1 relative overflow-hidden bg-zinc-900">
        <video 
          ref={videoRef} 
          playsInline 
          className="w-full h-full object-cover"
        />
        
        {stream.playback_id === 'mock_playback' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900">
            <div className="w-24 h-24 rounded-full bg-pink-500/10 flex items-center justify-center mb-6 animate-pulse">
              <Signal className="w-12 h-12 text-pink-500" />
            </div>
            <h2 className="text-white font-black text-xl uppercase tracking-widest">{t('LIVE STREAM')}</h2>
            <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.3em] mt-2">{t('Connecting to Broadcast...')}</p>
          </div>
        )}
        
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
            <Loader2 className="w-12 h-12 text-pink-500 animate-spin mb-4" />
            <p className="text-white/60 text-[10px] font-black uppercase tracking-[0.3em]">Synchronizing...</p>
          </div>
        )}

        {/* Right Side Actions */}
        <div className="absolute right-4 bottom-32 flex flex-col items-center gap-5 z-40">
          <div className="relative mb-2">
            <div className="w-11 h-11 rounded-full border-2 border-white p-0.5 bg-zinc-800">
              <img src={stream.user?.avatar_url || `https://ui-avatars.com/api/?name=${stream.user?.username}`} className="w-full h-full rounded-full object-cover" />
            </div>
            {!isFollowing && stream.user_id !== currentUser.id && (
              <button 
                onClick={handleFollow}
                className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-pink-500 text-white rounded-full p-0.5 border-2 border-white"
              >
                <Plus className="w-3 h-3" />
              </button>
            )}
          </div>

          <button 
            onClick={() => {
              setIsLiked(true);
              addHeart();
              setTimeout(() => setIsLiked(false), 200);
            }}
            className="flex flex-col items-center gap-1 group"
          >
            <div className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${isLiked ? 'bg-pink-500 scale-125' : 'bg-black/40 backdrop-blur-md border border-white/10 group-hover:bg-black/60'}`}>
              <Heart className={`w-6 h-6 text-white ${isLiked ? 'fill-current' : ''}`} />
            </div>
            <span className="text-[10px] font-black text-white drop-shadow-md">12.3K</span>
          </button>

          <button className="flex flex-col items-center gap-1 group">
            <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center group-hover:bg-black/60 transition-all">
              <Gift className="w-6 h-6 text-white" />
            </div>
            <span className="text-[10px] font-black text-white drop-shadow-md">1,250</span>
          </button>

          <button className="flex flex-col items-center gap-1 group">
            <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center group-hover:bg-black/60 transition-all">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <span className="text-[10px] font-black text-white drop-shadow-md">13</span>
          </button>

          <button className="flex flex-col items-center gap-1 group">
            <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center group-hover:bg-black/60 transition-all">
              <ShoppingBag className="w-6 h-6 text-white" />
            </div>
          </button>

          <button className="flex flex-col items-center gap-1 group">
            <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center group-hover:bg-black/60 transition-all animate-spin-slow">
              <Music className="w-6 h-6 text-white" />
            </div>
          </button>
        </div>

        {/* Chat Overlay (Bottom Left) */}
        <div className="absolute bottom-32 left-4 right-20 z-30 pointer-events-none">
          <div className="max-h-72 overflow-y-auto no-scrollbar space-y-2 pointer-events-auto mask-fade-top">
            {messages.map((msg) => (
              <div key={msg.id} className="flex items-start gap-2 animate-vix-in">
                {msg.username === 'SYSTEM' ? (
                  <div className="bg-black/20 backdrop-blur-sm px-3 py-1 rounded-full">
                    <span className="text-pink-400 text-[10px] font-black uppercase tracking-widest italic">{msg.text}</span>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 max-w-[90%]">
                    <img src={msg.avatar_url || `https://ui-avatars.com/api/?name=${msg.username}`} className="w-6 h-6 rounded-full border border-white/10 mt-0.5" />
                    <div className="bg-black/30 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/5">
                      <span className="font-black text-white/60 text-[10px] uppercase tracking-widest mr-2">@{msg.username}</span>
                      <span className="text-white text-xs font-medium leading-relaxed">{msg.text}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        </div>

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

      {/* Footer Controls */}
      <div className="p-4 bg-gradient-to-t from-black to-transparent z-50">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 bg-white/10 backdrop-blur-xl rounded-full border border-white/10 flex items-center px-4 py-2">
            <Smile className="w-5 h-5 text-white/60 mr-3 cursor-pointer hover:text-white transition-colors" />
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
          
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-xl px-4 py-2 rounded-full border border-white/10">
            <div className="flex flex-col items-center">
              <span className="text-[8px] font-black text-white/40 uppercase tracking-widest">GOAL</span>
              <div className="w-12 h-1 bg-white/20 rounded-full mt-0.5 overflow-hidden">
                <div className="w-2/3 h-full bg-pink-500" />
              </div>
            </div>
          </div>

          <button 
            onClick={sendMessage}
            className="w-10 h-10 bg-pink-500 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-pink-600 transition-all active:scale-90"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        <div className="flex justify-between items-center px-2">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
              <Signal className="w-3 h-3 text-emerald-500" />
              <span className="text-[8px] font-black text-white/40 uppercase tracking-widest">Stable Signal</span>
            </div>
          </div>
          
          <div className="px-4 py-2 bg-white/5 rounded-full border border-white/5 backdrop-blur-md">
            <p className="text-white/20 text-[8px] font-black uppercase tracking-[0.2em]">VixReel Live Protocol v2.1</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveViewer;
