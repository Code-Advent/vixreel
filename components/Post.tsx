
import React, { useState, useEffect, useRef } from 'react';
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, Trash2 } from 'lucide-react';
import { Post as PostType, Comment as CommentType } from '../types';
import { supabase } from '../lib/supabase';
import { formatNumber } from '../lib/utils';
import VerificationBadge from './VerificationBadge';

interface PostProps {
  post: PostType;
  currentUserId: string;
  onDelete?: (id: string) => void;
}

const Post: React.FC<PostProps> = ({ post, currentUserId, onDelete }) => {
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState((post.likes_count || 0) + (post.boosted_likes || 0));
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<CommentType[]>([]);
  const [newComment, setNewComment] = useState('');
  const [showHeartOverlay, setShowHeartOverlay] = useState(false);
  const lastTap = useRef<number>(0);

  useEffect(() => {
    checkLike();
    fetchCounts();
  }, [post.id]);

  const checkLike = async () => {
    const { data } = await supabase
      .from('likes')
      .select('id')
      .eq('post_id', post.id)
      .eq('user_id', currentUserId)
      .single();
    if (data) setLiked(true);
  };

  const fetchCounts = async () => {
    const { count: lCount } = await supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', post.id);
    setLikesCount((lCount || 0) + (post.boosted_likes || 0));
  };

  const handleLike = async () => {
    if (liked) {
      await supabase.from('likes').delete().eq('post_id', post.id).eq('user_id', currentUserId);
      setLiked(false);
      setLikesCount(prev => Math.max(0, prev - 1));
    } else {
      await supabase.from('likes').insert({ post_id: post.id, user_id: currentUserId });
      setLiked(true);
      setLikesCount(prev => prev + 1);
    }
  };

  const handleDoubleTap = (e: React.MouseEvent | React.TouchEvent) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    if (now - lastTap.current < DOUBLE_TAP_DELAY) {
      if (!liked) {
        handleLike();
      }
      setShowHeartOverlay(true);
      setTimeout(() => setShowHeartOverlay(false), 800);
    }
    lastTap.current = now;
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    const { data, error } = await supabase
      .from('comments')
      .insert({ post_id: post.id, user_id: currentUserId, content: newComment })
      .select('*, user:profiles(*)').single();
    if (data) {
      setComments([data as any, ...comments]);
      setNewComment('');
    }
  };

  const handleDelete = async () => {
    if (window.confirm("Delete this post permanently from VixReel?")) {
      const { error } = await supabase.from('posts').delete().eq('id', post.id);
      if (!error && onDelete) onDelete(post.id);
    }
  };

  return (
    <div className="mb-10 max-w-[470px] mx-auto bg-black border border-zinc-900 rounded-3xl overflow-hidden shadow-2xl animate-vix-in">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-zinc-950/40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full vix-gradient p-[2px] transition-transform hover:scale-105 cursor-pointer">
            <div className="w-full h-full rounded-full bg-black p-[1px]">
              <img 
                src={post.user.avatar_url || `https://ui-avatars.com/api/?name=${post.user.username}`} 
                className="w-full h-full rounded-full object-cover" 
                alt={post.user.username}
              />
            </div>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center cursor-pointer font-bold text-sm tracking-tight text-zinc-100 hover:text-white transition-colors">
              {post.user.username} {post.user.is_verified && <VerificationBadge size="w-3.5 h-3.5" />}
            </div>
            <span className="text-[10px] text-zinc-500 font-medium tracking-wide">Original Content</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {post.user.id === currentUserId && (
            <button onClick={handleDelete} className="p-2 text-zinc-600 hover:text-red-500 transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button className="p-2 text-zinc-600 hover:text-white transition-colors">
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Media Content */}
      <div 
        className="relative aspect-square w-full bg-zinc-900 overflow-hidden cursor-pointer"
        onClick={handleDoubleTap}
      >
        {post.media_type === 'video' ? (
          <video src={post.media_url} loop muted autoPlay playsInline className="w-full h-full object-cover" />
        ) : (
          <img src={post.media_url} className="w-full h-full object-cover" alt="VixReel Post" />
        )}

        {/* Heart Overlay for Double Tap */}
        {showHeartOverlay && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <Heart className="w-24 h-24 text-white fill-white animate-heart-beat drop-shadow-2xl" />
          </div>
        )}
      </div>

      {/* Interactions */}
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-5">
            <Heart 
              onClick={handleLike}
              className={`w-7 h-7 cursor-pointer transition-all duration-300 transform active:scale-125 ${liked ? 'fill-[#ff0080] text-[#ff0080] drop-shadow-[0_0_8px_rgba(255,0,128,0.5)]' : 'hover:text-zinc-400 text-zinc-200'}`} 
            />
            <MessageCircle onClick={() => setShowComments(!showComments)} className="w-7 h-7 cursor-pointer hover:text-zinc-400 text-zinc-200" />
            <Send className="w-7 h-7 cursor-pointer hover:text-zinc-400 text-zinc-200" />
          </div>
          <Bookmark className="w-7 h-7 cursor-pointer hover:text-zinc-400 text-zinc-200" />
        </div>

        <div>
          <div className="font-extrabold text-sm mb-1 text-zinc-100">{formatNumber(likesCount)} likes</div>
          <div className="text-sm leading-relaxed text-zinc-300">
            <span className="font-bold mr-2 text-white">{post.user.username}</span>
            {post.caption}
          </div>
        </div>

        {/* Mini Comment Section */}
        {showComments && (
          <div className="mt-4 pt-4 border-t border-zinc-900/50 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
             <form onSubmit={handleAddComment} className="flex gap-3 mb-4">
               <input 
                value={newComment} 
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Share your thoughts..." 
                className="flex-1 bg-zinc-950/80 border border-zinc-900 rounded-xl px-4 py-2 outline-none text-xs text-white focus:border-zinc-800 transition-colors"
               />
               <button type="submit" className="vix-text-gradient font-black text-xs uppercase tracking-widest px-2">Post</button>
             </form>
             <div className="text-center text-[10px] text-zinc-600 font-bold uppercase tracking-widest py-2">
               Join the conversation
             </div>
          </div>
        )}

        <div className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
          {new Date(post.created_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
        </div>
      </div>
    </div>
  );
};

export default Post;
