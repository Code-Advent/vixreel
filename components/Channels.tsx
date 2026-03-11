
import React, { useState, useEffect } from 'react';
import { 
  Users, Plus, Search, Globe, Lock, ArrowLeft, 
  MoreHorizontal, MessageSquare, Image as ImageIcon, 
  Video, Send, Heart, X, Loader2, Camera, Shield, ChevronLeft,
  Link as LinkIcon, CheckCircle2, Bell, Share2, Download, LogOut, Trash2,
  Smile, UserPlus, ShieldCheck, UserMinus
} from 'lucide-react';
import EmojiPicker, { Theme as EmojiTheme } from 'emoji-picker-react';
import { supabase } from '../lib/supabase';
import { UserProfile, Channel, ChannelMember, ChannelPost, ChannelPostComment, ChannelPostReaction } from '../types';
import { sanitizeFilename, formatNumber, formatFileSize } from '../lib/utils';
import VerificationBadge from './VerificationBadge';
import { useTranslation } from '../lib/translation';

interface ChannelsProps {
  currentUser: UserProfile;
  onBack: () => void;
  initialChannel?: Channel | null;
}

const Channels: React.FC<ChannelsProps> = ({ currentUser, onBack, initialChannel }) => {
  const { t } = useTranslation();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'LIST' | 'CREATE' | 'DETAILS'>(initialChannel ? 'DETAILS' : 'LIST');
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(initialChannel || null);
  const [channelPosts, setChannelPosts] = useState<ChannelPost[]>([]);
  const [isMember, setIsMember] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Create Channel State
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPrivacy, setNewPrivacy] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [onlyAdminCanPost, setOnlyAdminCanPost] = useState(false);
  const [newCoverFile, setNewCoverFile] = useState<File | null>(null);
  const [newCoverPreview, setNewCoverPreview] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Post State
  const [postContent, setPostContent] = useState('');
  const [postFile, setPostFile] = useState<File | null>(null);
  const [postPreview, setPostPreview] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [downloadingPostId, setDownloadingPostId] = useState<string | null>(null);

  // Comment State
  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, ChannelPostComment[]>>({});
  const [newComment, setNewComment] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);
  const [showChannelInfo, setShowChannelInfo] = useState(false);
  const [isChannelAdmin, setIsChannelAdmin] = useState(false);
  const [channelMembers, setChannelMembers] = useState<ChannelMember[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);

  useEffect(() => {
    fetchChannels();
    
    // Real-time Channels Subscription
    const channelsSubscription = supabase
      .channel('channels_realtime')
      .on('postgres_changes' as any, { event: '*', table: 'channels' }, () => fetchChannels())
      .on('postgres_changes' as any, { event: '*', table: 'channel_members' }, () => fetchChannels())
      .subscribe();

    if (initialChannel) {
      fetchChannelData(initialChannel.id);
    }

    return () => {
      supabase.removeChannel(channelsSubscription);
    };
  }, [initialChannel]);

  useEffect(() => {
    if (selectedChannel) {
      // Real-time Channel Data Subscription
      const channelDataSubscription = supabase
        .channel(`channel_data_${selectedChannel.id}`)
        .on('postgres_changes' as any, { 
          event: '*', 
          table: 'channel_posts', 
          filter: `channel_id=eq.${selectedChannel.id}` 
        }, () => fetchChannelData(selectedChannel.id))
        .on('postgres_changes' as any, { 
          event: '*', 
          table: 'channel_post_likes'
        }, () => fetchChannelData(selectedChannel.id))
        .on('postgres_changes' as any, { 
          event: '*', 
          table: 'channel_post_comments'
        }, () => fetchChannelData(selectedChannel.id))
        .on('postgres_changes' as any, { 
          event: '*', 
          table: 'channel_post_reactions'
        }, () => fetchChannelData(selectedChannel.id))
        .on('postgres_changes' as any, { 
          event: '*', 
          table: 'channel_members',
          filter: `channel_id=eq.${selectedChannel.id}`
        }, () => fetchChannelData(selectedChannel.id))
        .subscribe();

      return () => {
        supabase.removeChannel(channelDataSubscription);
      };
    }
  }, [selectedChannel]);

  const copyChannelLink = (channelId: string) => {
    const url = `${window.location.origin}/channels/${channelId}`;
    navigator.clipboard.writeText(url);
    alert(t('Channel link copied to clipboard!'));
  };

  const handleDownload = async (postId: string, url: string, filename: string) => {
    setDownloadingPostId(postId);
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename || 'download';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      // Keep loader for a moment for visual effect as requested
      setTimeout(() => setDownloadingPostId(null), 1500);
    }
  };

  const fetchChannels = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('channels')
        .select(`
          *,
          creator:profiles(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Get member counts (simplified for demo)
      const channelsWithCounts = await Promise.all((data || []).map(async (g) => {
        const { count } = await supabase
          .from('channel_members')
          .select('*', { count: 'exact', head: true })
          .eq('channel_id', g.id);
        return { ...g, member_count: count || 0 };
      }));

      setChannels(channelsWithCounts);
    } catch (err) {
      console.error('Error fetching channels:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || isCreating) return;
    setIsCreating(true);

    try {
      let coverUrl = 'https://picsum.photos/seed/channel/800/400';

      if (newCoverFile) {
        const safeName = sanitizeFilename(newCoverFile.name);
        const path = `channels/${Date.now()}-${safeName}`;
        const { error: uploadErr } = await supabase.storage
          .from('posts')
          .upload(path, newCoverFile);
        
        if (!uploadErr) {
          const { data: { publicUrl } } = supabase.storage.from('posts').getPublicUrl(path);
          coverUrl = publicUrl;
        }
      }

      const { data: channel, error: channelErr } = await supabase
        .from('channels')
        .insert({
          name: newName.trim(),
          description: newDescription.trim(),
          privacy: newPrivacy,
          only_admin_can_post: onlyAdminCanPost,
          cover_url: coverUrl,
          creator_id: currentUser.id
        })
        .select()
        .single();

      if (channelErr) throw channelErr;

      // Add creator as admin member
      await supabase.from('channel_members').insert({
        channel_id: channel.id,
        user_id: currentUser.id,
        role: 'ADMIN'
      });

      setNewName('');
      setNewDescription('');
      setOnlyAdminCanPost(false);
      setNewCoverFile(null);
      setNewCoverPreview(null);
      setView('LIST');
      fetchChannels();
    } catch (err) {
      console.error('Error creating channel:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const selectChannel = async (channel: Channel) => {
    setSelectedChannel(channel);
    setView('DETAILS');
    fetchChannelData(channel.id);
  };

  const fetchChannelData = async (channelId: string) => {
    try {
      // Fetch channel details to get only_admin_can_post, boosted_members, is_verified
      const { data: channelDetails } = await supabase
        .from('channels')
        .select('*')
        .eq('id', channelId)
        .single();
      
      if (channelDetails) {
        // Fetch member count
        const { count } = await supabase
          .from('channel_members')
          .select('*', { count: 'exact', head: true })
          .eq('channel_id', channelId);
        
        setSelectedChannel({ ...channelDetails, member_count: count || 0 });
      }

      // Check membership
      const { data: memberData } = await supabase
        .from('channel_members')
        .select('*')
        .eq('channel_id', channelId)
        .eq('user_id', currentUser.id)
        .maybeSingle();
      
      setIsMember(!!memberData);
      setIsChannelAdmin(memberData?.role === 'ADMIN');
      
      // Fetch members if admin
      if (memberData?.role === 'ADMIN') {
        const { data: members } = await supabase
          .from('channel_members')
          .select('*, user:profiles(*)')
          .eq('channel_id', channelId);
        setChannelMembers(members || []);
      }

      // Fetch posts
      const { data: posts, error } = await supabase
        .from('channel_posts')
        .select(`
          *,
          user:profiles(*),
          reactions:channel_post_reactions(*, user:profiles(*))
        `)
        .eq('channel_id', channelId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setChannelPosts(posts || []);

      // Fetch likes and comments counts for each post
      const postsWithEngagement = await Promise.all((posts || []).map(async (p) => {
        const { count: lCount } = await supabase.from('channel_post_likes').select('*', { count: 'exact', head: true }).eq('post_id', p.id);
        const { count: cCount } = await supabase.from('channel_post_comments').select('*', { count: 'exact', head: true }).eq('post_id', p.id);
        const { data: myLike } = await supabase.from('channel_post_likes').select('*').eq('post_id', p.id).eq('user_id', currentUser.id).maybeSingle();
        return { ...p, likes_count: lCount || 0, comments_count: cCount || 0, is_liked: !!myLike };
      }));
      setChannelPosts(postsWithEngagement);
    } catch (err) {
      console.error('Error fetching channel data:', err);
    }
  };

  const joinChannel = async () => {
    if (!selectedChannel) return;
    try {
      const { error } = await supabase.from('channel_members').insert({
        channel_id: selectedChannel.id,
        user_id: currentUser.id
      });
      if (error) throw error;
      setIsMember(true);
      fetchChannelData(selectedChannel.id);
    } catch (err) {
      console.error('Error joining channel:', err);
    }
  };

  const leaveChannel = async () => {
    if (!selectedChannel || isLeaving) return;
    if (!confirm('Are you sure you want to leave this channel?')) return;
    setIsLeaving(true);
    try {
      const { error } = await supabase
        .from('channel_members')
        .delete()
        .eq('channel_id', selectedChannel.id)
        .eq('user_id', currentUser.id);
      
      if (error) throw error;
      setIsMember(false);
      fetchChannelData(selectedChannel.id);
    } catch (err) {
      console.error('Error leaving channel:', err);
    } finally {
      setIsLeaving(false);
    }
  };

  const toggleLikePost = async (postId: string) => {
    const post = channelPosts.find(p => p.id === postId);
    if (!post) return;

    try {
      if (post.is_liked) {
        await supabase.from('channel_post_likes').delete().eq('post_id', postId).eq('user_id', currentUser.id);
        setChannelPosts(prev => prev.map(p => p.id === postId ? { ...p, is_liked: false, likes_count: (p.likes_count || 1) - 1 } : p));
      } else {
        await supabase.from('channel_post_likes').insert({ post_id: postId, user_id: currentUser.id });
        setChannelPosts(prev => prev.map(p => p.id === postId ? { ...p, is_liked: true, likes_count: (p.likes_count || 0) + 1 } : p));
      }
    } catch (err) {
      console.error('Error toggling like:', err);
    }
  };

  const fetchComments = async (postId: string) => {
    try {
      const { data, error } = await supabase
        .from('channel_post_comments')
        .select('*, user:profiles(*)')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      setComments(prev => ({ ...prev, [postId]: data || [] }));
    } catch (err) {
      console.error('Error fetching comments:', err);
    }
  };

  const handleAddComment = async (postId: string) => {
    if (!newComment.trim() || isCommenting) return;
    setIsCommenting(true);
    try {
      const { data, error } = await supabase
        .from('channel_post_comments')
        .insert({
          post_id: postId,
          user_id: currentUser.id,
          content: newComment.trim()
        })
        .select('*, user:profiles(*)')
        .single();
      
      if (error) throw error;
      setComments(prev => ({ ...prev, [postId]: [...(prev[postId] || []), data] }));
      setChannelPosts(prev => prev.map(p => p.id === postId ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p));
      setNewComment('');
    } catch (err) {
      console.error('Error adding comment:', err);
    } finally {
      setIsCommenting(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm(t('Are you sure you want to delete this update?'))) return;
    try {
      const { error } = await supabase.from('channel_posts').delete().eq('id', postId);
      if (error) throw error;
      setChannelPosts(prev => prev.filter(p => p.id !== postId));
    } catch (err) {
      console.error('Error deleting post:', err);
    }
  };

  const toggleReaction = async (postId: string, reaction: string) => {
    try {
      const { data: existing } = await supabase
        .from('channel_post_reactions')
        .select('*')
        .eq('post_id', postId)
        .eq('user_id', currentUser.id)
        .eq('reaction', reaction)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('channel_post_reactions')
          .delete()
          .eq('id', existing.id);
      } else {
        await supabase
          .from('channel_post_reactions')
          .insert({
            post_id: postId,
            user_id: currentUser.id,
            reaction
          });
      }
      if (selectedChannel) fetchChannelData(selectedChannel.id);
      setShowEmojiPicker(null);
    } catch (err) {
      console.error("Error toggling post reaction:", err);
    }
  };

  const transferAdmin = async (targetUserId: string) => {
    if (!confirm(t('Are you sure you want to promote this user to admin?'))) return;
    setIsTransferring(true);
    try {
      const { error } = await supabase
        .from('channel_members')
        .update({ role: 'ADMIN' })
        .eq('channel_id', selectedChannel!.id)
        .eq('user_id', targetUserId);
      
      if (error) throw error;
      
      if (selectedChannel) fetchChannelData(selectedChannel.id);
    } catch (err) {
      console.error("Transfer admin error:", err);
    } finally {
      setIsTransferring(false);
    }
  };

  const boostChannel = async () => {
    if (!selectedChannel) return;
    try {
      const { error } = await supabase
        .from('channels')
        .update({ boosted_members: (selectedChannel.boosted_members || 0) + 100 })
        .eq('id', selectedChannel.id);
      if (error) throw error;
      fetchChannelData(selectedChannel.id);
      alert(t('Channel boosted by 100 followers!'));
    } catch (err) {
      console.error("Boost error:", err);
    }
  };

  const verifyChannel = async () => {
    if (!selectedChannel) return;
    try {
      const { error } = await supabase
        .from('channels')
        .update({ is_verified: true })
        .eq('id', selectedChannel.id);
      if (error) throw error;
      fetchChannelData(selectedChannel.id);
      alert(t('Channel verified successfully!'));
    } catch (err) {
      console.error("Verify error:", err);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postContent.trim() || !selectedChannel || isPosting) return;
    setIsPosting(true);

    try {
      let mediaUrl = null;
      let mediaType = null;

      if (postFile) {
        const safeName = sanitizeFilename(postFile.name);
        const path = `channel_posts/${Date.now()}-${safeName}`;
        const { error: uploadErr } = await supabase.storage
          .from('posts')
          .upload(path, postFile);
        
        if (!uploadErr) {
          const { data: { publicUrl } } = supabase.storage.from('posts').getPublicUrl(path);
          mediaUrl = publicUrl;
          mediaType = postFile.type.startsWith('video') ? 'video' : 'image';
        }
      }

      const { error } = await supabase.from('channel_posts').insert({
        channel_id: selectedChannel.id,
        user_id: currentUser.id,
        content: postContent.trim(),
        media_url: mediaUrl,
        media_type: mediaType
      });

      if (error) throw error;
      setPostContent('');
      setPostFile(null);
      setPostPreview(null);
      fetchChannelData(selectedChannel.id);
    } catch (err) {
      console.error('Error creating channel post:', err);
    } finally {
      setIsPosting(false);
    }
  };

  const filteredChannels = channels.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-full bg-[var(--vix-bg)] overflow-hidden">
      {/* Sidebar - Channel List */}
      <div className={`${selectedChannel && 'hidden sm:flex'} flex flex-col w-full sm:w-80 lg:w-96 border-r border-[var(--vix-border)] bg-[var(--vix-bg)] z-10`}>
        <div className="p-4 border-b border-[var(--vix-border)] flex items-center justify-between bg-[var(--vix-bg)]/80 backdrop-blur-xl sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-[var(--vix-secondary)] rounded-full transition-all">
              <ArrowLeft className="w-6 h-6 text-[var(--vix-text)]" />
            </button>
            <h2 className="text-xl font-black text-[var(--vix-text)] uppercase tracking-tight">
              {t('Channels')}
            </h2>
          </div>
          <button 
            onClick={() => setView('CREATE')} 
            className="vix-gradient p-2 rounded-full text-white shadow-lg hover:scale-105 transition-all"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-pink-500 transition-colors" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('Search channels...')}
              className="w-full bg-[var(--vix-secondary)] border border-[var(--vix-border)] rounded-2xl py-3 pl-12 pr-4 text-sm outline-none focus:border-pink-500/30 transition-all text-[var(--vix-text)] placeholder:text-zinc-500 font-medium"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin vix-loader" />
            </div>
          ) : filteredChannels.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <Globe className="w-10 h-10 text-[var(--vix-muted)] mb-4 opacity-20" />
              <p className="text-[var(--vix-muted)] text-sm font-medium">{t('No channels found')}</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {filteredChannels.map(channel => (
                <div 
                  key={channel.id}
                  onClick={() => selectChannel(channel)}
                  className={`flex items-center gap-3 p-4 cursor-pointer transition-all border-l-4 ${selectedChannel?.id === channel.id ? 'bg-[var(--vix-secondary)] border-pink-500' : 'border-transparent hover:bg-[var(--vix-secondary)]/50'}`}
                >
                  <div className="relative flex-shrink-0">
                    <img src={channel.cover_url} className="w-12 h-12 rounded-2xl object-cover border border-[var(--vix-border)]" alt={channel.name} />
                    {channel.is_verified && (
                      <div className="absolute -bottom-1 -right-1 bg-[var(--vix-bg)] rounded-full p-0.5 shadow-sm">
                        <CheckCircle2 className="w-3 h-3 fill-[#ec4899] text-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <h3 className="text-sm font-bold text-[var(--vix-text)] truncate">
                        {channel.name}
                      </h3>
                      <span className="text-[10px] text-[var(--vix-muted)] font-medium">
                        {channel.created_at ? new Date(channel.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--vix-muted)] truncate font-medium">
                      {formatNumber((channel.member_count || 0) + (channel.boosted_members || 0))} {t('followers')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content - Channel Details / Chat */}
      <div className={`${!selectedChannel && view !== 'CREATE' && 'hidden sm:flex'} flex-1 flex flex-col bg-[var(--vix-bg)] relative overflow-hidden`}>
        {view === 'CREATE' ? (
          <div className="flex flex-col h-full">
            <div className="p-4 border-b border-[var(--vix-border)] flex items-center gap-4 bg-[var(--vix-bg)]/80 backdrop-blur-xl z-20">
              <button onClick={() => setView('LIST')} className="p-2 hover:bg-[var(--vix-secondary)] rounded-full transition-all">
                <ArrowLeft className="w-6 h-6 text-[var(--vix-text)]" />
              </button>
              <h2 className="text-xl font-black text-[var(--vix-text)] uppercase tracking-tight">
                {t('Create Channel')}
              </h2>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
              <form onSubmit={handleCreateChannel} className="space-y-8 max-w-lg mx-auto">
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 ml-2">{t('Cover Image')}</label>
                  <div 
                    onClick={() => document.getElementById('cover-input')?.click()}
                    className="h-48 rounded-[2.5rem] border-2 border-dashed border-[var(--vix-border)] flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-pink-500/30 transition-all overflow-hidden relative"
                  >
                    {newCoverPreview ? (
                      <img src={newCoverPreview} className="w-full h-full object-cover" />
                    ) : (
                      <>
                        <Camera className="w-8 h-8 text-zinc-800" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-700">{t('Upload Cover')}</span>
                      </>
                    )}
                    <input 
                      id="cover-input"
                      type="file" 
                      className="hidden" 
                      accept="image/*"
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) {
                          setNewCoverFile(f);
                          setNewCoverPreview(URL.createObjectURL(f));
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 ml-2">{t('Channel Name')}</label>
                    <input 
                      type="text" 
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      placeholder={t('e.g. VixReel Creators')}
                      className="w-full bg-[var(--vix-card)] border border-[var(--vix-border)] rounded-2xl py-4 px-6 text-sm text-[var(--vix-text)] outline-none focus:border-pink-500/50 transition-all"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 ml-2">{t('Description')}</label>
                    <textarea 
                      value={newDescription}
                      onChange={e => setNewDescription(e.target.value)}
                      placeholder={t('What is this channel about?')}
                      className="w-full bg-[var(--vix-card)] border border-[var(--vix-border)] rounded-2xl py-4 px-6 text-sm text-[var(--vix-text)] outline-none focus:border-pink-500/50 transition-all min-h-[120px] resize-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 ml-2">{t('Privacy')}</label>
                    <div className="flex gap-4">
                      <button 
                        type="button"
                        onClick={() => setNewPrivacy('PUBLIC')}
                        className={`flex-1 py-4 rounded-2xl border transition-all flex items-center justify-center gap-2 ${newPrivacy === 'PUBLIC' ? 'bg-pink-500 text-white border-pink-500 shadow-lg' : 'bg-[var(--vix-card)] border-[var(--vix-border)] text-zinc-600'}`}
                      >
                        <Globe className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">{t('Public')}</span>
                      </button>
                      <button 
                        type="button"
                        onClick={() => setNewPrivacy('PRIVATE')}
                        className={`flex-1 py-4 rounded-2xl border transition-all flex items-center justify-center gap-2 ${newPrivacy === 'PRIVATE' ? 'bg-pink-500 text-white border-pink-500 shadow-lg' : 'bg-[var(--vix-card)] border-[var(--vix-border)] text-zinc-600'}`}
                      >
                        <Lock className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">{t('Private')}</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 ml-2">{t('Posting Permissions')}</label>
                    <button 
                      type="button"
                      onClick={() => setOnlyAdminCanPost(!onlyAdminCanPost)}
                      className={`w-full py-4 rounded-2xl border transition-all flex items-center justify-center gap-3 ${onlyAdminCanPost ? 'bg-purple-500 text-white border-purple-500 shadow-lg' : 'bg-[var(--vix-card)] border-[var(--vix-border)] text-zinc-600'}`}
                    >
                      <Shield className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">
                        {onlyAdminCanPost ? t('Only Admins Can Post') : t('Everyone Can Post')}
                      </span>
                    </button>
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={isCreating}
                  className="w-full vix-gradient py-5 rounded-[2rem] text-white font-black uppercase tracking-widest text-[11px] shadow-2xl shadow-pink-500/20 flex items-center justify-center gap-3"
                >
                  {isCreating ? <Loader2 className="w-5 h-5 animate-spin vix-loader" /> : t('Establish Channel')}
                </button>
              </form>
            </div>
          </div>
        ) : selectedChannel ? (
          <div className="flex flex-col h-full bg-[var(--vix-bg)] relative">
            {/* Channel Header */}
            <div className="flex items-center justify-between p-3 bg-[var(--vix-card)] border-b border-[var(--vix-border)] sticky top-0 z-50">
              <div className="flex items-center gap-3">
                <button onClick={() => setSelectedChannel(null)} className="sm:hidden p-1 hover:bg-[var(--vix-secondary)] rounded-full transition-all">
                  <ArrowLeft className="w-6 h-6 text-[var(--vix-text)]" />
                </button>
                <div onClick={() => setShowChannelInfo(true)} className="flex items-center gap-3 cursor-pointer group/header">
                  <img src={selectedChannel.cover_url} className="w-10 h-10 rounded-full object-cover border border-[var(--vix-border)] group-hover/header:scale-105 transition-transform" alt={selectedChannel.name} />
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1">
                      <h3 className="text-base font-bold text-[var(--vix-text)] leading-tight group-hover/header:text-pink-500 transition-colors">
                        {selectedChannel.name}
                      </h3>
                      {selectedChannel.is_verified && (
                        <CheckCircle2 className="w-4 h-4 fill-[#ec4899] text-white" />
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--vix-muted)] font-medium">
                      {formatNumber((selectedChannel.member_count || 0) + (selectedChannel.boosted_members || 0))} {t('followers')}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!isMember ? (
                  <button 
                    onClick={joinChannel}
                    className="bg-pink-500 text-white px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest shadow-lg hover:bg-pink-600 transition-all"
                  >
                    {t('Follow')}
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button className="p-2 text-[var(--vix-muted)] hover:text-[var(--vix-text)] transition-all">
                      <Bell className="w-5 h-5" />
                    </button>
                    <div className="relative group">
                      <button className="p-2 text-[var(--vix-muted)] hover:text-[var(--vix-text)] transition-all">
                        <MoreHorizontal className="w-5 h-5" />
                      </button>
                      <div className="absolute right-0 top-full mt-2 w-48 bg-[var(--vix-card)] border border-[var(--vix-border)] rounded-2xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[60] overflow-hidden">
                        {selectedChannel.creator_id === currentUser.id && (
                          <button 
                            onClick={async () => {
                              const newVal = !selectedChannel.only_admin_can_post;
                              const { error } = await supabase.from('channels').update({ only_admin_can_post: newVal }).eq('id', selectedChannel.id);
                              if (!error) setSelectedChannel({ ...selectedChannel, only_admin_can_post: newVal });
                            }}
                            className="w-full px-4 py-3 text-left text-xs font-bold hover:bg-[var(--vix-secondary)] transition-all flex items-center gap-2"
                          >
                            <Shield className="w-4 h-4" />
                            {selectedChannel.only_admin_can_post ? t('Allow everyone to post') : t('Only admins can post')}
                          </button>
                        )}
                        <button 
                          onClick={() => copyChannelLink(selectedChannel.id)}
                          className="w-full px-4 py-3 text-left text-xs font-bold hover:bg-[var(--vix-secondary)] transition-all flex items-center gap-2"
                        >
                          <LinkIcon className="w-4 h-4" />
                          {t('Copy Link')}
                        </button>
                        <button 
                          onClick={leaveChannel}
                          className="w-full px-4 py-3 text-left text-xs font-bold text-red-500 hover:bg-red-500/5 transition-all flex items-center gap-2"
                        >
                          <LogOut className="w-4 h-4" />
                          {t('Unfollow')}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Feed Area */}
            <div id="channel-feed" className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar relative">
              {/* Background Pattern */}
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(var(--vix-text) 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
              
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin vix-loader" />
                </div>
              ) : channelPosts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 text-center">
                  <MessageSquare className="w-12 h-12 text-[var(--vix-muted)] mb-4 opacity-20" />
                  <p className="text-[var(--vix-muted)] font-medium">{t('No updates yet')}</p>
                </div>
              ) : (
                <div className="space-y-6 relative z-10">
                  {channelPosts.map((post, index) => {
                    const postDate = new Date(post.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                    const prevPostDate = index > 0 ? new Date(channelPosts[index - 1].created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null;
                    const showDateSeparator = postDate !== prevPostDate;

                    return (
                      <React.Fragment key={post.id}>
                        {showDateSeparator && (
                          <div className="flex justify-center my-6">
                            <div className="bg-[var(--vix-secondary)] text-[var(--vix-muted)] text-[10px] px-3 py-1 rounded-full shadow-sm font-bold border border-[var(--vix-border)] uppercase tracking-wider">
                              {postDate}
                            </div>
                          </div>
                        )}
                        
                        <div className="max-w-[90%] mx-auto">
                          <div className="bg-[var(--vix-card)] rounded-3xl shadow-lg relative group overflow-hidden border border-[var(--vix-border)]">
                            {post.media_url && (
                              <div className="relative">
                                {post.media_type === 'video' ? (
                                  <video src={post.media_url} controls className="w-full max-h-[500px] object-cover" />
                                ) : (
                                  <img src={post.media_url} className="w-full max-h-[500px] object-cover" alt="Post media" />
                                )}
                              </div>
                            )}
                            
                            <div className="p-5 space-y-3">
                              {post.content && (
                                <p className="text-[15px] text-[var(--vix-text)] leading-relaxed whitespace-pre-wrap font-medium">
                                  {post.content}
                                </p>
                              )}
                              
                              <div className="flex items-center justify-between pt-2">
                                <div className="flex items-center gap-3">
                                  {post.reactions && post.reactions.length > 0 && (
                                    <div className="flex items-center gap-1 bg-[var(--vix-secondary)] px-2 py-1 rounded-full border border-[var(--vix-border)]">
                                      {Array.from(new Set(post.reactions.map(r => r.reaction))).slice(0, 3).map(emoji => (
                                        <span key={emoji} className="text-xs">{emoji}</span>
                                      ))}
                                      <span className="text-[10px] text-[var(--vix-muted)] font-bold ml-1">
                                        {post.reactions.length}
                                      </span>
                                    </div>
                                  )}
                                  <div className="relative">
                                    <button 
                                      onClick={() => setShowEmojiPicker(showEmojiPicker === post.id ? null : post.id)}
                                      className="p-1.5 text-[var(--vix-muted)] hover:text-pink-500 transition-all rounded-full hover:bg-[var(--vix-secondary)]"
                                    >
                                      <Smile className="w-4 h-4" />
                                    </button>
                                    {showEmojiPicker === post.id && (
                                      <div className="absolute bottom-full left-0 mb-2 z-[70]">
                                        <div className="fixed inset-0" onClick={() => setShowEmojiPicker(null)}></div>
                                        <div className="relative">
                                          <EmojiPicker 
                                            onEmojiClick={(emojiData) => toggleReaction(post.id, emojiData.emoji)}
                                            theme={EmojiTheme.DARK}
                                            lazyLoadEmojis={true}
                                            skinTonesDisabled={true}
                                            searchDisabled={true}
                                            height={350}
                                            width={300}
                                          />
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {(selectedChannel.creator_id === currentUser.id || isChannelAdmin) && (
                                    <button 
                                      onClick={() => handleDeletePost(post.id)}
                                      className="p-1.5 text-red-500/50 hover:text-red-500 transition-all"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                  <span className="text-[10px] text-[var(--vix-muted)] font-bold opacity-60">
                                    {new Date(post.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Broadcast Input (Admin Only) */}
            {isMember && (!selectedChannel.only_admin_can_post || isChannelAdmin) ? (
              <div className="p-4 bg-[var(--vix-card)] border-t border-[var(--vix-border)]">
                <div className="flex items-end gap-3 max-w-4xl mx-auto">
                  <div className="flex-1 bg-[var(--vix-secondary)] rounded-3xl flex flex-col p-2 border border-[var(--vix-border)]">
                    {postPreview && (
                      <div className="relative w-24 h-24 m-2 rounded-xl overflow-hidden border border-[var(--vix-border)]">
                        <button onClick={() => { setPostFile(null); setPostPreview(null); }} className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-full z-10"><X className="w-3 h-3" /></button>
                        {postFile?.type.startsWith('video') ? <video src={postPreview} className="w-full h-full object-cover" /> : <img src={postPreview} className="w-full h-full object-cover" />}
                      </div>
                    )}
                    <div className="flex items-center">
                      <button 
                        onClick={() => document.getElementById('channel-post-media')?.click()}
                        className="p-3 text-[var(--vix-muted)] hover:text-pink-500 transition-all"
                      >
                        <Plus className="w-6 h-6" />
                      </button>
                      <input 
                        id="channel-post-media"
                        type="file" 
                        className="hidden" 
                        accept="image/*,video/*"
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (f) {
                            setPostFile(f);
                            setPostPreview(URL.createObjectURL(f));
                          }
                        }}
                      />
                      <textarea 
                        value={postContent}
                        onChange={e => setPostContent(e.target.value)}
                        placeholder={t('Broadcast an update...')}
                        className="flex-1 bg-transparent border-none py-3 px-2 text-sm text-[var(--vix-text)] outline-none placeholder:text-[var(--vix-muted)] resize-none max-h-32 font-medium"
                        rows={1}
                      />
                    </div>
                  </div>

                  <button 
                    onClick={handleCreatePost}
                    disabled={!postContent.trim() || isPosting}
                    className="bg-pink-500 p-4 rounded-full text-white shadow-lg disabled:opacity-30 transition-all flex-shrink-0"
                  >
                    {isPosting ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}
                  </button>
                </div>
              </div>
            ) : isMember && selectedChannel.only_admin_can_post ? (
              <div className="p-4 bg-[var(--vix-card)] text-center border-t border-[var(--vix-border)]">
                <p className="text-xs text-[var(--vix-muted)] font-medium opacity-60">
                  {t('Only administrators can send messages to this channel')}
                </p>
              </div>
            ) : !isMember && (
              <div className="p-6 bg-[var(--vix-card)] border-t border-[var(--vix-border)] text-center">
                <button 
                  onClick={joinChannel}
                  className="bg-pink-500 px-12 py-3 rounded-full text-white text-xs font-black uppercase tracking-widest shadow-xl hover:bg-pink-600 transition-all"
                >
                  {t('Join Channel')}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
            <div className="w-24 h-24 bg-[var(--vix-secondary)] rounded-full flex items-center justify-center mb-6 opacity-20">
              <Globe className="w-12 h-12 text-[var(--vix-text)]" />
            </div>
            <h3 className="text-xl font-black text-[var(--vix-text)] uppercase tracking-tight mb-2">{t('Select a channel')}</h3>
            <p className="text-[var(--vix-muted)] text-sm font-medium max-w-xs">{t('Choose a channel from the list to see the latest updates.')}</p>
          </div>
        )}
      </div>

      {/* Channel Info Modal */}
      {showChannelInfo && selectedChannel && (
        <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-[var(--vix-card)] border border-[var(--vix-border)] rounded-[3rem] p-10 space-y-8 shadow-2xl animate-vix-in max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="flex flex-col items-center text-center gap-6">
              <div className="relative">
                <img src={selectedChannel.cover_url} className="w-32 h-32 rounded-[3rem] object-cover border-4 border-[var(--vix-border)] shadow-2xl" alt={selectedChannel.name} />
                {selectedChannel.is_verified && (
                  <div className="absolute -bottom-2 -right-2 bg-[var(--vix-bg)] rounded-full p-1.5 shadow-xl">
                    <CheckCircle2 className="w-6 h-6 fill-[#ec4899] text-white" />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-black text-[var(--vix-text)] uppercase tracking-tight">{selectedChannel.name}</h2>
                <p className="text-sm text-[var(--vix-muted)] font-bold uppercase tracking-widest">
                  {formatNumber((selectedChannel.member_count || 0) + (selectedChannel.boosted_members || 0))} {t('followers')}
                </p>
              </div>
              <p className="text-[var(--vix-text)] leading-relaxed font-medium opacity-80">{selectedChannel.description}</p>
              
              <div className="w-full pt-6 border-t border-[var(--vix-border)] space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--vix-muted)] font-bold uppercase tracking-widest text-[10px]">{t('Created by')}</span>
                  <span className="text-[var(--vix-text)] font-black">@{selectedChannel.creator?.username}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--vix-muted)] font-bold uppercase tracking-widest text-[10px]">{t('Privacy')}</span>
                  <span className="text-[var(--vix-text)] font-black uppercase tracking-widest text-[10px]">{selectedChannel.privacy}</span>
                </div>
              </div>

              {isChannelAdmin && (
                <div className="w-full space-y-4 pt-6">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-pink-500 text-left">{t('Admin Controls')}</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={boostChannel}
                      className="flex flex-col items-center gap-2 p-4 bg-[var(--vix-secondary)] rounded-3xl border border-[var(--vix-border)] hover:border-pink-500/30 transition-all"
                    >
                      <UserPlus className="w-5 h-5 text-pink-500" />
                      <span className="text-[10px] font-black uppercase tracking-widest">{t('Boost')}</span>
                    </button>
                    <button 
                      onClick={verifyChannel}
                      className="flex flex-col items-center gap-2 p-4 bg-[var(--vix-secondary)] rounded-3xl border border-[var(--vix-border)] hover:border-blue-500/30 transition-all"
                    >
                      <ShieldCheck className="w-5 h-5 text-blue-500" />
                      <span className="text-[10px] font-black uppercase tracking-widest">{t('Verify')}</span>
                    </button>
                  </div>
                </div>
              )}

              <button 
                onClick={() => setShowChannelInfo(false)}
                className="w-full bg-[var(--vix-secondary)] py-4 rounded-2xl text-[var(--vix-text)] font-black uppercase tracking-widest text-[10px] border border-[var(--vix-border)]"
              >
                {t('Close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Channels;
