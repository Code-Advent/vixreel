
import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Heart, MessageCircle, Download, Bookmark, 
  Repeat2, Columns2, Scissors, Volume2, VolumeX, 
  Loader2, MapPin, Smile, MoreHorizontal, ChevronLeft, ChevronRight
} from 'lucide-react';
import { Post as PostType, Comment as CommentType, UserProfile } from '../types';
import { supabase } from '../lib/supabase';
import { formatNumber } from '../lib/utils';
import VerificationBadge from './VerificationBadge';
import { useTranslation } from '../lib/translation';

interface PostDetailProps {
  post: PostType;
  currentUserId: string;
  onClose: () => void;
  onSelectUser: (user: UserProfile) => void;
}

const PostDetail: React.FC<PostDetailProps> = ({ post, currentUserId, onClose, onSelectUser }) => {
  const { t } = useTranslation();
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reposted, setReposted] = useState(false);
  const [comments, setComments] = useState<CommentType[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [commentsCount, setCommentsCount] = useState(0);
  const [showLikeAnim, setShowLikeAnim] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    checkStatus();
    fetchLikesCount();
    fetchCommentsCount();
    fetchComments();
  }, [post.id]);

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
    setLiked(!wasLiked);
    setLikesCount(prev => wasLiked ? prev - 1 : prev + 1);
    try {
      if (wasLiked) await supabase.from('likes').delete().match({ post_id: post.id, user_id: currentUserId });
      else await supabase.from('likes').insert({ post_id: post.id, user_id: currentUserId });
    } catch (err) {
      setLiked(wasLiked);
      setLikesCount(prev => wasLiked ? prev + 1 : prev - 1);
    } finally { setIsLiking(false); }
  };

  const handleDoubleClick = () => {
    if (!liked) handleLike();
    setShowLikeAnim(true);
    setTimeout(() => setShowLikeAnim(false), 1000);
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isCommenting) return;
    setIsCommenting(true);
    try {
      const { data, error } = await supabase.from('comments').insert({
        post_id: post.id,
        user_id: currentUserId,
        content: newComment.trim()
      }).select('*, user:profiles(*)').single();

      if (error) throw error;
      if (data) {
        setComments(prev => [...prev, data as any]);
        setCommentsCount(prev => prev + 1);
        setNewComment('');
      }
    } catch (err) {
      console.error("Comment Error:", err);
    } finally { setIsCommenting(false); }
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-black/95 backdrop-blur-2xl flex items-center justify-center animate-vix-in">
      <button 
        onClick={onClose}
        className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all z-50"
      >
        <X className="w-6 h-6" />
      </button>

      <div className="w-full h-full max-w-[1200px] flex flex-col lg:flex-row overflow-hidden lg:rounded-[2rem] lg:h-[90vh] bg-[var(--vix-bg)] border border-white/5 shadow-2xl">
        {/* Media Section */}
        <div 
          onDoubleClick={handleDoubleClick}
          className="flex-1 bg-black flex items-center justify-center relative group min-h-[50vh] lg:min-h-0 cursor-pointer"
        >
          {post.media_type === 'video' ? (
            <video 
              ref={videoRef}
              src={post.media_url} 
              autoPlay 
              loop 
              muted={isMuted}
              playsInline
              className="w-full h-full object-contain"
            />
          ) : (
            <img src={post.media_url} className="w-full h-full object-contain" alt="Post" />
          )}

          {/* Like Animation Overlay */}
          {showLikeAnim && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <Heart className="w-32 h-32 text-white fill-white animate-vix-pop opacity-80" />
            </div>
          )}

          <div className="absolute bottom-6 right-6 flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
            {post.media_type === 'video' && (
              <button 
                onClick={() => setIsMuted(!isMuted)}
                className="p-3 bg-black/40 backdrop-blur-md rounded-full text-white border border-white/10 hover:bg-black/60 transition-all"
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
            )}
          </div>
        </div>

        {/* Info Section */}
        <div className="w-full lg:w-[450px] flex flex-col bg-[var(--vix-card)] border-l border-white/5">
          {/* Header */}
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-4 cursor-pointer" onClick={() => onSelectUser(post.user)}>
              <img 
                src={post.user.avatar_url || `https://ui-avatars.com/api/?name=${post.user.username}`} 
                className="w-10 h-10 rounded-full object-cover border border-white/10" 
              />
              <div className="flex flex-col">
                <span className="text-sm font-bold flex items-center gap-1 text-[var(--vix-text)]">
                  {post.user.username} {post.user.is_verified && <VerificationBadge size="w-3 h-3" />}
                </span>
                {(post.location_name || post.feeling) && (
                  <div className="flex items-center gap-2">
                    {post.location_name && <span className="text-[10px] text-zinc-500 flex items-center gap-1"><MapPin className="w-2.5 h-2.5" /> {post.location_name}</span>}
                    {post.feeling && <span className="text-[10px] text-zinc-500 flex items-center gap-1"><Smile className="w-2.5 h-2.5" /> {post.feeling}</span>}
                  </div>
                )}
              </div>
            </div>
            <button className="p-2 text-zinc-500 hover:text-white transition-colors">
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </div>

          {/* Comments List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
            {/* Post Caption */}
            <div className="flex gap-4">
              <img 
                src={post.user.avatar_url || `https://ui-avatars.com/api/?name=${post.user.username}`} 
                className="w-8 h-8 rounded-full object-cover" 
              />
              <div className="space-y-1">
                <p className="text-sm">
                  <span className="font-bold mr-2 text-[var(--vix-text)]">@{post.user.username}</span>
                  <span className="text-zinc-400 leading-relaxed">{post.caption}</span>
                </p>
                <span className="text-[10px] text-zinc-600 uppercase font-black tracking-widest">
                  {new Date(post.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Real Comments */}
            {comments.map(c => (
              <div key={c.id} className="flex gap-4 animate-vix-in">
                <img 
                  src={c.user.avatar_url || `https://ui-avatars.com/api/?name=${c.user.username}`} 
                  className="w-8 h-8 rounded-full object-cover" 
                />
                <div className="space-y-1">
                  <p className="text-sm">
                    <span className="font-bold mr-2 text-[var(--vix-text)]">@{c.user.username}</span>
                    <span className="text-zinc-400 leading-relaxed">{c.content}</span>
                  </p>
                  <span className="text-[10px] text-zinc-600 uppercase font-black tracking-widest">
                    {new Date(c.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Actions & Input */}
          <div className="p-6 border-t border-white/5 space-y-4 bg-[var(--vix-secondary)]/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <button onClick={handleLike} className={`${liked ? 'text-pink-500' : 'text-zinc-400 hover:text-white'} transition-all`}>
                  <Heart className={`w-7 h-7 ${liked ? 'fill-current' : ''}`} />
                </button>
                <button className="text-zinc-400 hover:text-white transition-all">
                  <MessageCircle className="w-7 h-7" />
                </button>
                <button className="text-zinc-400 hover:text-white transition-all">
                  <Repeat2 className="w-7 h-7" />
                </button>
              </div>
              <button className={`${saved ? 'text-white' : 'text-zinc-400 hover:text-white'} transition-all`}>
                <Bookmark className={`w-7 h-7 ${saved ? 'fill-current' : ''}`} />
              </button>
            </div>

            <div className="space-y-1">
              <p className="text-sm font-bold text-[var(--vix-text)]">{formatNumber(likesCount)} {t('likes')}</p>
              <p className="text-[10px] text-zinc-600 uppercase font-black tracking-widest">{t('Signal Broadcasted')} {new Date(post.created_at).toLocaleTimeString()}</p>
            </div>

            <form onSubmit={handleComment} className="flex gap-4 pt-4 border-t border-white/5">
              <input 
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder={t('Add a comment...')}
                className="flex-1 bg-transparent text-sm outline-none text-[var(--vix-text)] placeholder:text-zinc-700"
              />
              <button 
                disabled={!newComment.trim() || isCommenting}
                className="text-xs font-black uppercase tracking-widest text-pink-500 disabled:opacity-20 transition-opacity"
              >
                {isCommenting ? <Loader2 className="w-4 h-4 animate-spin" /> : t('Post')}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostDetail;
