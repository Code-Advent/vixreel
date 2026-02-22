
import React, { useState, useEffect } from 'react';
import { 
  Users, Plus, Search, Globe, Lock, ArrowLeft, 
  MoreHorizontal, MessageSquare, Image as ImageIcon, 
  Video, Send, Heart, X, Loader2, Camera
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { UserProfile, Group, GroupMember, GroupPost } from '../types';
import { sanitizeFilename } from '../lib/utils';

interface GroupsProps {
  currentUser: UserProfile;
  onBack: () => void;
  initialGroup?: Group | null;
}

const Groups: React.FC<GroupsProps> = ({ currentUser, onBack, initialGroup }) => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'LIST' | 'CREATE' | 'DETAILS'>(initialGroup ? 'DETAILS' : 'LIST');
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(initialGroup || null);
  const [groupPosts, setGroupPosts] = useState<GroupPost[]>([]);
  const [isMember, setIsMember] = useState(false);
  
  // Create Group State
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPrivacy, setNewPrivacy] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [newCoverFile, setNewCoverFile] = useState<File | null>(null);
  const [newCoverPreview, setNewCoverPreview] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Post State
  const [postContent, setPostContent] = useState('');
  const [postFile, setPostFile] = useState<File | null>(null);
  const [postPreview, setPostPreview] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);

  useEffect(() => {
    fetchGroups();
    if (initialGroup) {
      fetchGroupData(initialGroup.id);
    }
  }, [initialGroup]);

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
      // Check membership
      const { data: memberData } = await supabase
        .from('group_members')
        .select('*')
        .eq('group_id', groupId)
        .eq('user_id', currentUser.id)
        .maybeSingle();
      
      setIsMember(!!memberData);

      // Fetch posts
      const { data: posts, error } = await supabase
        .from('group_posts')
        .select(`
          *,
          user:profiles(*)
        `)
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGroupPosts(posts || []);
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
            {view === 'LIST' ? 'Communities' : view === 'CREATE' ? 'New Group' : selectedGroup?.name}
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
          <div className="p-6 space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
              </div>
            ) : groups.length === 0 ? (
              <div className="text-center py-20 space-y-4">
                <Users className="w-16 h-16 text-zinc-800 mx-auto opacity-20" />
                <p className="text-zinc-500 font-black uppercase tracking-widest text-[10px]">No communities found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {groups.map(group => (
                  <div 
                    key={group.id} 
                    onClick={() => selectGroup(group)}
                    className="bg-[var(--vix-card)] border border-[var(--vix-border)] rounded-[2.5rem] overflow-hidden shadow-xl hover:border-pink-500/30 transition-all cursor-pointer group"
                  >
                    <div className="h-32 relative">
                      <img src={group.cover_url} className="w-full h-full object-cover" alt={group.name} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute bottom-4 left-6 flex items-center gap-2">
                        {group.privacy === 'PRIVATE' ? <Lock className="w-3 h-3 text-white/70" /> : <Globe className="w-3 h-3 text-white/70" />}
                        <span className="text-[9px] text-white/70 font-black uppercase tracking-widest">{group.privacy}</span>
                      </div>
                    </div>
                    <div className="p-6 space-y-2">
                      <h3 className="text-lg font-black text-[var(--vix-text)] group-hover:text-pink-500 transition-colors">{group.name}</h3>
                      <p className="text-[11px] text-zinc-500 line-clamp-2">{group.description}</p>
                      <div className="flex items-center justify-between pt-4 border-t border-[var(--vix-border)]">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-zinc-700" />
                          <span className="text-[10px] text-zinc-700 font-black uppercase tracking-widest">{group.member_count} Members</span>
                        </div>
                        <span className="text-[9px] text-zinc-800 font-black uppercase tracking-widest bg-[var(--vix-secondary)] px-3 py-1 rounded-full">View</span>
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
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 ml-2">Cover Image</label>
              <div 
                onClick={() => document.getElementById('cover-input')?.click()}
                className="h-48 rounded-[2.5rem] border-2 border-dashed border-[var(--vix-border)] flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-pink-500/30 transition-all overflow-hidden relative"
              >
                {newCoverPreview ? (
                  <img src={newCoverPreview} className="w-full h-full object-cover" />
                ) : (
                  <>
                    <Camera className="w-8 h-8 text-zinc-800" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-700">Upload Cover</span>
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
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 ml-2">Group Name</label>
                <input 
                  type="text" 
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. VixReel Creators"
                  className="w-full bg-[var(--vix-card)] border border-[var(--vix-border)] rounded-2xl py-4 px-6 text-sm text-[var(--vix-text)] outline-none focus:border-pink-500/50 transition-all"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 ml-2">Description</label>
                <textarea 
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  placeholder="What is this community about?"
                  className="w-full bg-[var(--vix-card)] border border-[var(--vix-border)] rounded-2xl py-4 px-6 text-sm text-[var(--vix-text)] outline-none focus:border-pink-500/50 transition-all min-h-[120px] resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600 ml-2">Privacy</label>
                <div className="flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setNewPrivacy('PUBLIC')}
                    className={`flex-1 py-4 rounded-2xl border transition-all flex items-center justify-center gap-2 ${newPrivacy === 'PUBLIC' ? 'bg-pink-500 text-white border-pink-500 shadow-lg' : 'bg-[var(--vix-card)] border-[var(--vix-border)] text-zinc-600'}`}
                  >
                    <Globe className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Public</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => setNewPrivacy('PRIVATE')}
                    className={`flex-1 py-4 rounded-2xl border transition-all flex items-center justify-center gap-2 ${newPrivacy === 'PRIVATE' ? 'bg-pink-500 text-white border-pink-500 shadow-lg' : 'bg-[var(--vix-card)] border-[var(--vix-border)] text-zinc-600'}`}
                  >
                    <Lock className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Private</span>
                  </button>
                </div>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isCreating}
              className="w-full vix-gradient py-5 rounded-[2rem] text-white font-black uppercase tracking-widest text-[11px] shadow-2xl flex items-center justify-center gap-3"
            >
              {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Establish Community'}
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
                  <h3 className="text-2xl font-black text-white">{selectedGroup.name}</h3>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3 h-3 text-white/70" />
                      <span className="text-[10px] text-white/70 font-black uppercase tracking-widest">{selectedGroup.member_count} Members</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {selectedGroup.privacy === 'PRIVATE' ? <Lock className="w-3 h-3 text-white/70" /> : <Globe className="w-3 h-3 text-white/70" />}
                      <span className="text-[10px] text-white/70 font-black uppercase tracking-widest">{selectedGroup.privacy}</span>
                    </div>
                  </div>
                </div>
                {!isMember && (
                  <button 
                    onClick={joinGroup}
                    className="vix-gradient px-8 py-3 rounded-2xl text-white text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-all"
                  >
                    Join
                  </button>
                )}
              </div>
            </div>

            <div className="p-6 space-y-8">
              {/* Post Composer */}
              {isMember && (
                <div className="bg-[var(--vix-card)] border border-[var(--vix-border)] rounded-[2.5rem] p-6 shadow-xl space-y-4">
                  <div className="flex gap-4">
                    <img src={currentUser.avatar_url} className="w-12 h-12 rounded-full object-cover border-2 border-[var(--vix-border)]" />
                    <textarea 
                      value={postContent}
                      onChange={e => setPostContent(e.target.value)}
                      placeholder={`Share something with ${selectedGroup.name}...`}
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
                      {isPosting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Post</>}
                    </button>
                  </div>
                </div>
              )}

              {/* Group Posts */}
              <div className="space-y-6">
                {groupPosts.length === 0 ? (
                  <div className="text-center py-20 space-y-4">
                    <MessageSquare className="w-12 h-12 text-zinc-800 mx-auto opacity-20" />
                    <p className="text-zinc-500 font-black uppercase tracking-widest text-[10px]">No posts yet</p>
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
                      <div className="flex items-center gap-6 pt-2">
                        <button className="flex items-center gap-2 text-zinc-500 hover:text-pink-500 transition-colors">
                          <Heart className="w-5 h-5" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Like</span>
                        </button>
                        <button className="flex items-center gap-2 text-zinc-500 hover:text-blue-500 transition-colors">
                          <MessageSquare className="w-5 h-5" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Comment</span>
                        </button>
                      </div>
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
