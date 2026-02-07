
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
    
    // Optimistic Update
    setLiked(!wasLiked);
    setLikesCount(prev => wasLiked ? Math.max(0, prev - 1) : prev + 1);

    try {
      if (wasLiked) {
        // Unliking: delete record
        const { error } = await supabase.from('likes').delete().match({ post_id: post.id, user_id: currentUserId });
        if (error) throw error;
      } else {
        // Liking: Insert record. UNIQUE constraint in DB handles single-like protection.
        const { error } = await supabase.from('likes').upsert({ post_id: post.id, user_id: currentUserId }, { onConflict: 'post_id,user_id' });
        if (error) throw error;
      }
      // Re-fetch to ensure sync with server state
      await fetchLikesCount();
      // Important: Dispatch event to notify Profile tab to refresh Karma
      window.dispatchEvent(new CustomEvent('vixreel-engagement-updated'));
    } catch (err: any) {
      console.error("Like protocol failure:", err);
      // Revert optimistic update on failure
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
      else await supabase.from('saves').upsert({ post_id: post.id, user_id: currentUserId });
    } catch (err) { setSaved(wasSaved); }
  };

  const handleDelete = async () => {
    if (!window.confirm("Terminate this artifact forever?")) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('posts').delete().eq('id', post.id);
      if (error) throw error;
      if (onDelete) {
        onDelete(post.id);
      } else if (onUpdate) {
        onUpdate();
      }
    } catch (err: any) {
      alert("Termination Failure: " + err.message);
      setIsDeleting(false);
    }
  };

  return (
    <div className={`w-full max-w-[470px] mx-auto border-b border-zinc-900 pb-6 mb-4 animate-vix-in ${isDeleting ? 'opacity-30 pointer-events-none' : ''}`}>
      <div className="flex items-center justify-between py-3 px-2 sm:px-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 p-0.5 overflow-hidden">
            <img src={post.user.avatar_url || `https://ui-avatars.com/api/?name=${post.user.username}`} className="w-full h-full rounded-full object-cover" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-black flex items-center gap-1">
              {post.user.username} {post.user.is_verified && <VerificationBadge size="w-3 h-3" />}
            </span>
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Sponsored Artist</span>
          </div>
        </div>
        {post.user.id === currentUserId && (
          <button onClick={handleDelete} className="text-zinc-600 hover:text-red-500 transition-colors p-2">
            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
        )}
      </div>

      <div className="bg-zinc-950 relative aspect-square rounded-[2rem] overflow-hidden group shadow-2xl border border-zinc-900/50">
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
          <button onClick={() => setIsMuted(!isMuted)} className="absolute bottom-4 right-4 p-2 bg-black/40 rounded-full text-white backdrop-blur-md z-10 hover:bg-black/60 transition-all">
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        )}
      </div>

      <div className="py-4 space-y-3 px-2">
        <div className="flex justify-between items-center">
          <div className="flex gap-4 items-center">
            <button onClick={handleLike} disabled={isLiking} className={`transition-all active:scale-125 ${liked ? 'text-pink-500' : 'text-zinc-400 hover:text-white'}`}>
              <Heart className={`w-6 h-6 ${liked ? 'fill-current' : ''}`} />
            </button>
            <button onClick={() => setShowComments(true)} className="text-zinc-400 hover:text-white flex items-center gap-1.5 active:scale-110">
              <MessageCircle className="w-6 h-6" />
              <span className="text-xs font-black">{formatNumber(commentsCount)}</span>
            </button>
            <button className="text-zinc-400 hover:text-white active:scale-110"><Download className="w-6 h-6" /></button>
          </div>
          <button onClick={handleSave} className={`transition-all active:scale-125 ${saved ? 'text-white' : 'text-zinc-400 hover:text-white'}`}>
            <Bookmark className={`w-6 h-6 ${saved ? 'fill-current' : ''}`} />
          </button>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-black text-white">{formatNumber(likesCount)} Appreciations</p>
          <div className="text-xs leading-relaxed font-medium text-zinc-300">
            <span className="font-black text-white mr-2 inline-flex items-center gap-1">
              @{post.user.username} {post.user.is_verified && <VerificationBadge size="w-3 h-3" />}
            </span>
            {post.caption}
          </div>
        </div>
      </div>

      {showComments && (
        <div className="fixed inset-0 z-[2000] bg-black/90 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-zinc-950 border border-zinc-900 h-[70vh] rounded-[2.5rem] flex flex-col shadow-2xl overflow-hidden animate-vix-in">
            <div className="p-6 border-b border-zinc-900 flex justify-between items-center">
              <h3 className="font-black uppercase text-[10px] tracking-widest text-zinc-500">Narrative Feedback</h3>
              <button onClick={() => setShowComments(false)}><X className="w-6 h-6 text-zinc-600" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
              {comments.length > 0 ? comments.map(c => (
                <div key={c.id} className="flex gap-3">
                  <img src={c.user.avatar_url || `https://ui-avatars.com/api/?name=${c.user.username}`} className="w-8 h-8 rounded-full bg-zinc-800 object-cover" />
                  <div className="space-y-1">
                    <p className="font-black text-[10px] text-white flex items-center gap-1">
                      @{c.user.username} {c.user.is_verified && <VerificationBadge size="w-2.5 h-2.5" />}
                    </p>
                    <p className="text-zinc-400 text-xs">{c.content}</p>
                  </div>
                </div>
              )) : (
                <div className="h-full flex items-center justify-center text-[10px] font-black uppercase text-zinc-800 tracking-widest">No Feedback Logged</div>
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
            }} className="p-4 border-t border-zinc-900 bg-black flex gap-3">
              <input value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Add a comment..." className="flex-1 bg-zinc-900 rounded-xl px-4 py-3 text-xs outline-none focus:border-zinc-700 border border-transparent transition-all text-white" />
              <button disabled={isCommenting} className="font-black text-[10px] uppercase text-pink-500 px-4 disabled:opacity-20 active:scale-95 transition-all">Post</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Post;
