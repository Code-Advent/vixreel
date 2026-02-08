
import React, { useState, useEffect, useRef } from 'react';
import { Heart, MessageCircle, Download, Bookmark, Trash2, X, Volume2, VolumeX, Loader2 } from 'lucide-react';
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
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<CommentType[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    checkStatus();
    fetchLikesCount();
    fetchCommentsCount();
    if (showComments) fetchComments();
  }, [post.id, showComments]);

  const checkStatus = async () => {
    const { data: likeData } = await supabase.from('likes').select('id').eq('post_id', post.id).eq('user_id', currentUserId).maybeSingle();
    setLiked(!!likeData);
    const { data: saveData } = await supabase.from('saves').select('id').eq('post_id', post.id).eq('user_id', currentUserId).maybeSingle();
    setSaved(!!saveData);
  };

  const fetchLikesCount = async () => {
    const { count } = await supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', post.id);
    setLikesCount((count || 0) + (post.boosted_likes || 0));
  };

  const fetchCommentsCount = async () => {
    const { count } = await supabase.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', post.id);
    setCommentsCount(count || 0);
  };

  const fetchComments = async () => {
    const { data } = await supabase.from('comments').select('*, user:profiles(*)').eq('post_id', post.id).order('created_at', { ascending: true });
    if (data) setComments(data as any);
  };

  const handleLike = async () => {
    if (isLiking) return;
    const wasLiked = liked;
    setIsLiking(true);
    
    // Optimistic UI
    setLiked(!wasLiked);
    setLikesCount(prev => wasLiked ? Math.max(0, prev - 1) : prev + 1);

    try {
      if (wasLiked) {
        const { error } = await supabase.from('likes').delete().match({ post_id: post.id, user_id: currentUserId });
        if (error) throw error;
      } else {
        // Use insert instead of upsert to avoid UPDATE policy triggers which often fail with 42501
        const { error } = await supabase.from('likes').insert({ post_id: post.id, user_id: currentUserId });
        if (error) throw error;
      }
      
      fetchLikesCount();
      window.dispatchEvent(new CustomEvent('vixreel-engagement-updated'));
    } catch (err: any) {
      console.error("Engagement Protocol Error:", err);
      // Revert UI on error
      setLiked(wasLiked);
      setLikesCount(prev => wasLiked ? prev + 1 : Math.max(0, prev - 1));
    } finally {
      setIsLiking(false);
    }
  };

  const handleSave = async () => {
    const wasSaved = saved;
    setSaved(!wasSaved);
    try {
      if (wasSaved) await supabase.from('saves').delete().match({ post_id: post.id, user_id: currentUserId });
      else await supabase.from('saves').insert({ post_id: post.id, user_id: currentUserId });
    } catch (err) { setSaved(wasSaved); }
  };

  const handleDelete = async () => {
    if (!window.confirm("Terminate this artifact core?")) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('posts').delete().eq('id', post.id);
      if (error) throw error;
      onDelete?.(post.id);
      onUpdate?.();
    } catch (err: any) {
      alert("Termination Failure: " + err.message);
      setIsDeleting(false);
    }
  };

  return (
    <div className={`w-full max-w-[470px] mx-auto border-b border-zinc-900 pb-6 mb-4 animate-vix-in ${isDeleting ? 'opacity-30 pointer-events-none' : ''}`}>
      <div className="flex items-center justify-between py-3 px-2 sm:px-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 p-0.5 overflow-hidden">
            <img src={post.user.avatar_url || `https://ui-avatars.com/api/?name=${post.user.username}`} className="w-full h-full rounded-full object-cover" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-black flex items-center gap-1.5">
              {post.user.username} {post.user.is_verified && <VerificationBadge size="w-3.5 h-3.5" />}
            </span>
            <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">Active Narrator</span>
          </div>
        </div>
        {post.user.id === currentUserId && (
          <button onClick={handleDelete} className="text-zinc-700 hover:text-red-500 transition-colors p-2">
            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
        )}
      </div>

      <div className="bg-zinc-950 relative aspect-square rounded-[2.5rem] overflow-hidden group shadow-2xl border border-zinc-900/50">
        {post.media_type === 'video' ? (
          <video 
            ref={videoRef}
            src={post.media_url} 
            loop muted={isMuted} autoPlay playsInline 
            className="w-full h-full object-cover"
          />
        ) : (
          <img src={post.media_url} className="w-full h-full object-cover" alt="Artifact" />
        )}

        {post.media_type === 'video' && (
          <button onClick={() => setIsMuted(!isMuted)} className="absolute bottom-6 right-6 p-2.5 bg-black/50 rounded-full text-white backdrop-blur-xl z-10 hover:bg-black/70 transition-all border border-white/5">
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        )}
      </div>

      <div className="py-5 space-y-4 px-2">
        <div className="flex justify-between items-center">
          <div className="flex gap-5 items-center">
            <button onClick={handleLike} disabled={isLiking} className={`transition-all active:scale-125 ${liked ? 'text-pink-500' : 'text-zinc-500 hover:text-white'}`}>
              <Heart className={`w-7 h-7 ${liked ? 'fill-current' : ''}`} />
            </button>
            <button onClick={() => setShowComments(true)} className="text-zinc-500 hover:text-white flex items-center gap-2 active:scale-110">
              <MessageCircle className="w-7 h-7" />
              <span className="text-xs font-black">{formatNumber(commentsCount)}</span>
            </button>
            <button className="text-zinc-500 hover:text-white active:scale-110"><Download className="w-7 h-7" /></button>
          </div>
          <button onClick={handleSave} className={`transition-all active:scale-125 ${saved ? 'text-white' : 'text-zinc-500 hover:text-white'}`}>
            <Bookmark className={`w-7 h-7 ${saved ? 'fill-current' : ''}`} />
          </button>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-black text-white">{formatNumber(likesCount)} Appreciations</p>
          <div className="text-[14px] leading-relaxed font-medium text-zinc-400">
            <span className="font-black text-white mr-2 inline-flex items-center gap-1">
              @{post.user.username} {post.user.is_verified && <VerificationBadge size="w-3.5 h-3.5" />}
            </span>
            {post.caption}
          </div>
        </div>
      </div>

      {showComments && (
        <div className="fixed inset-0 z-[2000] bg-black/95 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-zinc-950 border border-zinc-900 h-[80vh] rounded-[3rem] flex flex-col shadow-2xl overflow-hidden animate-vix-in">
            <div className="p-6 border-b border-zinc-900 flex justify-between items-center bg-zinc-900/10">
              <h3 className="font-black uppercase text-[11px] tracking-[0.4em] text-zinc-500">Narrative Log</h3>
              <button onClick={() => setShowComments(false)} className="hover:rotate-90 transition-transform"><X className="w-6 h-6 text-zinc-600" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar">
              {comments.length > 0 ? comments.map(c => (
                <div key={c.id} className="flex gap-4 group">
                  <img src={c.user.avatar_url || `https://ui-avatars.com/api/?name=${c.user.username}`} className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 object-cover" />
                  <div className="space-y-1.5 flex-1">
                    <p className="font-black text-[12px] text-white flex items-center gap-1.5">
                      @{c.user.username} {c.user.is_verified && <VerificationBadge size="w-3.5 h-3.5" />}
                    </p>
                    <p className="text-zinc-400 text-sm leading-relaxed font-medium">{c.content}</p>
                  </div>
                </div>
              )) : (
                <div className="h-full flex flex-col items-center justify-center gap-4 text-zinc-800">
                  <MessageCircle className="w-12 h-12" />
                  <span className="text-[11px] font-black uppercase tracking-[0.5em]">No Narrative Found</span>
                </div>
              )}
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!newComment.trim()) return;
              setIsCommenting(true);
              await supabase.from('comments').insert({ post_id: post.id, user_id: currentUserId, content: newComment });
              setNewComment('');
              fetchComments();
              fetchCommentsCount();
              setIsCommenting(false);
            }} className="p-6 border-t border-zinc-900 bg-black flex gap-4">
              <input value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Inscribe your thoughts..." className="flex-1 bg-zinc-900/50 rounded-2xl px-6 py-4 text-sm outline-none focus:border-zinc-700 border border-zinc-800/50 transition-all text-white" />
              <button disabled={isCommenting} className="font-black text-[11px] uppercase text-pink-500 px-6 disabled:opacity-20 active:scale-95 transition-all">Share</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Post;
