
import React, { useState, useEffect, useRef } from 'react';
import { Heart, MessageCircle, Send, Bookmark, Trash2 } from 'lucide-react';
import { Post as PostType } from '../types';
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
  const [showHeartOverlay, setShowHeartOverlay] = useState(false);
  const lastTap = useRef<number>(0);

  useEffect(() => {
    checkLikeStatus();
    fetchLikesCount();
  }, [post.id, post.boosted_likes]);

  const checkLikeStatus = async () => {
    const { data } = await supabase
      .from('likes')
      .select('id')
      .eq('post_id', post.id)
      .eq('user_id', currentUserId)
      .single();
    setLiked(!!data);
  };

  const fetchLikesCount = async () => {
    const { count } = await supabase
      .from('likes')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', post.id);
    setLikesCount((count || 0) + (post.boosted_likes || 0));
  };

  const handleLike = async () => {
    if (liked) {
      const { error } = await supabase.from('likes').delete().eq('post_id', post.id).eq('user_id', currentUserId);
      if (!error) {
        setLiked(false);
        setLikesCount(prev => Math.max(0, prev - 1));
      }
    } else {
      const { error } = await supabase.from('likes').insert({ post_id: post.id, user_id: currentUserId });
      if (!error) {
        setLiked(true);
        setLikesCount(prev => prev + 1);
      }
    }
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
    <div className="mb-8 w-full max-w-[470px] mx-auto bg-black border border-zinc-900 rounded-lg overflow-hidden animate-vix-in">
      {/* Header */}
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full vix-gradient p-[1.5px]">
            <img 
              src={post.user.avatar_url || `https://ui-avatars.com/api/?name=${post.user.username}`} 
              className="w-full h-full rounded-full object-cover bg-black" 
              alt={post.user.username}
            />
          </div>
          <div className="flex items-center font-bold text-sm text-white">
            {post.user.username}
            {post.user.is_verified && <VerificationBadge size="w-3.5 h-3.5" />}
          </div>
        </div>
        {post.user.id === currentUserId && (
          <button onClick={() => onDelete?.(post.id)} className="p-1 text-zinc-500 hover:text-red-500">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Media */}
      <div className="relative aspect-square w-full bg-zinc-950 flex items-center justify-center overflow-hidden cursor-pointer" onClick={handleDoubleTap}>
        {post.media_type === 'video' ? (
          <video src={post.media_url} loop muted autoPlay playsInline className="w-full h-full object-cover" />
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
      <div className="p-3 pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Heart 
              onClick={handleLike} 
              className={`w-7 h-7 cursor-pointer transition-transform active:scale-125 ${liked ? 'fill-[#ff0080] text-[#ff0080]' : 'text-white'}`} 
            />
            <MessageCircle className="w-7 h-7 cursor-pointer text-white" />
            <Send className="w-7 h-7 cursor-pointer text-white" />
          </div>
          <Bookmark className="w-7 h-7 text-white cursor-pointer" />
        </div>

        <div className="px-1">
          <div className="font-bold text-sm text-white mb-1">{formatNumber(likesCount)} likes</div>
          <div className="text-sm text-zinc-200">
            <span className="font-bold mr-2 text-white inline-flex items-center">
              {post.user.username}
              {post.user.is_verified && <VerificationBadge size="w-3 h-3" />}
            </span>
            {post.caption}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Post;
