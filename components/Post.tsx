
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
  }, [post.id, post.boosted_likes]);

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
      if (!liked) handleLike();
      setShowHeartOverlay(true);
      setTimeout(() => setShowHeartOverlay(false), 800);
    }
    lastTap.current = now;
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    const { data } = await supabase
      .from('comments')
      .insert({ post_id: post.id, user_id: currentUserId, content: newComment })
      .select('*, user:profiles(*)').single();
    if (data) {
      setComments([data as any, ...comments]);
      setNewComment('');
    }
  };

  const handleDelete = async () => {
    if (window.confirm("Delete this post?")) {
      const { error } = await supabase.from('posts').delete().eq('id', post.id);
      if (!error && onDelete) onDelete(post.id);
    }
  };

  return (
    <div className="mb-10 w-full max-w-[470px] mx-auto bg-black border border-zinc-900 rounded-2xl overflow-hidden animate-vix-in">
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full vix-gradient p-[1.5px]">
            <img 
              src={post.user.avatar_url || `https://ui-avatars.com/api/?name=${post.user.username}`} 
              className="w-full h-full rounded-full object-cover bg-black" 
            />
          </div>
          <div className="flex items-center">
            <span className="font-bold text-sm text-white flex items-center">
              {post.user.username} {post.user.is_verified && <VerificationBadge />}
            </span>
          </div>
        </div>
        {post.user.id === currentUserId && (
          <button onClick={handleDelete} className="p-2 text-zinc-600 hover:text-red-500">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="relative aspect-square w-full bg-zinc-950 flex items-center justify-center overflow-hidden cursor-pointer" onClick={handleDoubleTap}>
        {post.media_type === 'video' ? (
          <video src={post.media_url} loop muted autoPlay playsInline className="w-full h-full object-cover" />
        ) : (
          <img src={post.media_url} className="w-full h-full object-cover" alt="VixReel" />
        )}
        {showHeartOverlay && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <Heart className="w-24 h-24 text-white fill-white animate-heart-beat" />
          </div>
        )}
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-center gap-4">
          <Heart onClick={handleLike} className={`w-6 h-6 cursor-pointer ${liked ? 'fill-[#ff0080] text-[#ff0080]' : 'text-zinc-200'}`} />
          <MessageCircle onClick={() => setShowComments(!showComments)} className="w-6 h-6 cursor-pointer text-zinc-200" />
          <Send className="w-6 h-6 cursor-pointer text-zinc-200" />
        </div>
        <div>
          <div className="font-extrabold text-sm text-white mb-1">{formatNumber(likesCount)} likes</div>
          <div className="text-sm text-zinc-300">
            <span className="font-bold mr-2 text-white">{post.user.username}</span>
            {post.caption}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Post;
