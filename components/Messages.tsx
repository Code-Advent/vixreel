
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Send, User, ChevronLeft, MessageCircle, Loader2, Search, Plus, X, Image as ImageIcon, Smile, MoreVertical, Trash2 } from 'lucide-react';
import EmojiPicker, { EmojiClickData, Theme as EmojiTheme } from 'emoji-picker-react';
import { supabase } from '../lib/supabase';
import { UserProfile, Message, MessageReaction } from '../types';
import VerificationBadge from './VerificationBadge';
import { useTranslation } from '../lib/translation';
import { sanitizeFilename } from '../lib/utils';

interface MessagesProps {
  currentUser: UserProfile;
  initialChatUser?: UserProfile | null;
}

interface ChatPreview extends UserProfile {
  last_message?: string;
  last_message_at?: string;
  unread_count?: number;
}

const Messages: React.FC<MessagesProps> = ({ currentUser, initialChatUser }) => {
  const { t } = useTranslation();
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [activeChat, setActiveChat] = useState<UserProfile | null>(initialChatUser || null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  
  // Media State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // UI State
  const [showFullEmojiPicker, setShowFullEmojiPicker] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const REACTION_OPTIONS = ['❤️', '👍', '🔥', '😂', '😮', '😢'];

  // 1. Fetch Chat List
  const fetchChats = async () => {
    try {
      const { data: msgs, error } = await supabase
        .from('messages')
        .select('*, sender:profiles!sender_id(*), receiver:profiles!receiver_id(*)')
        .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!msgs) return;

      const uniqueUsersMap = new Map<string, ChatPreview>();
      
      if (initialChatUser && !uniqueUsersMap.has(initialChatUser.id)) {
        uniqueUsersMap.set(initialChatUser.id, { ...initialChatUser });
      }

      msgs.forEach(m => {
        const otherUser = m.sender_id === currentUser.id ? m.receiver : m.sender;
        if (otherUser && !uniqueUsersMap.has(otherUser.id)) {
          uniqueUsersMap.set(otherUser.id, {
            ...otherUser,
            last_message: m.content || (m.media_url ? '📷 Media' : ''),
            last_message_at: m.created_at
          });
        }
      });
      
      setChats(Array.from(uniqueUsersMap.values()));
    } catch (err) {
      console.error("Chat fetch error:", err);
    }
  };

  // 2. Fetch Messages for Active Chat
  const fetchMessages = async () => {
    if (!activeChat) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*, reactions:message_reactions(*)')
        .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${activeChat.id}),and(sender_id.eq.${activeChat.id},receiver_id.eq.${currentUser.id})`)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      setMessages(data || []);
    } catch (err) {
      console.error("Message fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  // 3. Real-time Subscriptions
  useEffect(() => {
    fetchChats();
    
    const channel = supabase
      .channel(`vix-messages-${currentUser.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newMsg = payload.new as Message;
          if (activeChat && (
            (newMsg.sender_id === activeChat.id && newMsg.receiver_id === currentUser.id) ||
            (newMsg.sender_id === currentUser.id && newMsg.receiver_id === activeChat.id)
          )) {
            setMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          }
        }
        fetchChats();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, () => {
        fetchMessages();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeChat?.id, currentUser.id]);

  useEffect(() => {
    if (activeChat) fetchMessages();
  }, [activeChat?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 4. Actions
  const handleSearchUsers = async (val: string) => {
    setSearchQuery(val);
    if (val.length < 2) { return setSearchResults([]); }
    setIsSearching(true);
    try {
      const { data } = await supabase.from('profiles').select('*').neq('id', currentUser.id).ilike('username', `%${val}%`).limit(10);
      setSearchResults(data || []);
    } finally { setIsSearching(false); }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setMediaPreview(URL.createObjectURL(file));
    }
  };

  const toggleReaction = async (messageId: string, reaction: string) => {
    try {
      const { data: existing } = await supabase.from('message_reactions').select('*').eq('message_id', messageId).eq('user_id', currentUser.id).eq('reaction', reaction).maybeSingle();
      if (existing) {
        await supabase.from('message_reactions').delete().eq('id', existing.id);
      } else {
        await supabase.from('message_reactions').insert({ message_id: messageId, user_id: currentUser.id, reaction });
      }
      setShowReactionPicker(null);
    } catch (err) { console.error("Reaction error:", err); }
  };

  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!text.trim() && !selectedFile) || !activeChat || isUploading) return;
    
    const msgContent = text.trim();
    const fileToUpload = selectedFile;
    
    setText('');
    setSelectedFile(null);
    setMediaPreview(null);
    setIsUploading(true);

    try {
      let mediaUrl = null;
      let mediaType = null;

      if (fileToUpload) {
        const safeName = sanitizeFilename(fileToUpload.name);
        const path = `${currentUser.id}/${Date.now()}-${safeName}`;
        const { error: uploadErr } = await supabase.storage.from('messages').upload(path, fileToUpload);
        if (uploadErr) throw uploadErr;
        const { data: { publicUrl } } = supabase.storage.from('messages').getPublicUrl(path);
        mediaUrl = publicUrl;
        mediaType = fileToUpload.type.startsWith('video') ? 'video' : 'image';
      }

      const { data, error } = await supabase.from('messages').insert({
        sender_id: currentUser.id,
        receiver_id: activeChat.id,
        content: msgContent || null,
        media_url: mediaUrl,
        media_type: mediaType
      }).select().single();
      
      if (error) throw error;
      setMessages(prev => [...prev, data]);
    } catch (err) {
      console.error("Send error:", err);
      setText(msgContent);
    } finally { setIsUploading(false); }
  };

  return (
    <div className="max-w-[1100px] mx-auto h-[90vh] flex flex-col md:flex-row bg-[var(--vix-bg)] border border-[var(--vix-border)] rounded-[2.5rem] overflow-hidden shadow-2xl mt-4 animate-vix-in">
      
      {/* Sidebar */}
      <div className={`w-full md:w-80 border-r border-[var(--vix-border)] flex flex-col ${activeChat ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-8 border-b border-[var(--vix-border)] flex items-center justify-between bg-[var(--vix-secondary)]/10">
          <h2 className="text-xl font-black uppercase tracking-tighter text-[var(--vix-text)]">{t('Messages')}</h2>
          <button onClick={() => setShowNewChatModal(true)} className="p-3 bg-[var(--vix-secondary)] rounded-2xl text-pink-500 hover:scale-110 transition-all shadow-lg active:scale-95">
            <Plus className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto no-scrollbar divide-y divide-[var(--vix-border)]/20">
          {chats.length > 0 ? chats.map(u => (
            <div 
              key={u.id} 
              onClick={() => setActiveChat(u)}
              className={`flex items-center gap-4 p-6 cursor-pointer transition-all relative group ${activeChat?.id === u.id ? 'bg-[var(--vix-secondary)]/40' : 'hover:bg-[var(--vix-secondary)]/20'}`}
            >
              {activeChat?.id === u.id && <div className="absolute left-0 top-0 bottom-0 w-1 vix-gradient"></div>}
              <img src={u.avatar_url || `https://ui-avatars.com/api/?name=${u.username}`} className="w-12 h-12 rounded-full border border-[var(--vix-border)] object-cover shadow-md" />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-sm truncate text-[var(--vix-text)]">@{u.username}</span>
                  {u.last_message_at && <span className="text-[9px] text-zinc-500 font-bold">{new Date(u.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                </div>
                <p className="text-[11px] text-zinc-500 truncate">{u.last_message || t('New conversation')}</p>
              </div>
            </div>
          )) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center opacity-30">
              <MessageCircle className="w-12 h-12 mb-4" />
              <p className="text-xs font-bold uppercase tracking-widest">{t('No messages yet')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`flex-1 flex flex-col relative ${!activeChat ? 'hidden md:flex items-center justify-center' : 'flex'}`}>
        {activeChat ? (
          <>
            {/* Chat Header */}
            <div className="p-6 border-b border-[var(--vix-border)] flex items-center justify-between bg-[var(--vix-bg)]/80 backdrop-blur-xl z-20">
              <div className="flex items-center gap-4">
                <button onClick={() => setActiveChat(null)} className="md:hidden p-2 text-zinc-500"><ChevronLeft className="w-6 h-6" /></button>
                <img src={activeChat.avatar_url || `https://ui-avatars.com/api/?name=${activeChat.username}`} className="w-10 h-10 rounded-full border border-[var(--vix-border)] object-cover" />
                <div>
                  <h3 className="font-black text-sm flex items-center gap-1.5">
                    {activeChat.username} {activeChat.is_verified && <VerificationBadge size="w-3.5 h-3.5" />}
                  </h3>
                  <span className="text-[10px] text-green-500 font-bold uppercase tracking-widest">{t('Online')}</span>
                </div>
              </div>
            </div>

            {/* Messages List */}
            <div className="flex-1 p-6 overflow-y-auto space-y-6 no-scrollbar" dir="ltr">
              {loading && messages.length === 0 ? (
                <div className="h-full flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-zinc-800" /></div>
              ) : (
                messages.map((m, i) => {
                  const isOwn = m.sender_id === currentUser.id;
                  return (
                    <div key={m.id} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} animate-vix-in`}>
                      <div 
                        dir="auto"
                        className={`group relative max-w-[80%] p-4 px-6 rounded-[2rem] text-[13px] font-medium shadow-xl transition-all ${
                        isOwn ? 'vix-gradient text-white rounded-tr-none' : 'bg-[var(--vix-secondary)] text-[var(--vix-text)] rounded-tl-none border border-[var(--vix-border)]'
                      }`}>
                        {m.media_url && (
                          <div className="mb-2 rounded-xl overflow-hidden border border-white/10">
                            {m.media_type === 'video' ? <video src={m.media_url} controls className="max-h-60" /> : <img src={m.media_url} className="max-h-60" />}
                          </div>
                        )}
                        {m.content}
                        
                        {/* Reaction Trigger */}
                        <button 
                          onClick={() => setShowReactionPicker(showReactionPicker === m.id ? null : m.id)}
                          className={`absolute ${isOwn ? '-left-8' : '-right-8'} top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all text-zinc-500 hover:text-pink-500`}
                        >
                          <Smile className="w-4 h-4" />
                        </button>

                        {/* Reactions Display */}
                        {m.reactions && m.reactions.length > 0 && (
                          <div className={`absolute -bottom-3 ${isOwn ? 'right-2' : 'left-2'} flex gap-1`}>
                            {Array.from(new Set(m.reactions.map(r => r.reaction))).map(emoji => (
                              <div key={emoji} className="bg-[var(--vix-card)] border border-[var(--vix-border)] rounded-full px-1.5 py-0.5 text-[10px] shadow-lg">
                                {emoji} <span className="text-[8px] opacity-50">{m.reactions?.filter(r => r.reaction === emoji).length}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Reaction Picker */}
                        {showReactionPicker === m.id && (
                          <div className={`absolute ${isOwn ? '-left-48' : '-right-48'} top-1/2 -translate-y-1/2 bg-[var(--vix-card)] border border-[var(--vix-border)] rounded-full p-1.5 flex gap-1 shadow-2xl z-50 animate-vix-in`}>
                            {REACTION_OPTIONS.map(emoji => (
                              <button key={emoji} onClick={() => toggleReaction(m.id, emoji)} className="w-7 h-7 flex items-center justify-center hover:bg-[var(--vix-secondary)] rounded-full transition-all text-base">{emoji}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} className="h-4" />
            </div>

            {/* Input Area */}
            <form onSubmit={sendMessage} className="p-6 bg-[var(--vix-secondary)]/10 border-t border-[var(--vix-border)] flex flex-col gap-4">
              {mediaPreview && (
                <div className="relative w-24 h-24 rounded-xl overflow-hidden border border-[var(--vix-border)] shadow-lg animate-vix-in">
                  <button type="button" onClick={() => { setSelectedFile(null); setMediaPreview(null); }} className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full"><X className="w-3 h-3" /></button>
                  {selectedFile?.type.startsWith('video') ? <video src={mediaPreview} className="w-full h-full object-cover" /> : <img src={mediaPreview} className="w-full h-full object-cover" />}
                </div>
              )}
              
              <div className="flex gap-3">
                <button type="button" onClick={() => fileInputRef.current?.click()} className="p-4 bg-[var(--vix-bg)] border border-[var(--vix-border)] rounded-full text-zinc-500 hover:text-pink-500 transition-all shadow-md"><ImageIcon className="w-5 h-5" /></button>
                <input ref={fileInputRef} type="file" className="hidden" accept="image/*,video/*" onChange={handleFileSelect} />
                
                <div className="flex-1 relative">
                  <input 
                    ref={messageInputRef}
                    value={text} 
                    onChange={e => setText(e.target.value)} 
                    placeholder={t('Type your message...')}
                    dir="auto"
                    className="w-full bg-[var(--vix-bg)] border border-[var(--vix-border)] rounded-full px-6 py-4 text-sm focus:border-pink-500/30 outline-none transition-all text-[var(--vix-text)] shadow-inner" 
                  />
                </div>
                
                <button type="submit" disabled={(!text.trim() && !selectedFile) || isUploading} className="vix-gradient p-4 rounded-full shadow-lg active:scale-90 transition-all disabled:opacity-20 flex items-center justify-center">
                  {isUploading ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Send className="w-5 h-5 text-white" />}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="text-center space-y-6 max-w-xs animate-vix-in">
            <div className="w-24 h-24 rounded-[2.5rem] bg-[var(--vix-secondary)]/30 flex items-center justify-center mx-auto border border-[var(--vix-border)] border-dashed">
              <MessageCircle className="w-10 h-10 text-zinc-500" />
            </div>
            <h3 className="text-xl font-black uppercase tracking-widest">{t('Select a narrative')}</h3>
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest leading-relaxed">{t('Initiate a secure signal exchange with another creator.')}</p>
            <button onClick={() => setShowNewChatModal(true)} className="vix-gradient px-10 py-3 rounded-full text-[10px] font-black uppercase tracking-widest text-white shadow-xl">{t('Start Chat')}</button>
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-[100] bg-[var(--vix-bg)]/95 flex flex-col items-center justify-start pt-24 p-6 backdrop-blur-xl animate-vix-in">
          <button onClick={() => { setShowNewChatModal(false); setSearchQuery(''); setSearchResults([]); }} className="absolute top-10 right-10 p-3 bg-[var(--vix-secondary)] rounded-full border border-[var(--vix-border)]"><X className="w-6 h-6" /></button>
          <div className="w-full max-w-md space-y-8">
            <div className="text-center">
               <h3 className="text-2xl font-black uppercase tracking-widest">{t('Creator Search')}</h3>
               <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-2">{t('Establish new signal connection')}</p>
            </div>
            <div className="relative">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
              <input 
                type="text" 
                placeholder={t('Search @username...')} 
                value={searchQuery}
                onChange={e => handleSearchUsers(e.target.value)}
                autoFocus
                className="w-full bg-[var(--vix-secondary)]/50 border border-[var(--vix-border)] rounded-full py-5 pl-14 pr-6 text-sm outline-none focus:border-pink-500/30 transition-all text-[var(--vix-text)] font-bold"
              />
            </div>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto no-scrollbar">
              {isSearching ? (
                <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-pink-500" /></div>
              ) : searchResults.map(u => (
                <div 
                  key={u.id}
                  onClick={() => { setActiveChat(u); setShowNewChatModal(false); setSearchQuery(''); setSearchResults([]); }}
                  className="flex items-center gap-4 p-4 rounded-3xl bg-[var(--vix-card)] border border-[var(--vix-border)] hover:border-pink-500/30 cursor-pointer transition-all group"
                >
                  <img src={u.avatar_url || `https://ui-avatars.com/api/?name=${u.username}`} className="w-12 h-12 rounded-full object-cover border border-[var(--vix-border)]" />
                  <div className="flex-1">
                    <p className="font-black text-sm text-[var(--vix-text)]">@{u.username}</p>
                    <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">{u.full_name || t('Creator')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Messages;
