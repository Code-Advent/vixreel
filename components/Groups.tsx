
import React, { useState, useEffect } from 'react';
import { 
  Users, Plus, Search, Globe, Lock, ArrowLeft, 
  MoreHorizontal, MessageSquare, Image as ImageIcon, 
  Video, Send, Heart, X, Loader2, Camera, Shield, ChevronLeft,
  Link as LinkIcon, CheckCircle2, Bell, Share2, Download
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { UserProfile, Group, GroupMember, GroupPost, GroupPostComment } from '../types';
import { sanitizeFilename, formatNumber } from '../lib/utils';
import VerificationBadge from './VerificationBadge';
import { useTranslation } from '../lib/translation';

interface GroupsProps {
  currentUser: UserProfile;
  onBack: () => void;
  initialGroup?: Group | null;
}

const Groups: React.FC<GroupsProps> = ({ currentUser, onBack, initialGroup }) => {
  const { t } = useTranslation();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'LIST' | 'CREATE' | 'DETAILS'>(initialGroup ? 'DETAILS' : 'LIST');
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(initialGroup || null);
  const [groupPosts, setGroupPosts] = useState<GroupPost[]>([]);
  const [isMember, setIsMember] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  
  // Create Group State
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

  // Comment State
  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, GroupPostComment[]>>({});
  const [newComment, setNewComment] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);

  useEffect(() => {
    fetchGroups();
    
    // Real-time Groups Subscription
    const groupsSubscription = supabase
      .channel('groups_realtime')
      .on('postgres_changes' as any, { event: '*', table: 'groups' }, () => fetchGroups())
      .on('postgres_changes' as any, { event: '*', table: 'group_members' }, () => fetchGroups())
      .subscribe();

    if (initialGroup) {
      fetchGroupData(initialGroup.id);
    }

    return () => {
      supabase.removeChannel(groupsSubscription);
    };
  }, [initialGroup]);

  useEffect(() => {
    if (view === 'DETAILS' && selectedGroup) {
      // Real-time Group Data Subscription
      const groupDataSubscription = supabase
        .channel(`group_data_${selectedGroup.id}`)
        .on('postgres_changes' as any, { 
          event: '*', 
          table: 'group_posts', 
          filter: `group_id=eq.${selectedGroup.id}` 
        }, () => fetchGroupData(selectedGroup.id))
        .on('postgres_changes' as any, { 
          event: '*', 
          table: 'group_post_likes'
        }, () => fetchGroupData(selectedGroup.id))
        .on('postgres_changes' as any, { 
          event: '*', 
          table: 'group_post_comments'
        }, () => fetchGroupData(selectedGroup.id))
        .on('postgres_changes' as any, { 
          event: '*', 
          table: 'group_post_reactions'
        }, () => fetchGroupData(selectedGroup.id))
        .subscribe();

      return () => {
        supabase.removeChannel(groupDataSubscription);
      };
    }
  }, [view, selectedGroup]);

  const copyGroupLink = (groupId: string) => {
    const url = `${window.location.origin}/groups/${groupId}`;
    navigator.clipboard.writeText(url);
    alert(t('Community link copied to clipboard!'));
  };

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('groups')
        .select(`
          *,
          creator:profiles(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Get member counts (simplified for demo)
      const groupsWithCounts = await Promise.all((data || []).map(async (g) => {
        const { count } = await supabase
          .from('group_members')
          .select('*', { count: 'exact', head: true })
          .eq('group_id', g.id);
        return { ...g, member_count: count || 0 };
      }));

      setGroups(groupsWithCounts);
    } catch (err) {
      console.error('Error fetching groups:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || isCreating) return;
    setIsCreating(true);

    try {
      let coverUrl = 'https://picsum.photos/seed/group/800/400';

      if (newCoverFile) {
        const safeName = sanitizeFilename(newCoverFile.name);
        const path = `groups/${Date.now()}-${safeName}`;
        const { error: uploadErr } = await supabase.storage
          .from('posts')
          .upload(path, newCoverFile);
        
        if (!uploadErr) {
          const { data: { publicUrl } } = supabase.storage.from('posts').getPublicUrl(path);
          coverUrl = publicUrl;
        }
      }

      const { data: group, error: groupErr } = await supabase
        .from('groups')
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

      if (groupErr) throw groupErr;

      // Add creator as admin member
      await supabase.from('group_members').insert({
        group_id: group.id,
        user_id: currentUser.id,
        role: 'ADMIN'
      });

      setNewName('');
      setNewDescription('');
      setOnlyAdminCanPost(false);
      setNewCoverFile(null);
      setNewCoverPreview(null);
      setView('LIST');
      fetchGroups();
    } catch (err) {
      console.error('Error creating group:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const selectGroup = async (group: Group) => {
    setSelectedGroup(group);
    setView('DETAILS');
    fetchGroupData(group.id);
  };

  const fetchGroupData = async (groupId: string) => {
    try {
      // Fetch group details to get only_admin_can_post
      const { data: groupDetails } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single();
      
      if (groupDetails) setSelectedGroup(groupDetails);

      // Check membership
      const { data: memberData } = await supabase
        .from('group_members')
        .select('*')
        .eq('group_id', groupId)
        .eq('user_id', currentUser.id)
        .maybeSingle();
      
      setIsMember(!!memberData);
      const isGroupAdmin = memberData?.role === 'ADMIN';

      // Fetch posts
      const { data: posts, error } = await supabase
        .from('group_posts')
        .select(`
          *,
          user:profiles(*),
          reactions:group_post_reactions(*, user:profiles(*))
        `)
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGroupPosts(posts || []);

      // Fetch likes and comments counts for each post
      const postsWithEngagement = await Promise.all((posts || []).map(async (p) => {
        const { count: lCount } = await supabase.from('group_post_likes').select('*', { count: 'exact', head: true }).eq('post_id', p.id);
        const { count: cCount } = await supabase.from('group_post_comments').select('*', { count: 'exact', head: true }).eq('post_id', p.id);
        const { data: myLike } = await supabase.from('group_post_likes').select('*').eq('post_id', p.id).eq('user_id', currentUser.id).maybeSingle();
        return { ...p, likes_count: lCount || 0, comments_count: cCount || 0, is_liked: !!myLike };
      }));
      setGroupPosts(postsWithEngagement);
    } catch (err) {
      console.error('Error fetching group data:', err);
    }
  };

  const joinGroup = async () => {
    if (!selectedGroup) return;
    try {
      const { error } = await supabase.from('group_members').insert({
        group_id: selectedGroup.id,
        user_id: currentUser.id
      });
      if (error) throw error;
      setIsMember(true);
      fetchGroupData(selectedGroup.id);
    } catch (err) {
      console.error('Error joining group:', err);
    }
  };

  const leaveGroup = async () => {
    if (!selectedGroup || isLeaving) return;
    if (!confirm('Are you sure you want to leave this community?')) return;
    setIsLeaving(true);
    try {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', selectedGroup.id)
        .eq('user_id', currentUser.id);
      
      if (error) throw error;
      setIsMember(false);
      fetchGroupData(selectedGroup.id);
    } catch (err) {
      console.error('Error leaving group:', err);
    } finally {
      setIsLeaving(false);
    }
  };

  const toggleLikePost = async (postId: string) => {
    const post = groupPosts.find(p => p.id === postId);
    if (!post) return;

    try {
      if (post.is_liked) {
        await supabase.from('group_post_likes').delete().eq('post_id', postId).eq('user_id', currentUser.id);
        setGroupPosts(prev => prev.map(p => p.id === postId ? { ...p, is_liked: false, likes_count: (p.likes_count || 1) - 1 } : p));
      } else {
        await supabase.from('group_post_likes').insert({ post_id: postId, user_id: currentUser.id });
        setGroupPosts(prev => prev.map(p => p.id === postId ? { ...p, is_liked: true, likes_count: (p.likes_count || 0) + 1 } : p));
      }
    } catch (err) {
      console.error('Error toggling like:', err);
    }
  };

  const fetchComments = async (postId: string) => {
    try {
      const { data, error } = await supabase
        .from('group_post_comments')
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
        .from('group_post_comments')
        .insert({
          post_id: postId,
          user_id: currentUser.id,
          content: newComment.trim()
        })
        .select('*, user:profiles(*)')
        .single();
      
      if (error) throw error;
      setComments(prev => ({ ...prev, [postId]: [...(prev[postId] || []), data] }));
      setGroupPosts(prev => prev.map(p => p.id === postId ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p));
      setNewComment('');
    } catch (err) {
      console.error('Error adding comment:', err);
    } finally {
      setIsCommenting(false);
    }
  };

  const togglePostReaction = async (postId: string, reaction: string) => {
    try {
      const { data: existing } = await supabase
        .from('group_post_reactions')
        .select('*')
        .eq('post_id', postId)
        .eq('user_id', currentUser.id)
        .eq('reaction', reaction)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('group_post_reactions')
          .delete()
          .eq('id', existing.id);
      } else {
        await supabase
          .from('group_post_reactions')
          .insert({
            post_id: postId,
            user_id: currentUser.id,
            reaction
          });
      }
      if (selectedGroup) fetchGroupData(selectedGroup.id);
    } catch (err) {
      console.error("Error toggling post reaction:", err);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postContent.trim() || !selectedGroup || isPosting) return;
    setIsPosting(true);

    try {
      let mediaUrl = null;
      let mediaType = null;

      if (postFile) {
        const safeName = sanitizeFilename(postFile.name);
        const path = `group_posts/${Date.now()}-${safeName}`;
        const { error: uploadErr } = await supabase.storage
          .from('posts')
          .upload(path, postFile);
        
        if (!uploadErr) {
          const { data: { publicUrl } } = supabase.storage.from('posts').getPublicUrl(path);
          mediaUrl = publicUrl;
          mediaType = postFile.type.startsWith('video') ? 'video' : 'image';
        }
      }

      const { error } = await supabase.from('group_posts').insert({
        group_id: selectedGroup.id,
        user_id: currentUser.id,
        content: postContent.trim(),
        media_url: mediaUrl,
        media_type: mediaType
      });

      if (error) throw error;
      setPostContent('');
      setPostFile(null);
      setPostPreview(null);
      fetchGroupData(selectedGroup.id);
    } catch (err) {
      console.error('Error creating group post:', err);
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--vix-bg)] animate-vix-in">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-[var(--vix-border)] sticky top-0 bg-[var(--vix-bg)]/80 backdrop-blur-xl z-50">
        <div className="flex items-center gap-4">
          <button onClick={view === 'LIST' ? onBack : () => setView('LIST')} className="p-3 hover:bg-[var(--vix-secondary)] rounded-2xl transition-all">
            <ArrowLeft className="w-5 h-5 text-[var(--vix-text)]" />
          </button>
          <h2 className="text-xl font-black text-[var(--vix-text)] uppercase tracking-tight">
            {view === 'LIST' ? t('Channels') : view === 'CREATE' ? t('Create Channel') : selectedGroup?.name}
          </h2>
        </div>
        {view === 'LIST' && (
          <button onClick={() => setView('CREATE')} className="vix-gradient p-3 rounded-2xl text-white shadow-lg hover:scale-105 transition-all">
            <Plus className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
        {view === 'LIST' && (
          <div className="flex flex-col">
            <div className="p-6">
              <div className="relative group">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-700 group-focus-within:text-pink-500 transition-colors" />
                <input 
                  type="text" 
                  placeholder={t('Find channels...')}
                  className="w-full bg-[var(--vix-card)] border border-[var(--vix-border)] rounded-[2rem] py-4 pl-16 pr-8 text-sm outline-none focus:border-pink-500/30 transition-all text-[var(--vix-text)] placeholder:text-zinc-500 font-bold shadow-xl"
                />
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin vix-loader" />
              </div>
            ) : groups.length === 0 ? (
              <div className="text-center py-20 space-y-4">
                <Users className="w-16 h-16 text-zinc-800 mx-auto opacity-20" />
                <p className="text-zinc-500 font-black uppercase tracking-widest text-[10px]">{t('No channels found')}</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--vix-border)]/30">
                {groups.map(group => (
                  <div 
                    key={group.id} 
                    onClick={() => selectGroup(group)}
                    className="flex items-center gap-4 p-6 hover:bg-[var(--vix-secondary)]/30 transition-all cursor-pointer group relative"
                  >
                    <div className="relative">
                      <img src={group.cover_url} className="w-14 h-14 rounded-2xl object-cover border border-[var(--vix-border)] shadow-md" alt={group.name} />
                      {group.is_verified && (
                        <div className="absolute -bottom-1 -right-1 bg-[var(--vix-bg)] rounded-full p-0.5">
                          <VerificationBadge size="w-4 h-4" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <h3 className="font-black text-sm text-[var(--vix-text)] truncate flex items-center gap-1.5">
                          {group.name}
                        </h3>
                        <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">
                          {formatNumber((group.member_count || 0) + (group.boosted_members || 0))} {t('Followers')}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500 truncate font-medium">{group.description}</p>
                    </div>
                    <div className="p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ChevronLeft className="w-4 h-4 rotate-180 text-zinc-400" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'CREATE' && (
          <form onSubmit={handleCreateGroup} className="p-6 space-y-8 max-w-lg mx-auto">
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
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 ml-2">{t('Group Name')}</label>
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
                  placeholder={t('What is this community about?')}
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
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isCreating}
              className="w-full vix-gradient py-5 rounded-[2rem] text-white font-black uppercase tracking-widest text-[11px] shadow-2xl shadow-pink-500/20 flex items-center justify-center gap-3"
            >
              {isCreating ? <Loader2 className="w-5 h-5 animate-spin vix-loader" /> : t('Establish Community')}
            </button>
          </form>
        )}

        {view === 'DETAILS' && selectedGroup && (
          <div className="flex flex-col h-full animate-vix-in bg-[#0b141a]">
            {/* WhatsApp Style Header */}
            <div className="flex items-center justify-between p-3 bg-[#111b21] border-b border-white/5 sticky top-0 z-50">
              <div className="flex items-center gap-3">
                <button onClick={() => setView('LIST')} className="p-1 hover:bg-white/10 rounded-full transition-all">
                  <ArrowLeft className="w-6 h-6 text-[#e9edef]" />
                </button>
                <div className="flex items-center gap-3 cursor-pointer">
                  <img src={selectedGroup.cover_url} className="w-10 h-10 rounded-full object-cover border border-white/10" alt={selectedGroup.name} />
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1">
                      <h3 className="text-base font-bold text-[#e9edef] leading-tight">
                        {selectedGroup.name}
                      </h3>
                      {selectedGroup.is_verified && (
                        <CheckCircle2 className="w-4 h-4 fill-[#ec4899] text-white" />
                      )}
                    </div>
                    <p className="text-[11px] text-[#8696a0] font-medium">
                      {formatNumber((selectedGroup.member_count || 0) + (selectedGroup.boosted_members || 0))} {t('followers')}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button className="p-2 text-[#8696a0] hover:text-[#e9edef] transition-all">
                  <Bell className="w-5 h-5" />
                </button>
                <button className="p-2 text-[#8696a0] hover:text-[#e9edef] transition-all">
                  <MoreHorizontal className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Channel Feed */}
            <div id="channel-feed" className="flex-1 p-4 space-y-6 overflow-y-auto no-scrollbar bg-[#0b141a] relative scroll-smooth">
              {/* Background Pattern Overlay (Optional) */}
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>

              {groupPosts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-30">
                  <MessageSquare className="w-12 h-12 text-[#e9edef]" />
                  <p className="text-[#8696a0] font-bold uppercase tracking-widest text-[10px]">{t('No updates yet')}</p>
                </div>
              ) : (
                <div className="space-y-8 relative z-10">
                  {groupPosts.map((post, index) => {
                    const postDate = new Date(post.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                    const prevPostDate = index > 0 ? new Date(groupPosts[index - 1].created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null;
                    const showDateSeparator = postDate !== prevPostDate;

                    return (
                      <React.Fragment key={post.id}>
                        {showDateSeparator && (
                          <div className="flex justify-center my-6">
                            <div className="bg-[#182229] text-[#8696a0] text-[11px] px-3 py-1 rounded-lg shadow-sm font-medium">
                              {postDate}
                            </div>
                          </div>
                        )}
                        
                        <div className="max-w-[92%] sm:max-w-[85%] mx-auto space-y-2">
                          <div className="bg-[#202c33] rounded-xl shadow-lg relative group overflow-hidden border border-white/5">
                            {post.media_url && (
                              <div className="relative">
                                {post.media_type === 'video' ? (
                                  <video src={post.media_url} controls className="w-full max-h-[500px] object-cover" />
                                ) : (
                                  <div className="relative group/media cursor-pointer">
                                    <img src={post.media_url} className="w-full max-h-[500px] object-cover" alt="Post media" />
                                    <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
                                      <div className="bg-black/40 backdrop-blur-md rounded-full px-4 py-2 flex items-center gap-2 text-white text-xs font-bold border border-white/10">
                                        <Download className="w-4 h-4" />
                                        <span>2.1 MB</span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                            
                            <div className="p-3 space-y-2">
                              {post.content && (
                                <div className="space-y-1">
                                  {/* Detect if content has a title-like first line */}
                                  {post.content.includes('\n') ? (
                                    <>
                                      <h4 className="text-[15px] font-bold text-[#e9edef] leading-tight">
                                        {post.content.split('\n')[0]}
                                      </h4>
                                      <p className="text-[14px] text-[#e9edef] leading-snug whitespace-pre-wrap font-normal opacity-90">
                                        {post.content.split('\n').slice(1).join('\n')}
                                      </p>
                                    </>
                                  ) : (
                                    <p className="text-[14.5px] text-[#e9edef] leading-snug whitespace-pre-wrap font-normal">
                                      {post.content}
                                    </p>
                                  )}
                                  
                                  {post.content.toLowerCase().includes('http') && (
                                    <div className="pt-2">
                                      <p className="text-[14px] text-[#53bdeb] hover:underline cursor-pointer">
                                        Learn more: {post.content.match(/https?:\/\/[^\s]+/)?.[0]}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
                              
                              <div className="flex items-center justify-end gap-1">
                                <span className="text-[10px] text-[#8696a0] font-medium">
                                  {new Date(post.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                                </span>
                              </div>
                            </div>

                            {/* Reactions & Share Bar */}
                            <div className="flex items-center justify-between px-3 pb-3">
                              <div className="flex items-center gap-1 bg-[#182229] rounded-full px-2.5 py-1 border border-white/5 shadow-sm cursor-pointer hover:bg-[#2a3942] transition-colors">
                                <div className="flex -space-x-1">
                                  {['👍', '❤️', '🙏', '😂'].slice(0, 3).map((emoji, i) => (
                                    <span key={i} className="text-[13px]">{emoji}</span>
                                  ))}
                                </div>
                                <span className="text-[12px] text-[#8696a0] font-bold ml-1.5">
                                  {formatNumber((post.likes_count || 0) + 42000)}
                                </span>
                              </div>
                              
                              <button className="p-2 bg-[#182229] rounded-full text-[#8696a0] hover:text-[#e9edef] transition-all border border-white/5">
                                <Share2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Floating Scroll to Bottom Button */}
            <button 
              onClick={() => document.getElementById('channel-feed')?.scrollTo({ top: document.getElementById('channel-feed')?.scrollHeight, behavior: 'smooth' })}
              className="absolute bottom-24 right-6 p-2 bg-[#202c33] text-[#8696a0] rounded-full shadow-lg border border-white/5 hover:text-[#e9edef] transition-all z-20"
            >
              <ChevronLeft className="w-5 h-5 -rotate-90" />
            </button>

            {/* Broadcast Input (Admin Only) */}
            {isMember && (!selectedGroup.only_admin_can_post || selectedGroup.creator_id === currentUser.id) ? (
              <div className="p-3 bg-[#111b21] border-t border-white/5">
                <div className="flex items-end gap-2 max-w-3xl mx-auto">
                  <div className="flex-1 bg-[#2a3942] rounded-2xl flex flex-col p-1">
                    {postPreview && (
                      <div className="relative w-20 h-20 m-2 rounded-lg overflow-hidden border border-white/10">
                        <button onClick={() => { setPostFile(null); setPostPreview(null); }} className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full z-10"><X className="w-3 h-3" /></button>
                        {postFile?.type.startsWith('video') ? <video src={postPreview} className="w-full h-full object-cover" /> : <img src={postPreview} className="w-full h-full object-cover" />}
                      </div>
                    )}
                    <div className="flex items-center">
                      <button 
                        onClick={() => document.getElementById('channel-post-media')?.click()}
                        className="p-3 text-[#8696a0] hover:text-[#e9edef] transition-all"
                      >
                        <ImageIcon className="w-6 h-6" />
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
                        className="flex-1 bg-transparent border-none py-3 px-1 text-[15px] text-[#e9edef] outline-none placeholder:text-[#8696a0] resize-none max-h-32"
                        rows={1}
                      />
                    </div>
                  </div>

                  <button 
                    onClick={handleCreatePost}
                    disabled={!postContent.trim() || isPosting}
                    className="bg-[#00a884] p-3.5 rounded-full text-white shadow-lg disabled:opacity-50 transition-all flex-shrink-0"
                  >
                    {isPosting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-6 h-6" />}
                  </button>
                </div>
              </div>
            ) : isMember && selectedGroup.only_admin_can_post ? (
              <div className="p-4 bg-[#111b21] text-center border-t border-white/5">
                <p className="text-[12px] text-[#8696a0] font-medium">
                  {t('Only administrators can send messages to this channel')}
                </p>
              </div>
            ) : !isMember && (
              <div className="p-4 bg-[#111b21] border-t border-white/5 text-center">
                <button 
                  onClick={joinGroup}
                  className="bg-[#00a884] px-10 py-3 rounded-full text-white text-sm font-bold shadow-xl hover:scale-105 transition-all"
                >
                  {t('Follow to see updates')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Groups;
