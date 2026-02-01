
import React, { useState, useEffect, useRef } from 'react';
import { Heart, MessageCircle, Download, Bookmark, Trash2, X, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { Post as PostType, Comment as CommentType } from '../types';
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastTap = useRef<number>(0);

  useEffect(() => {
    checkStatus();
    fetchLikesCount();
    fetchCommentsCount();
    if (showComments) fetchComments();
  }, [post.id, post.boosted_likes, showComments]);

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
    // Local storage hack to help Profile tab sync faster if needed, 
    // but standard state should handle it.
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
    if (liked) {
      await supabase.from('likes').delete().eq('post_id', post.id).eq('user_id', currentUserId);
      setLiked(false);
      setLikesCount(prev => Math.max(0, prev - 1));
    } else {
      // UNIQUE constraint in DB ensures one like per user
      const { error } = await supabase.from('likes').insert({ post_id: post.id, user_id: currentUserId });
      if (!error) {
        setLiked(true);
        setLikesCount(prev => prev + 1);
      }
    }
    onUpdate?.();
  };

  const handleSave = async () => {
    if (saved) {
      await supabase.from('saves').delete().eq('post_id', post.id).eq('user_id', currentUserId);
      setSaved(false);
    } else {
      await supabase.from('saves').insert({ post_id: post.id, user_id: currentUserId });
      setSaved(true);
    }
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(post.media_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `VixReel_${post.user.username}_${post.id}.${post.media_type === 'video' ? 'mp4' : 'jpg'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert("Download failed. Please check your connection.");
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
            <img src={post.user.avatar_url || `https://ui-avatars.com/api/?name=${post.user.username}`} className="w-full h-full rounded-full object-cover bg-black" />
          </div>
          <div className="flex items-center font-bold text-xs sm:text-sm text-white">
            {post.user.username} {post.user.is_verified && <VerificationBadge size="w-3.5 h-3.5" />}
          </div>
        </div>
        {post.user.id === currentUserId && (
          <button onClick={() => onDelete?.(post.id)} className="p-1 text-zinc-600 hover:text-red-500 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Media */}
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
                   const timeLeft = videoRef.current.duration - videoRef.current.currentTime;
                   setShowWatermark(timeLeft < 2);
                }
              }}
            />
            {/* Username Overlay (Persistent) */}
            <div className="absolute top-4 left-4 bg-black/30 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-[10px] font-black uppercase tracking-widest pointer-events-none">
               @{post.user.username}
            </div>
            {/* App Watermark (Ending) */}
            {showWatermark && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center animate-in fade-in duration-500 pointer-events-none">
                 <h1 className="logo-font text-5xl vix-text-gradient">VixReel</h1>
              </div>
            )}
            <button onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }} className="absolute bottom-4 right-4 p-2.5 bg-black/60 rounded-full text-white backdrop-blur-xl border border-white/10">
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </>
        ) : (
          <img src={post.media_url} className="w-full h-full object-cover" alt="VixReel content" />
        )}
        {showHeartOverlay && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <Heart className="w-24 h-24 text-white fill-white animate-heart-beat drop-shadow-2xl" />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-3 pt-4 space-y-2 sm:space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 sm:gap-6">
            <Heart onClick={handleLike} className={`w-6 h-6 sm:w-7 sm:h-7 cursor-pointer transition-transform active:scale-125 ${liked ? 'fill-[#ff0080] text-[#ff0080]' : 'text-white'}`} />
            <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => setShowComments(true)}>
               <MessageCircle className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
               <span className="text-[10px] font-bold text-zinc-500">{formatNumber(commentsCount)}</span>
            </div>
            <Download onClick={handleDownload} className="w-6 h-6 sm:w-7 sm:h-7 cursor-pointer text-white hover:text-pink-500 transition-colors" />
          </div>
          <Bookmark onClick={handleSave} className={`w-6 h-6 sm:w-7 sm:h-7 cursor-pointer transition-colors ${saved ? 'fill-white text-white' : 'text-white'}`} />
        </div>

        <div className="px-1 pb-2">
          <div className="font-bold text-xs sm:text-sm text-white mb-1">{formatNumber(likesCount)} likes</div>
          <div className="text-xs sm:text-sm text-zinc-200 leading-tight">
            <span className="font-bold mr-2 text-white inline-flex items-center">{post.user.username} {post.user.is_verified && <VerificationBadge size="w-3 h-3" />}</span>
            {post.caption}
          </div>
        </div>
      </div>

      {/* Comments Overlay - simplified for brevity */}
      {showComments && (
        <div className="fixed inset-0 z-[1000] bg-black/95 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-zinc-950 border-t sm:border border-zinc-900 rounded-t-[2.5rem] sm:rounded-3xl w-full max-w-lg h-[85vh] sm:h-[80vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom shadow-2xl">
            <div className="p-4 border-b border-zinc-900 flex justify-between items-center bg-black/40 backdrop-blur-2xl">
              <h3 className="font-black uppercase tracking-[0.2em] text-[10px] text-zinc-500">Dialogue</h3>
              <button onClick={() => setShowComments(false)} className="p-2 bg-zinc-900 rounded-full"><X className="w-5 h-5 text-white" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-5 no-scrollbar">
              {comments.map(c => (
                <div key={c.id} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full vix-gradient p-[1px] shrink-0"><img src={c.user.avatar_url || `https://ui-avatars.com/api/?name=${c.user.username}`} className="w-full h-full rounded-full object-cover bg-black" /></div>
                  <div className="text-xs sm:text-sm flex-1"><p className="text-zinc-300"><span className="font-bold text-white mr-2">{c.user.username}</span>{c.content}</p></div>
                </div>
              ))}
            </div>
            <form onSubmit={handlePostComment} className="p-5 border-t border-zinc-900 bg-black flex gap-3">
              <input value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Say something..." className="flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-3.5 text-xs sm:text-sm outline-none" />
              <button disabled={!newComment.trim() || isCommenting} className="text-pink-500 font-black uppercase tracking-widest text-[10px]">{isCommenting ? '...' : 'Echo'}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Post;
