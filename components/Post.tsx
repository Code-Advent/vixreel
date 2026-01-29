
import React, { useState, useEffect, useRef } from 'react';
import { Heart, MessageCircle, Send, Bookmark, Trash2, X } from 'lucide-react';
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
  const [showHeartOverlay, setShowHeartOverlay] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<CommentType[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);
  const lastTap = useRef<number>(0);

  useEffect(() => {
    checkLikeStatus();
    fetchLikesCount();
    if (showComments) fetchComments();
  }, [post.id, post.boosted_likes, showComments]);

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
      await supabase.from('likes').insert({ post_id: post.id, user_id: currentUserId });
      setLiked(true);
      setLikesCount(prev => prev + 1);
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
    <div className="mb-10 w-full max-w-[470px] mx-auto bg-black border border-zinc-900 rounded-lg overflow-hidden animate-vix-in">
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
            <MessageCircle onClick={() => setShowComments(true)} className="w-7 h-7 cursor-pointer text-white hover:text-zinc-400" />
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
          {comments.length > 0 && (
            <button onClick={() => setShowComments(true)} className="text-zinc-500 text-xs mt-1 hover:underline">
              View all {comments.length} comments
            </button>
          )}
        </div>
      </div>

      {/* Comments Modal */}
      {showComments && (
        <div className="fixed inset-0 z-[1000] bg-black/90 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg h-[80vh] flex flex-col overflow-hidden animate-in zoom-in duration-300">
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-black">
              <h3 className="font-bold text-sm">Comments</h3>
              <button onClick={() => setShowComments(false)} className="p-1"><X className="w-5 h-5 text-zinc-500" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
              {comments.map(c => (
                <div key={c.id} className="flex gap-3">
                  <img src={c.user.avatar_url || `https://ui-avatars.com/api/?name=${c.user.username}`} className="w-8 h-8 rounded-full h-fit" />
                  <div className="text-sm">
                    <span className="font-bold text-white mr-2 flex items-center">
                      {c.user.username} {c.user.is_verified && <VerificationBadge size="w-3 h-3" />}
                    </span>
                    <p className="text-zinc-300 mt-0.5">{c.content}</p>
                    <div className="text-[10px] text-zinc-600 mt-1">{new Date(c.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}
              {comments.length === 0 && <div className="text-center py-20 text-zinc-600 text-sm">No comments yet. Be the first!</div>}
            </div>
            <form onSubmit={handlePostComment} className="p-4 border-t border-zinc-800 bg-black flex gap-3">
              <input 
                value={newComment} 
                onChange={e => setNewComment(e.target.value)}
                placeholder="Add a comment..." 
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-sm outline-none focus:border-zinc-700"
              />
              <button disabled={!newComment.trim() || isCommenting} className="text-pink-500 font-bold text-sm disabled:opacity-50">Post</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Post;
