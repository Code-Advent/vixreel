
import React, { useState, useEffect } from 'react';
import { 
  Users, Plus, Search, Globe, Lock, ArrowLeft, 
  MoreHorizontal, MessageSquare, Image as ImageIcon, 
  Video, Send, Heart, X, Loader2, Camera, Shield, ChevronLeft,
  Link as LinkIcon, CheckCircle2
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
    if (initialGroup) {
      fetchGroupData(initialGroup.id);
    }
  }, [initialGroup]);

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
            {view === 'LIST' ? t('Communities') : view === 'CREATE' ? t('New Group') : selectedGroup?.name}
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
          <div className="p-6 space-y-8">
            <div className="relative group">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-700 group-focus-within:text-pink-500 transition-colors" />
              <input 
                type="text" 
                placeholder={t('Search communities...')}
                className="w-full bg-[var(--vix-card)] border border-[var(--vix-border)] rounded-[2rem] py-5 pl-16 pr-8 text-sm outline-none focus:border-pink-500/30 transition-all text-[var(--vix-text)] placeholder:text-zinc-500 font-bold shadow-xl"
              />
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
              </div>
            ) : groups.length === 0 ? (
              <div className="text-center py-20 space-y-4">
                <Users className="w-16 h-16 text-zinc-800 mx-auto opacity-20" />
                <p className="text-zinc-500 font-black uppercase tracking-widest text-[10px]">{t('No communities found')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                {groups.map(group => (
                  <div 
                    key={group.id} 
                    onClick={() => selectGroup(group)}
                    className="bg-[var(--vix-card)] border border-[var(--vix-border)] rounded-[3rem] overflow-hidden shadow-2xl hover:border-pink-500/30 transition-all cursor-pointer group relative flex flex-col h-full"
                  >
                    <div className="h-48 relative overflow-hidden">
                      <img src={group.cover_url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={group.name} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      <div className="absolute top-4 right-4 flex gap-2">
                        <div className="bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 flex items-center gap-1.5">
                          {group.privacy === 'PRIVATE' ? <Lock className="w-3 h-3 text-white" /> : <Globe className="w-3 h-3 text-white" />}
                          <span className="text-[8px] text-white font-black uppercase tracking-widest">{t(group.privacy)}</span>
                        </div>
                        {group.only_admin_can_post && (
                          <div className="bg-purple-500/80 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 flex items-center gap-1.5">
                            <Shield className="w-3 h-3 text-white" />
                            <span className="text-[8px] text-white font-black uppercase tracking-widest">{t('Admin Only')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="p-8 flex-1 flex flex-col justify-between space-y-6">
                      <div className="space-y-3">
                        <h3 className="text-xl font-black text-[var(--vix-text)] group-hover:text-pink-500 transition-colors leading-tight flex items-center gap-2">
                          {group.name} {group.is_verified && <VerificationBadge size="w-4 h-4" />}
                        </h3>
                        <p className="text-xs text-zinc-500 line-clamp-3 leading-relaxed font-medium">{group.description}</p>
                      </div>
                      <div className="flex items-center justify-between pt-6 border-t border-[var(--vix-border)]">
                        <div className="flex items-center gap-3">
                          <div className="flex -space-x-2">
                            {[1,2,3].map(i => (
                              <div key={i} className="w-6 h-6 rounded-full border-2 border-[var(--vix-card)] bg-[var(--vix-secondary)] overflow-hidden">
                                <img src={`https://picsum.photos/seed/${group.id}${i}/50/50`} className="w-full h-full object-cover" />
                              </div>
                            ))}
                          </div>
                          <span className="text-[10px] text-zinc-700 font-black uppercase tracking-widest">
                            {formatNumber((group.member_count || 0) + (group.boosted_members || 0))} {t('Members')}
                          </span>
                        </div>
                        <div className="w-10 h-10 rounded-2xl bg-[var(--vix-secondary)] flex items-center justify-center group-hover:bg-pink-500 group-hover:text-white transition-all shadow-lg">
                          <ChevronLeft className="w-4 h-4 rotate-180" />
                        </div>
                      </div>
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
              className="w-full vix-gradient py-5 rounded-[2rem] text-white font-black uppercase tracking-widest text-[11px] shadow-2xl flex items-center justify-center gap-3"
            >
              {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : t('Establish Community')}
            </button>
          </form>
        )}

        {view === 'DETAILS' && selectedGroup && (
          <div className="animate-vix-in">
            {/* Group Header */}
            <div className="h-48 relative">
              <img src={selectedGroup.cover_url} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between">
                <div className="space-y-1">
                  <h3 className="text-2xl font-black text-white flex items-center gap-2">
                    {selectedGroup.name}
                    {selectedGroup.is_verified && <VerificationBadge size="w-5 h-5" />}
                  </h3>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3 h-3 text-white/70" />
                      <span className="text-[10px] text-white/70 font-black uppercase tracking-widest">
                        {formatNumber((selectedGroup.member_count || 0) + (selectedGroup.boosted_members || 0))} {t('Members')}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {selectedGroup.privacy === 'PRIVATE' ? <Lock className="w-3 h-3 text-white/70" /> : <Globe className="w-3 h-3 text-white/70" />}
                      <span className="text-[10px] text-white/70 font-black uppercase tracking-widest">{t(selectedGroup.privacy)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => copyGroupLink(selectedGroup.id)}
                    className="bg-white/10 backdrop-blur-md border border-white/20 p-3 rounded-2xl text-white hover:bg-white/20 transition-all"
                    title={t('Copy Link')}
                  >
                    <LinkIcon className="w-5 h-5" />
                  </button>
                  {isMember ? (
                    <button 
                      onClick={leaveGroup}
                      disabled={isLeaving}
                      className="bg-white/10 backdrop-blur-md border border-white/20 px-8 py-3 rounded-2xl text-white text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-all"
                    >
                      {isLeaving ? <Loader2 className="w-4 h-4 animate-spin" /> : t('Joined')}
                    </button>
                  ) : (
                    <button 
                      onClick={joinGroup}
                      className="vix-gradient px-8 py-3 rounded-2xl text-white text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-all"
                    >
                      {t('Join')}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 space-y-8">
              {/* Post Composer */}
              {isMember && (!selectedGroup.only_admin_can_post || selectedGroup.creator_id === currentUser.id) ? (
                <div className="bg-[var(--vix-card)] border border-[var(--vix-border)] rounded-[2.5rem] p-6 shadow-xl space-y-4">
                  <div className="flex gap-4">
                    <img src={currentUser.avatar_url} className="w-12 h-12 rounded-full object-cover border-2 border-[var(--vix-border)]" />
                    <textarea 
                      value={postContent}
                      onChange={e => setPostContent(e.target.value)}
                      placeholder={`${t('Share something with')} ${selectedGroup.name}...`}
                      className="flex-1 bg-transparent border-none outline-none text-sm text-[var(--vix-text)] resize-none py-2 min-h-[80px]"
                    />
                  </div>
                  
                  {postPreview && (
                    <div className="relative rounded-2xl overflow-hidden border border-[var(--vix-border)]">
                      <button 
                        onClick={() => { setPostFile(null); setPostPreview(null); }}
                        className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-black/70 transition-all z-10"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      {postFile?.type.startsWith('video') ? (
                        <video src={postPreview} className="w-full max-h-60 object-cover" />
                      ) : (
                        <img src={postPreview} className="w-full max-h-60 object-cover" />
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t border-[var(--vix-border)]">
                    <div className="flex gap-2">
                      <button 
                        onClick={() => document.getElementById('group-post-media')?.click()}
                        className="p-3 bg-[var(--vix-secondary)] rounded-xl text-zinc-700 hover:text-pink-500 transition-all"
                      >
                        <ImageIcon className="w-5 h-5" />
                      </button>
                      <input 
                        id="group-post-media"
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
                    </div>
                    <button 
                      onClick={handleCreatePost}
                      disabled={!postContent.trim() || isPosting}
                      className="vix-gradient px-8 py-3 rounded-2xl text-white text-[10px] font-black uppercase tracking-widest shadow-xl disabled:opacity-50 disabled:scale-100 hover:scale-105 transition-all flex items-center gap-2"
                    >
                      {isPosting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> {t('Post')}</>}
                    </button>
                  </div>
                </div>
              ) : isMember && selectedGroup.only_admin_can_post ? (
                <div className="bg-[var(--vix-secondary)]/30 border border-dashed border-[var(--vix-border)] rounded-[2rem] p-6 text-center">
                  <Shield className="w-6 h-6 text-zinc-600 mx-auto mb-2" />
                  <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest">
                    {t('Only administrators can broadcast in this community')}
                  </p>
                </div>
              ) : null}

              {/* Group Posts */}
              <div className="space-y-6">
                {groupPosts.length === 0 ? (
                  <div className="text-center py-20 space-y-4">
                    <MessageSquare className="w-12 h-12 text-zinc-800 mx-auto opacity-20" />
                    <p className="text-zinc-500 font-black uppercase tracking-widest text-[10px]">{t('No posts yet')}</p>
                  </div>
                ) : (
                  groupPosts.map(post => (
                    <div key={post.id} className="bg-[var(--vix-card)] border border-[var(--vix-border)] rounded-[2.5rem] p-6 shadow-xl space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <img src={post.user?.avatar_url} className="w-10 h-10 rounded-full object-cover border-2 border-[var(--vix-border)]" />
                          <div>
                            <p className="text-sm font-black text-[var(--vix-text)]">@{post.user?.username}</p>
                            <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">
                              {new Date(post.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <button className="p-2 text-zinc-500 hover:text-[var(--vix-text)]">
                          <MoreHorizontal className="w-5 h-5" />
                        </button>
                      </div>
                      <p className="text-sm text-[var(--vix-text)] leading-relaxed">{post.content}</p>
                      {post.media_url && (
                        <div className="rounded-3xl overflow-hidden border border-[var(--vix-border)] shadow-inner">
                          {post.media_type === 'video' ? (
                            <video src={post.media_url} controls className="w-full object-cover" />
                          ) : (
                            <img src={post.media_url} className="w-full object-cover" />
                          )}
                        </div>
                      )}
                      <div className="flex flex-col gap-4 pt-2">
                        <div className="flex items-center gap-6">
                          <button 
                            onClick={() => toggleLikePost(post.id)}
                            className={`flex items-center gap-2 transition-colors ${post.is_liked ? 'text-pink-500' : 'text-zinc-500 hover:text-pink-500'}`}
                          >
                            <Heart className={`w-5 h-5 ${post.is_liked ? 'fill-current' : ''}`} />
                            <span className="text-[10px] font-black uppercase tracking-widest">{formatNumber(post.likes_count || 0)} {t('Likes')}</span>
                          </button>
                          <button 
                            onClick={() => {
                              if (activeCommentPostId === post.id) {
                                setActiveCommentPostId(null);
                              } else {
                                setActiveCommentPostId(post.id);
                                fetchComments(post.id);
                              }
                            }}
                            className="flex items-center gap-2 text-zinc-500 hover:text-blue-500 transition-colors"
                          >
                            <MessageSquare className="w-5 h-5" />
                            <span className="text-[10px] font-black uppercase tracking-widest">{formatNumber(post.comments_count || 0)} {t('Comments')}</span>
                          </button>
                          
                          <div className="flex items-center gap-2 ml-auto">
                            {['❤️', '🔥', '🙌', '😂', '😮', '😢'].map(emoji => (
                              <button
                                key={emoji}
                                onClick={() => togglePostReaction(post.id, emoji)}
                                className="text-lg hover:scale-125 transition-transform"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Reactions Display */}
                        {post.reactions && post.reactions.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(
                              post.reactions.reduce((acc: any, r) => {
                                acc[r.reaction] = (acc[r.reaction] || 0) + 1;
                                return acc;
                              }, {})
                            ).map(([emoji, count]: [string, any]) => (
                              <div 
                                key={emoji}
                                className="bg-[var(--vix-secondary)] px-2 py-1 rounded-full flex items-center gap-1.5 border border-[var(--vix-border)]"
                              >
                                <span className="text-xs">{emoji}</span>
                                <span className="text-[9px] font-black text-zinc-600">{formatNumber(count)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Comments Section */}
                      {activeCommentPostId === post.id && (
                        <div className="pt-4 border-t border-[var(--vix-border)] space-y-4 animate-vix-in">
                          <div className="space-y-3 max-h-60 overflow-y-auto no-scrollbar">
                            {comments[post.id]?.map(comment => (
                              <div key={comment.id} className="flex gap-3">
                                <img src={comment.user?.avatar_url} className="w-8 h-8 rounded-full object-cover" />
                                <div className="flex-1 bg-[var(--vix-secondary)] rounded-2xl p-3">
                                  <p className="text-[10px] font-black text-[var(--vix-text)]">@{comment.user?.username}</p>
                                  <p className="text-[11px] text-zinc-600">{comment.content}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <input 
                              type="text" 
                              value={newComment}
                              onChange={e => setNewComment(e.target.value)}
                              placeholder={t('Write a comment...')}
                              className="flex-1 bg-[var(--vix-secondary)] border border-[var(--vix-border)] rounded-xl px-4 py-2 text-xs outline-none focus:border-pink-500/30 transition-all"
                              onKeyDown={e => e.key === 'Enter' && handleAddComment(post.id)}
                            />
                            <button 
                              onClick={() => handleAddComment(post.id)}
                              disabled={!newComment.trim() || isCommenting}
                              className="p-2 text-pink-500 hover:bg-pink-500/10 rounded-xl transition-all disabled:opacity-50"
                            >
                              <Send className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Groups;
