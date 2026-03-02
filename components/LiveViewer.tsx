import React, { useState, useRef, useEffect } from 'react';
import Hls from 'hls.js';
import { X, Users, MessageCircle, Send, Heart, Share2, Loader2, Signal } from 'lucide-react';
import { UserProfile, LiveStream } from '../types';
import { supabase } from '../lib/supabase';
import { useTranslation } from '../lib/translation';

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
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

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

    // Increment viewer count
    incrementViewerCount();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
      decrementViewerCount();
    };
  }, [stream.playback_id]);

  const incrementViewerCount = async () => {
    if (!stream.id || !currentUser.id) return;
    try {
      await supabase.from('live_viewers').upsert({
        stream_id: stream.id,
        user_id: currentUser.id
      });
      
      // Send join message to local state
      setMessages(prev => [...prev, {
        username: 'SYSTEM',
        text: `@${currentUser.username} joined`,
        created_at: new Date().toISOString()
      }]);
      
      // Also update the count in live_streams table (could be done via trigger, but let's do it here for simplicity)
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

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    
    const msg = {
      username: currentUser.username,
      text: newMessage.trim(),
      created_at: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, msg]);
    setNewMessage('');
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-black flex flex-col animate-vix-in">
      {/* Header */}
      <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-center z-10 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-pink-500 p-0.5">
            <img src={stream.user?.avatar_url} className="w-full h-full rounded-full object-cover" />
          </div>
          <div>
            <p className="font-black text-white text-sm">@{stream.user?.username}</p>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">LIVE</span>
              <span className="text-[10px] font-black text-white/60 uppercase tracking-widest ml-2 flex items-center gap-1">
                <Users className="w-3 h-3" /> {viewerCount}
              </span>
              <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-full border border-white/10 ml-2">
                <Signal className="w-3 h-3 text-emerald-500" />
                <span className="text-[8px] font-black text-white/40 uppercase tracking-widest">Stable</span>
              </div>
            </div>
          </div>
        </div>
        <button onClick={onClose} className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all backdrop-blur-md">
          <X className="w-6 h-6" />
        </button>
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
            <h2 className="text-white font-black text-xl uppercase tracking-widest">{t('Simulated Signal')}</h2>
            <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.3em] mt-2">{t('Encrypted Peer-to-Peer Connection')}</p>
            <div className="mt-8 flex gap-2">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="w-1 h-8 bg-pink-500/20 rounded-full overflow-hidden">
                  <div className="w-full bg-pink-500 animate-vix-pulse" style={{ height: `${Math.random() * 100}%`, animationDelay: `${i * 0.1}s` }} />
                </div>
              ))}
            </div>
          </div>
        )}
        
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
            <Loader2 className="w-12 h-12 text-pink-500 animate-spin mb-4" />
            <p className="text-white/60 text-[10px] font-black uppercase tracking-[0.3em]">Synchronizing Signal...</p>
          </div>
        )}

        {/* Interaction Overlay */}
        <div className="absolute bottom-32 left-6 right-6 space-y-4 pointer-events-none">
          <div className="max-h-64 overflow-y-auto no-scrollbar space-y-2 pointer-events-auto">
            {messages.map((msg, i) => (
              <div key={i} className="flex items-start gap-2 animate-vix-in">
                {msg.username === 'SYSTEM' ? (
                  <span className="text-pink-500/80 text-[10px] font-black uppercase tracking-widest italic py-1">{msg.text}</span>
                ) : (
                  <>
                    <span className="font-black text-pink-500 text-xs">@{msg.username}</span>
                    <span className="text-white text-xs bg-black/40 px-3 py-1.5 rounded-2xl backdrop-blur-md">{msg.text}</span>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Controls */}
      <div className="p-8 bg-gradient-to-t from-black to-transparent flex flex-col gap-6">
        <form onSubmit={sendMessage} className="flex items-center gap-3 bg-white/5 p-2 rounded-full border border-white/10 backdrop-blur-xl">
          <input 
            type="text" 
            placeholder="Say something nice..." 
            className="flex-1 bg-transparent border-none outline-none text-white text-xs px-4 font-bold"
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
          />
          <button type="submit" className="p-3 bg-pink-500 rounded-full text-white">
            <Send className="w-4 h-4" />
          </button>
        </form>

        <div className="flex justify-between items-center px-2">
          <div className="flex gap-6">
            <button 
              onClick={() => setIsLiked(!isLiked)}
              className={`flex flex-col items-center gap-1 transition-all ${isLiked ? 'text-pink-500' : 'text-white/60 hover:text-white'}`}
            >
              <Heart className={`w-6 h-6 ${isLiked ? 'fill-current' : ''}`} />
              <span className="text-[8px] font-black uppercase tracking-widest">Like</span>
            </button>
            <button className="flex flex-col items-center gap-1 text-white/60 hover:text-white transition-all">
              <Share2 className="w-6 h-6" />
              <span className="text-[8px] font-black uppercase tracking-widest">Share</span>
            </button>
          </div>
          
          <div className="px-4 py-2 bg-white/10 rounded-full border border-white/10 backdrop-blur-md">
            <p className="text-white/40 text-[9px] font-black uppercase tracking-widest">VixReel Live Protocol v1.0</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveViewer;
