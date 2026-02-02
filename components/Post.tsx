
import React, { useState, useEffect, useRef } from 'react';
import { Heart, MessageCircle, Download, Bookmark, Trash2, X, Volume2, VolumeX } from 'lucide-react';
import { Post as PostType, Comment as CommentType, UserProfile } from '../types';
import { supabase } from '../lib/supabase';
import { formatNumber } from '../lib/utils';
import VerificationBadge from './VerificationBadge';

interface PostProps {
  post: PostType;
  currentUserId: string;
  onDelete?: (id: string) => void;
  onUpdate?: () => void;
}

const Post: React.FC<PostProps> = ({ post, currentUserId, onDelete, onUpdate }) => {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [likesCount, setLikesCount] = useState((post.likes_count || 0) + (post.boosted_likes || 0));
  const [commentsCount, setCommentsCount] = useState(0);
  const [showHeartOverlay, setShowHeartOverlay] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<CommentType[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showWatermark, setShowWatermark] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  
  const [postUser, setPostUser] = useState<UserProfile>(post.user);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastTap = useRef<number>(0);

  useEffect(() => {
    checkStatus();
    fetchLikesCount();
    fetchCommentsCount();
    if (showComments) fetchComments();
    
    const handleUpdate = (e: any) => {
      if (e.detail.id === post.user.id) {
        setPostUser(prev => ({ ...prev, is_verified: e.detail.is_verified }));
      }
    };
    window.addEventListener('vixreel-user-updated', handleUpdate);
    return () => window.removeEventListener('vixreel-user-updated', handleUpdate);
  }, [post.id, post.boosted_likes, showComments, post.user.id]);

  const checkStatus = async () => {
    const { data: likeData } = await supabase
      .from('likes')
      .select('id')
      .eq('post_id', post.id)
      .eq('user_id', currentUserId)
      .single();
    setLiked(!!likeData);

    const { data: saveData } = await supabase
      .from('saves')
      .select('id')
      .eq('post_id', post.id)
      .eq('user_id', currentUserId)
      .single();
    setSaved(!!saveData);
  };

  const fetchLikesCount = async () => {
    const { count } = await supabase
      .from('likes')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', post.id);
    const total = (count || 0) + (post.boosted_likes || 0);
    setLikesCount(total);
  };

  const fetchCommentsCount = async () => {
    const { count } = await supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', post.id);
    setCommentsCount(count || 0);
  };

  const fetchComments = async () => {
    const { data } = await supabase
      .from('comments')
      .select('*, user:profiles(*)')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true });
    if (data) setComments(data as any);
  };

  const handleLike = async () => {
    if (isLiking) return;
    
    const wasLiked = liked;
    const prevCount = likesCount;

    // Phase 1: Optimistic Update
    setLiked(!wasLiked);
    setLikesCount(prev => wasLiked ? Math.max(0, prev - 1) : prev + 1);
    setIsLiking(true);

    try {
      if (wasLiked) {
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', currentUserId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('likes')
          .insert({ post_id: post.id, user_id: currentUserId });
        if (error) throw error;
      }
      
      // Phase 2: Mandatory Re-fetch after confirmation
      await fetchLikesCount();
    } catch (err) {
      console.error("Engagement Error:", err);
      // Revert if database rejected the action
      setLiked(wasLiked);
      setLikesCount(prevCount);
    } finally {
      setIsLiking(false);
    }
  };

  const handleSave = async () => {
    const wasSaved = saved;
    setSaved(!wasSaved);
    try {
      if (wasSaved) {
        await supabase.from('saves').delete().eq('post_id', post.id).eq('user_id', currentUserId);
      } else {
        await supabase.from('saves').insert({ post_id: post.id, user_id: currentUserId });
      }
    } catch (err) {
      setSaved(wasSaved);
    }
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(post.media_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `VixReel_${postUser.username}_${Date.now()}.${post.media_type === 'video' ? 'mp4' : 'jpg'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Download failed.");
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isCommenting) return;
    setIsCommenting(true);
    const { error } = await supabase.from('comments').insert({
      post_id: post.id,
      user_id: currentUserId,
      content: newComment
    });
    if (!error) {
      setNewComment('');
      fetchComments();
      fetchCommentsCount();
    }
    setIsCommenting(false);
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      if (!liked) handleLike();
      setShowHeartOverlay(true);
      setTimeout(() => setShowHeartOverlay(false), 800);
    }
    lastTap.current = now;
  };

  return (
    <div className="w-full max-w-[470px] mx-auto bg-black border border-zinc-900 rounded-none sm:rounded-lg overflow-hidden animate-vix-in shadow-2xl relative">
      {/* Header */}
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full vix-gradient p-[1.5px]">
            <img 
              src={postUser.avatar_url || `https://ui-avatars.com/api/?name=${postUser.username}`} 
              className="w-full h-full rounded-full object-cover bg-black" 
              alt={postUser.username}
            />
          </div>
          <div className="flex items-center font-bold text-xs sm:text-sm text-white">
            {postUser.username}
            {postUser.is_verified && <VerificationBadge size="w-3.5 h-3.5" />}
          </div>
        </div>
        {postUser.id === currentUserId && (
          <button onClick={() => onDelete?.(post.id)} className="p-1 text-zinc-600 hover:text-red-500 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Media Content */}
      <div className="relative aspect-square w-full bg-zinc-950 flex items-center justify-center overflow-hidden cursor-pointer" onClick={handleDoubleTap}>
        {post.media_type === 'video' ? (
          <>
            <video 
              ref={videoRef}
              src={post.media_url} 
              loop muted={isMuted} autoPlay playsInline 
              className="w-full h-full object-cover" 
              onTimeUpdate={() => {
                if (videoRef.current) {
                   const duration = videoRef.current.duration;
                   const currentTime = videoRef.current.currentTime;
                   const showAt = Math.max(duration - 1.5, duration * 0.9);
                   setShowWatermark(currentTime > showAt);
                }
              }}
            />
            {showWatermark && (
              <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-500 pointer-events-none z-20 backdrop-blur-sm">
                 <div className="w-16 h-16 rounded-[1.5rem] vix-gradient flex items-center justify-center mb-4 shadow-[0_0_50px_rgba(255,0,128,0.3)]">
                    <span className="text-white font-black text-3xl logo-font">V</span>
                 </div>
                 <h1 className="logo-font text-4xl vix-text-gradient tracking-tight">VixReel</h1>
                 <p className="text-[8px] font-black text-zinc-500 uppercase tracking-[0.4em] mt-4">Visual Storytelling</p>
              </div>
            )}
            <button 
              onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }} 
              className="absolute bottom-4 right-4 p-2.5 bg-black/60 rounded-full text-white backdrop-blur-xl border border-white/10 z-10 hover:scale-110 active:scale-95 transition-all"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </>
        ) : (
          <img src={post.media_url} className="w-full h-full object-cover" alt="VixReel content" />
        )}
        
        {showHeartOverlay && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
            <Heart className="w-24 h-24 text-white fill-white animate-heart-beat drop-shadow-[0_0_40px_rgba(255,255,255,0.4)]" />
          </div>
        )}
      </div>

      {/* Interaction Actions */}
      <div className="p-3 pt-4 space-y-2 sm:space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="flex flex-col items-center">
              <Heart 
                onClick={handleLike} 
                className={`w-6 h-6 sm:w-7 sm:h-7 cursor-pointer transition-all duration-300 active:scale-[1.4] ${liked ? 'fill-[#ff0080] text-[#ff0080] drop-shadow-[0_0_10px_rgba(255,0,128,0.4)]' : 'text-white hover:text-zinc-400'}`} 
              />
            </div>
            <div className="flex items-center gap-1.5 cursor-pointer group" onClick={() => setShowComments(true)}>
               <MessageCircle className="w-6 h-6 sm:w-7 sm:h-7 text-white group-hover:text-pink-500 transition-colors" />
               <span className="text-[10px] font-black text-zinc-500 group-hover:text-zinc-400">{formatNumber(commentsCount)}</span>
            </div>
            <Download 
              onClick={handleDownload} 
              className="w-6 h-6 sm:w-7 sm:h-7 cursor-pointer text-white hover:text-pink-500 transition-all hover:scale-110" 
            />
          </div>
          <Bookmark 
            onClick={handleSave} 
            className={`w-6 h-6 sm:w-7 sm:h-7 cursor-pointer transition-all ${saved ? 'fill-white text-white scale-110' : 'text-white hover:text-zinc-400'}`} 
          />
        </div>

        <div className="px-1 pb-2">
          <div className="font-black text-xs sm:text-sm text-white mb-1 transition-all">{formatNumber(likesCount)} <span className="font-medium text-zinc-500 uppercase tracking-tighter text-[10px] ml-0.5">Appreciations</span></div>
          <div className="text-xs sm:text-sm text-zinc-200 leading-tight">
            <span className="font-bold mr-2 text-white inline-flex items-center">
              {postUser.username} 
              {postUser.is_verified && <VerificationBadge size="w-3 h-3" />}
            </span>
            {post.caption}
          </div>
        </div>
      </div>

      {showComments && (
        <div className="fixed inset-0 z-[1000] bg-black/95 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
          <div className="bg-zinc-950 border-t sm:border border-zinc-900 rounded-t-[2.5rem] sm:rounded-3xl w-full max-w-lg h-[85vh] sm:h-[80vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom shadow-[0_-20px_100px_rgba(0,0,0,0.5)]">
            <div className="p-5 border-b border-zinc-900 flex justify-between items-center bg-black/40 backdrop-blur-2xl">
              <div>
                <h3 className="font-black uppercase tracking-[0.25em] text-[10px] text-white">Narrative Terminal</h3>
                <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-[0.2em] mt-0.5">Syncing community feedback...</p>
              </div>
              <button onClick={() => setShowComments(false)} className="p-2.5 bg-zinc-900 rounded-2xl hover:bg-zinc-800 transition-all"><X className="w-5 h-5 text-white" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
              {comments.map(c => (
                <div key={c.id} className="flex gap-4 group">
                  <div className="w-9 h-9 rounded-full vix-gradient p-[1.5px] shrink-0">
                    <img src={c.user.avatar_url || `https://ui-avatars.com/api/?name=${c.user.username}`} className="w-full h-full rounded-full object-cover bg-black" />
                  </div>
                  <div className="text-xs sm:text-sm flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-black text-white text-[11px] uppercase tracking-wider">{c.user.username}</span>
                      <span className="text-[8px] font-bold text-zinc-600">{new Date(c.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-zinc-400 font-medium leading-relaxed bg-zinc-900/40 p-3 rounded-2xl rounded-tl-none border border-zinc-900">
                      {c.content}
                    </p>
                  </div>
                </div>
              ))}
              {comments.length === 0 && (
                <div className="text-center py-20 flex flex-col items-center gap-4">
                  <div className="w-12 h-12 rounded-full border border-dashed border-zinc-800 flex items-center justify-center">
                    <MessageCircle className="w-5 h-5 text-zinc-800" />
                  </div>
                  <p className="text-zinc-800 font-black uppercase tracking-widest text-[9px]">No interactions recorded</p>
                </div>
              )}
            </div>
            <form onSubmit={handlePostComment} className="p-6 border-t border-zinc-900 bg-black flex gap-3">
              <input 
                value={newComment} 
                onChange={e => setNewComment(e.target.value)} 
                placeholder="Share your perspective..." 
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-xs sm:text-sm outline-none text-white focus:border-zinc-700 transition-all placeholder:text-zinc-600" 
              />
              <button disabled={!newComment.trim() || isCommenting} className="vix-gradient px-6 rounded-2xl text-white font-black uppercase tracking-widest text-[10px] shadow-lg disabled:opacity-30 active:scale-95 transition-all">
                {isCommenting ? '...' : 'Send'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Post;
