
import React, { useState, useEffect, useRef } from 'react';
import { Heart, MessageCircle, Download, Bookmark, Trash2, X, Volume2, VolumeX, Loader2, MessageSquareOff, Lock, Repeat2 } from 'lucide-react';
import { Post as PostType, Comment as CommentType, UserProfile } from '../types';
import { supabase } from '../lib/supabase';
import { formatNumber } from '../lib/utils';
import VerificationBadge from './VerificationBadge';
import { downloadVideoWithWatermark } from '../lib/videoProcessing';

interface PostProps {
  post: PostType;
  currentUserId: string;
  onDelete?: (id: string) => void;
  onUpdate?: () => void;
  onSelectUser?: (user: UserProfile) => void;
}

const Post: React.FC<PostProps> = ({ post, currentUserId, onDelete, onUpdate, onSelectUser }) => {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reposted, setReposted] = useState(false);
  const [realLikesCount, setRealLikesCount] = useState(0);
  const [likesOffset, setLikesOffset] = useState(0); 
  const [commentsCount, setCommentsCount] = useState(0);
  const [repostsCount, setRepostsCount] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<CommentType[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [isReposting, setIsReposting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  const canComment = post.user.allow_comments !== false;
  const currentTotalLikes = realLikesCount + (post.boosted_likes || 0) + likesOffset;

  useEffect(() => {
    checkStatus();
    fetchLikesCount();
    fetchCommentsCount();
    fetchRepostsCount();
    if (showComments && canComment) fetchComments();

    const handleEngagement = () => {
      fetchLikesCount();
      fetchRepostsCount();
    };
    window.addEventListener('vixreel-engagement-updated', handleEngagement);
    return () => window.removeEventListener('vixreel-engagement-updated', handleEngagement);
  }, [post.id, showComments, post.boosted_likes]);

  const checkStatus = async () => {
    const { data: likeData } = await supabase.from('likes').select('id').eq('post_id', post.id).eq('user_id', currentUserId).maybeSingle();
    setLiked(!!likeData);
    const { data: saveData } = await supabase.from('saves').select('id').eq('post_id', post.id).eq('user_id', currentUserId).maybeSingle();
    setSaved(!!saveData);
    const { data: repostData } = await supabase.from('posts').select('id').eq('reposted_from_id', post.id).eq('user_id', currentUserId).maybeSingle();
    setReposted(!!repostData);
  };

  const fetchLikesCount = async () => {
    const { count } = await supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', post.id);
    setRealLikesCount(count || 0);
  };

  const fetchCommentsCount = async () => {
    const { count } = await supabase.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', post.id);
    setCommentsCount(count || 0);
  };

  const fetchRepostsCount = async () => {
    const { count } = await supabase.from('posts').select('*', { count: 'exact', head: true }).eq('reposted_from_id', post.id);
    setRepostsCount(count || 0);
  };

  const fetchComments = async () => {
    const { data } = await supabase.from('comments').select('*, user:profiles(*)').eq('post_id', post.id).order('created_at', { ascending: true });
    if (data) setComments(data as any);
  };

  const handleLike = async () => {
    if (isLiking) return;
    const wasLiked = liked;
    setIsLiking(true);
    setLiked(!wasLiked);
    setLikesOffset(prev => wasLiked ? prev - 1 : prev + 1);
    try {
      if (wasLiked) await supabase.from('likes').delete().match({ post_id: post.id, user_id: currentUserId });
      else await supabase.from('likes').insert({ post_id: post.id, user_id: currentUserId });
      window.dispatchEvent(new CustomEvent('vixreel-engagement-updated'));
    } catch (err) {
      setLiked(wasLiked);
      setLikesOffset(prev => wasLiked ? prev + 1 : prev - 1);
    } finally { setIsLiking(false); }
  };

  const handleSave = async () => {
    const wasSaved = saved;
    setSaved(!wasSaved);
    try {
      if (wasSaved) await supabase.from('saves').delete().match({ post_id: post.id, user_id: currentUserId });
      else await supabase.from('saves').insert({ post_id: post.id, user_id: currentUserId });
    } catch (err) { setSaved(wasSaved); }
  };

  const handleDownload = async () => {
    if (post.media_type !== 'video') {
      const a = document.createElement('a');
      a.href = post.media_url;
      a.download = `VixReel_${post.user.username}.jpg`;
      a.click();
      return;
    }
    setIsDownloading(true);
    setDownloadProgress(0);
    try {
      await downloadVideoWithWatermark(post.media_url, post.user.username, (p) => {
        setDownloadProgress(Math.floor(p * 100));
      });
    } catch (err: any) { alert("Download failed: " + err.message); } finally { setIsDownloading(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this post?")) return;
    setIsDeleting(true);
    try {
      const pathParts = post.media_url.split('/public/posts/');
      if (pathParts.length > 1) {
        const mediaPath = pathParts[1];
        await supabase.storage.from('posts').remove([mediaPath]);
      }
      await supabase.from('posts').delete().eq('id', post.id);
      onDelete?.(post.id);
      window.dispatchEvent(new CustomEvent('vixreel-post-deleted', { detail: { id: post.id } }));
    } catch (err: any) { 
      alert("Delete failed: " + err.message); 
      setIsDeleting(false); 
    }
  };

  const handleRepost = async () => {
    if (isReposting || reposted) return;
    setIsReposting(true);
    try {
      const { error } = await supabase.from('posts').insert({
        user_id: currentUserId,
        media_url: post.media_url,
        media_type: post.media_type,
        caption: `Reposted from @${post.user.username}: ${post.caption}`,
        reposted_from_id: post.id
      });
      if (error) throw error;
      setReposted(true);
      setRepostsCount(prev => prev + 1);
      onUpdate?.();
      window.dispatchEvent(new CustomEvent('vixreel-engagement-updated'));
    } catch (err: any) {
      alert("Repost failed: " + err.message);
    } finally {
      setIsReposting(false);
    }
  };

  const renderCaption = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(@\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        const username = part.slice(1);
        return (
          <button
            key={i}
            onClick={async () => {
              const { data } = await supabase.from('profiles').select('*').eq('username', username).maybeSingle();
              if (data && onSelectUser) onSelectUser(data as UserProfile);
            }}
            className="text-blue-500 hover:underline font-bold"
          >
            {part}
          </button>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className={`w-full max-w-[470px] mx-auto border-b border-[var(--vix-border)] pb-8 mb-4 animate-vix-in ${isDeleting ? 'opacity-30 pointer-events-none' : ''}`}>
      {post.reposted_from_id && (
        <div className="flex items-center gap-2 mb-2 px-1">
          <Repeat2 className="w-3 h-3 text-zinc-500" />
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Reposted</span>
        </div>
      )}
      <div className="flex items-center justify-between py-4">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => onSelectUser?.(post.user)}>
          <img src={post.user.avatar_url || `https://ui-avatars.com/api/?name=${post.user.username}`} className="w-10 h-10 rounded-full object-cover border border-[var(--vix-border)] shadow-sm" />
          <div className="flex flex-col">
            <span className="text-sm font-bold flex items-center gap-1 text-[var(--vix-text)]">
              {post.user.username} {post.user.is_verified && <VerificationBadge size="w-3 h-3" />}
              {post.user.is_private && <Lock className="w-3 h-3 text-zinc-600" />}
            </span>
          </div>
        </div>
        {post.user.id === currentUserId && (
          <button onClick={handleDelete} className="text-zinc-500 hover:text-red-500 transition-colors p-2">
            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
        )}
      </div>

      <div className="bg-[var(--vix-card)] aspect-square rounded-3xl overflow-hidden shadow-2xl border border-[var(--vix-border)] relative group">
        {post.media_type === 'video' ? (
          <video ref={videoRef} src={post.media_url} loop muted={isMuted} autoPlay playsInline className="w-full h-full object-cover" />
        ) : (
          <img src={post.media_url} className="w-full h-full object-cover" alt="Post Content" />
        )}
        
        {isDownloading && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center z-50">
            <div className="w-20 h-20 relative mb-4">
               <svg className="w-full h-full transform -rotate-90">
                 <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-zinc-800" />
                 <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="4" fill="transparent" strokeDasharray={226} strokeDashoffset={226 - (226 * downloadProgress) / 100} className="text-pink-500 transition-all duration-300" />
               </svg>
               <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white">{downloadProgress}%</div>
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-pink-500 animate-pulse">Processing Watermark</p>
          </div>
        )}

        <div className="absolute bottom-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {post.media_type === 'video' && (
            <button onClick={() => setIsMuted(!isMuted)} className="p-2 bg-black/60 rounded-full text-white backdrop-blur-md border border-white/5">
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      <div className="py-4 space-y-3">
        <div className="flex justify-between items-center">
          <div className="flex gap-4 items-center">
            <button onClick={handleLike} className={`${liked ? 'text-pink-500' : 'text-zinc-500 hover:text-[var(--vix-text)]'} transition-all`}>
              <Heart className={`w-7 h-7 ${liked ? 'fill-current' : ''}`} />
            </button>
            {canComment ? (
               <button onClick={() => setShowComments(true)} className="text-zinc-500 hover:text-[var(--vix-text)] flex items-center gap-1.5">
                  <MessageCircle className="w-7 h-7" />
                  <span className="text-xs font-bold">{formatNumber(commentsCount)}</span>
               </button>
            ) : (
               <div className="text-zinc-800 flex items-center gap-2" title="Comments Off">
                  <MessageSquareOff className="w-6 h-6" />
               </div>
            )}
            <button onClick={handleDownload} disabled={isDownloading} className="text-zinc-500 hover:text-[var(--vix-text)] transition-all disabled:opacity-30">
              <Download className="w-7 h-7" />
            </button>
            <button 
              onClick={handleRepost} 
              disabled={isReposting || reposted} 
              className={`${reposted ? 'text-green-500' : 'text-zinc-500 hover:text-[var(--vix-text)]'} transition-all flex items-center gap-1.5`}
            >
              {isReposting ? <Loader2 className="w-6 h-6 animate-spin" /> : <Repeat2 className={`w-7 h-7 ${reposted ? 'stroke-[3px]' : ''}`} />}
              <span className="text-xs font-bold">{formatNumber(repostsCount)}</span>
            </button>
          </div>
          <button onClick={handleSave} className={`${saved ? 'text-[var(--vix-text)]' : 'text-zinc-500 hover:text-[var(--vix-text)]'} transition-all`}>
            <Bookmark className={`w-7 h-7 ${saved ? 'fill-current' : ''}`} />
          </button>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-bold text-[var(--vix-text)]">{formatNumber(currentTotalLikes)} likes</p>
          <div className="text-sm text-zinc-500">
            <span className="font-bold text-[var(--vix-text)] mr-2 inline-flex items-center gap-1 cursor-pointer" onClick={() => onSelectUser?.(post.user)}>
              @{post.user.username} {post.user.is_verified && <VerificationBadge size="w-3 h-3" />}
            </span>
            {renderCaption(post.caption)}
          </div>
        </div>
      </div>

      {showComments && canComment && (
        <div className="fixed inset-0 z-[6000] bg-[var(--vix-bg)]/95 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[var(--vix-card)] border border-[var(--vix-border)] h-[80vh] rounded-[2rem] flex flex-col shadow-2xl animate-vix-in">
            <div className="p-6 border-b border-[var(--vix-border)] flex justify-between items-center">
              <h3 className="font-bold text-[var(--vix-text)] uppercase text-xs tracking-widest">Comments</h3>
              <button onClick={() => setShowComments(false)} className="p-2"><X className="w-6 h-6 text-zinc-500" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
              {comments.length > 0 ? comments.map(c => (
                <div key={c.id} className="flex gap-4">
                  <img src={c.user.avatar_url || `https://ui-avatars.com/api/?name=${c.user.username}`} className="w-8 h-8 rounded-full object-cover" />
                  <div className="space-y-1 flex-1">
                    <p className="font-bold text-xs text-[var(--vix-text)] flex items-center gap-1">
                      @{c.user.username} {c.user.is_verified && <VerificationBadge size="w-3 h-3" />}
                    </p>
                    <p className="text-zinc-500 text-sm leading-relaxed">{c.content}</p>
                  </div>
                </div>
              )) : (
                <div className="h-full flex items-center justify-center opacity-20">
                  <span className="text-xs font-black uppercase tracking-widest text-[var(--vix-text)]">No signals detected</span>
                </div>
              )}
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!newComment.trim()) return;
              setIsCommenting(true);
              await supabase.from('comments').insert({ post_id: post.id, user_id: currentUserId, content: newComment });
              setNewComment('');
              fetchComments(); fetchCommentsCount();
              setIsCommenting(false);
            }} className="p-6 border-t border-[var(--vix-border)] flex gap-4">
              <input value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Add a comment..." className="flex-1 bg-[var(--vix-secondary)] rounded-xl px-6 py-3 text-sm outline-none border border-[var(--vix-border)] text-[var(--vix-text)]" />
              <button disabled={isCommenting} className="font-bold text-xs text-pink-500 uppercase tracking-widest">Post</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Post;
