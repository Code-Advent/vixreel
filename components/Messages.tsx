
import React, { useState, useEffect, useRef } from 'react';
import { Send, User, ChevronLeft, MessageCircle, Loader2, ArrowLeft, Search, Plus, X, Image as ImageIcon, Smile, Heart, MoreHorizontal } from 'lucide-react';
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
  
  // Reactions State
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [showFullEmojiPicker, setShowFullEmojiPicker] = useState(false);
  const [emojiPickerTarget, setEmojiPickerTarget] = useState<'MESSAGE' | 'REACTION'>('MESSAGE');
  const [reactionMessageId, setReactionMessageId] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const REACTION_OPTIONS = ['❤️', '👍', '🔥', '😂', '😮', '😢'];

  // Initialize and Real-time Subscription
  useEffect(() => {
    fetchChats();
    
    const channel = supabase
      .channel('vix-messages-realtime-v3')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newMsg = payload.new as Message;
          
          // Check if this message belongs to the current open conversation
          if (activeChat && (
            (newMsg.sender_id === activeChat.id && newMsg.receiver_id === currentUser.id) ||
            (newMsg.sender_id === currentUser.id && newMsg.receiver_id === activeChat.id)
          )) {
            setMessages(prev => {
              // Prevent duplicates if optimistic update already added it
              const exists = prev.some(m => m.id === newMsg.id || (m.content === newMsg.content && m.sender_id === newMsg.sender_id && Math.abs(new Date(m.created_at).getTime() - new Date(newMsg.created_at).getTime()) < 1000));
              if (exists) return prev;
              return [...prev, newMsg];
            });
          }
          
          // Refresh chat list to update previews and order
          fetchChats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChat?.id, currentUser.id]);

  // Handle active chat changes
  useEffect(() => {
    if (activeChat) {
      setMessages([]); // Clear previous messages to ensure fresh load
      fetchMessages();
      messageInputRef.current?.focus();
    } else {
      setMessages([]);
    }
  }, [activeChat?.id]);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchChats = async () => {
    try {
      // Fetch latest messages for each conversation - limit to 500 for performance
      const { data: msgs, error } = await supabase
        .from('messages')
        .select('*, sender:profiles!sender_id(*), receiver:profiles!receiver_id(*)')
        .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      if (!msgs) return;

      const uniqueUsersMap = new Map<string, ChatPreview>();
      
      // If we were directed here with an initial user, make sure they're in the list
      if (initialChatUser && !uniqueUsersMap.has(initialChatUser.id)) {
        uniqueUsersMap.set(initialChatUser.id, { ...initialChatUser });
      }

      msgs.forEach(m => {
        const otherUser = m.sender_id === currentUser.id ? m.receiver : m.sender;
        if (otherUser && !uniqueUsersMap.has(otherUser.id)) {
          uniqueUsersMap.set(otherUser.id, {
            ...otherUser,
            last_message: m.content,
            last_message_at: m.created_at
          });
        }
      });
      
      setChats(Array.from(uniqueUsersMap.values()));
    } catch (err) {
      console.error("Error fetching chats:", err);
    }
  };

  const fetchMessages = async () => {
    if (!activeChat) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          reactions:message_reactions(*)
        `)
        .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${activeChat.id}),and(sender_id.eq.${activeChat.id},receiver_id.eq.${currentUser.id})`)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error("Error fetching messages:", error);
        // Fallback: fetch without reactions if join fails
        if (error.code === 'PGRST200') {
          const { data: fallbackData } = await supabase
            .from('messages')
            .select('*')
            .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${activeChat.id}),and(sender_id.eq.${activeChat.id},receiver_id.eq.${currentUser.id})`)
            .order('created_at', { ascending: true });
          if (fallbackData) setMessages(fallbackData);
        }
        return;
      }
      if (data) setMessages(data);
    } catch (err) {
      console.error("Error fetching messages:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchUsers = async (val: string) => {
    setSearchQuery(val);
    if (val.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', currentUser.id)
        .ilike('username', `%${val}%`)
        .limit(8);
      
      if (data) setSearchResults(data as UserProfile[]);
    } finally {
      setIsSearching(false);
    }
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
      const { data: existing } = await supabase
        .from('message_reactions')
        .select('*')
        .eq('message_id', messageId)
        .eq('user_id', currentUser.id)
        .eq('reaction', reaction)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('message_reactions')
          .delete()
          .eq('id', existing.id);
      } else {
        await supabase
          .from('message_reactions')
          .insert({
            message_id: messageId,
            user_id: currentUser.id,
            reaction
          });
      }
      
      setShowReactionPicker(null);
      fetchMessages(); // Refresh to show reactions
    } catch (err) {
      console.error("Reaction failure:", err);
    }
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    if (emojiPickerTarget === 'MESSAGE') {
      setText(prev => prev + emojiData.emoji);
    } else if (emojiPickerTarget === 'REACTION' && reactionMessageId) {
      toggleReaction(reactionMessageId, emojiData.emoji);
    }
    setShowFullEmojiPicker(false);
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
        const path = `messages/${currentUser.id}/${Date.now()}-${safeName}`;
        const { error: uploadErr } = await supabase.storage
          .from('messages')
          .upload(path, fileToUpload);
        
        if (uploadErr) throw uploadErr;

        const { data: { publicUrl } } = supabase.storage
          .from('messages')
          .getPublicUrl(path);
        
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
      fetchChats();
    } catch (err) {
      console.error("Transmission failure:", err);
      setText(msgContent);
      setSelectedFile(fileToUpload);
      if (fileToUpload) setMediaPreview(URL.createObjectURL(fileToUpload));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-[1000px] mx-auto h-[88vh] border border-[var(--vix-border)] rounded-[3rem] flex overflow-hidden mt-4 bg-[var(--vix-bg)] shadow-2xl relative ring-1 ring-white/5">
      
      {/* Sidebar - Chat Previews */}
      <div className={`w-full md:w-80 border-r border-[var(--vix-border)] flex flex-col ${activeChat ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-8 border-b border-[var(--vix-border)] flex items-center justify-between bg-[var(--vix-secondary)]/10">
          <div className="flex flex-col">
            <span className="font-black uppercase text-[10px] tracking-[0.4em] text-zinc-500">{t('Narrative')}</span>
            <span className="text-[9px] font-black text-pink-500 uppercase tracking-widest mt-1">{t('Direct Encrypted')}</span>
          </div>
          <button 
            onClick={() => setShowNewChatModal(true)}
            className="p-3 bg-[var(--vix-secondary)] rounded-2xl text-zinc-400 hover:text-[var(--vix-text)] transition-all border border-[var(--vix-border)] shadow-lg hover:shadow-pink-500/10 active:scale-95"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto no-scrollbar bg-[var(--vix-bg)] divide-y divide-[var(--vix-border)]/20">
          {chats.length > 0 ? chats.map(u => (
            <div 
              key={u.id} 
              onClick={() => setActiveChat(u)}
              className={`flex items-center gap-4 p-5 cursor-pointer transition-all duration-300 relative group ${activeChat?.id === u.id ? 'bg-[var(--vix-secondary)]/40' : 'hover:bg-[var(--vix-secondary)]/20'}`}
            >
              {activeChat?.id === u.id && <div className="absolute left-0 top-0 bottom-0 w-1 vix-gradient"></div>}
              <div className="relative shrink-0">
                <img 
                  src={u.avatar_url || `https://ui-avatars.com/api/?name=${u.username}`} 
                  className={`w-12 h-12 rounded-full border border-[var(--vix-border)] object-cover shadow-lg transition-transform group-hover:scale-105 ${u.is_verified ? 'ring-2 ring-pink-500/20' : ''}`} 
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-0.5">
                  <span className="font-black text-[13px] truncate flex items-center gap-1.5 text-[var(--vix-text)] opacity-80 group-hover:opacity-100">
                    {u.username} {u.is_verified && <VerificationBadge size="w-3.5 h-3.5" />}
                  </span>
                  {u.last_message_at && (
                    <span className="text-[8px] text-zinc-500 font-bold uppercase shrink-0">
                      {new Date(u.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                <p className={`text-[10px] font-medium truncate max-w-[150px] ${activeChat?.id === u.id ? 'text-zinc-500' : 'text-zinc-600'}`}>
                  {u.last_message || t('Start signal exchange...')}
                </p>
              </div>
            </div>
          )) : (
            <div className="p-16 text-center opacity-30 flex flex-col items-center justify-center h-full space-y-6">
              <div className="w-16 h-16 rounded-[1.5rem] bg-[var(--vix-secondary)] flex items-center justify-center border border-[var(--vix-border)] border-dashed">
                <MessageCircle className="w-8 h-8 text-zinc-500" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--vix-text)]">{t('No narratives active')}</p>
              <button onClick={() => setShowNewChatModal(true)} className="px-8 py-3 vix-gradient rounded-full text-[9px] font-black uppercase tracking-widest text-white shadow-xl shadow-pink-500/10 active:scale-95 transition-all">{t('Initialize Comms')}</button>
            </div>
          )}
        </div>
      </div>

      {/* Main Messaging Window */}
      <div className={`flex-1 flex flex-col bg-[var(--vix-bg)]/40 backdrop-blur-3xl ${!activeChat ? 'hidden md:flex items-center justify-center' : 'flex'}`}>
        {activeChat ? (
          <>
            <div className="p-6 border-b border-[var(--vix-border)] flex items-center justify-between bg-[var(--vix-secondary)]/30 backdrop-blur-xl z-20">
              <div className="flex items-center gap-4">
                <button onClick={() => setActiveChat(null)} className="md:hidden p-2 text-zinc-500 hover:text-[var(--vix-text)] transition-colors"><ChevronLeft className="w-6 h-6" /></button>
                <div className="relative">
                  <img src={activeChat.avatar_url || `https://ui-avatars.com/api/?name=${activeChat.username}`} className="w-10 h-10 rounded-full border border-[var(--vix-border)] object-cover shadow-xl" />
                  <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-[var(--vix-bg)] rounded-full shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
                </div>
                <div>
                  <div className="font-black text-[15px] flex items-center gap-1.5 text-[var(--vix-text)]">
                    {activeChat.username} {activeChat.is_verified && <VerificationBadge size="w-3.5 h-3.5" />}
                  </div>
                  <span className="text-[8px] text-zinc-600 font-black uppercase tracking-[0.2em]">{activeChat.full_name || t('Individual Creator')}</span>
                </div>
              </div>
            </div>

            <div className="flex-1 p-6 sm:p-10 overflow-y-auto space-y-6 no-scrollbar relative">
              <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-[var(--vix-bg)]/80 to-transparent pointer-events-none z-10"></div>
              
              {loading && messages.length === 0 ? (
                <div className="h-full flex items-center justify-center"><Loader2 className="w-8 h-8 text-zinc-800 animate-spin" /></div>
              ) : (
                messages.map((m, i) => {
                  const isOwn = m.sender_id === currentUser.id;
                  const showTime = i === 0 || Math.abs(new Date(m.created_at).getTime() - new Date(messages[i-1].created_at).getTime()) > 600000;
                  
                  return (
                    <div key={m.id} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} animate-vix-in`}>
                      {showTime && (
                        <span className="text-[8px] text-zinc-500 font-black uppercase tracking-[0.4em] my-6 w-full text-center">
                          {new Date(m.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })} at {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                      <div 
                        dir="auto"
                        className={`group relative max-w-[85%] sm:max-w-[70%] p-5 px-7 rounded-[2.5rem] text-[13px] font-medium shadow-2xl transition-all ${
                        isOwn 
                          ? 'vix-gradient text-white rounded-tr-none border border-white/10' 
                          : 'bg-[var(--vix-secondary)] text-[var(--vix-text)] rounded-tl-none border border-[var(--vix-border)]/50 backdrop-blur-md shadow-sm'
                      }`}>
                        {m.media_url && (
                          <div className="mb-3 rounded-2xl overflow-hidden border border-white/10 shadow-inner">
                            {m.media_type === 'video' ? (
                              <video src={m.media_url} controls className="w-full max-h-60 object-cover" />
                            ) : (
                              <img src={m.media_url} className="w-full max-h-60 object-cover" />
                            )}
                          </div>
                        )}
                        {m.content}

                        {/* Reaction Picker Trigger */}
                        <button 
                          onClick={() => setShowReactionPicker(showReactionPicker === m.id ? null : m.id)}
                          className={`absolute ${isOwn ? '-left-10' : '-right-10'} top-1/2 -translate-y-1/2 p-2 opacity-0 group-hover:opacity-100 transition-all text-zinc-500 hover:text-pink-500`}
                        >
                          <Smile className="w-4 h-4" />
                        </button>

                        {/* Reaction Picker */}
                        {showReactionPicker === m.id && (
                          <div className={`absolute ${isOwn ? '-left-64' : '-right-64'} top-1/2 -translate-y-1/2 bg-[var(--vix-card)] border border-[var(--vix-border)] rounded-full p-2 flex gap-1 shadow-2xl z-50 animate-vix-in`}>
                            {REACTION_OPTIONS.map(emoji => (
                              <button 
                                key={emoji}
                                onClick={() => toggleReaction(m.id, emoji)}
                                className="w-8 h-8 flex items-center justify-center hover:bg-[var(--vix-secondary)] rounded-full transition-all text-lg"
                              >
                                {emoji}
                              </button>
                            ))}
                            <button 
                              onClick={() => {
                                setEmojiPickerTarget('REACTION');
                                setReactionMessageId(m.id);
                                setShowFullEmojiPicker(true);
                                setShowReactionPicker(null);
                              }}
                              className="w-8 h-8 flex items-center justify-center hover:bg-[var(--vix-secondary)] rounded-full transition-all text-zinc-500"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        )}

                        {/* Display Reactions */}
                        {m.reactions && m.reactions.length > 0 && (
                          <div className={`absolute -bottom-3 ${isOwn ? 'right-4' : 'left-4'} flex gap-1`}>
                            {Array.from(new Set(m.reactions.map(r => r.reaction))).map(emoji => (
                              <div key={emoji} className="bg-[var(--vix-card)] border border-[var(--vix-border)] rounded-full px-2 py-0.5 text-[10px] shadow-lg flex items-center gap-1">
                                {emoji} <span className="text-[8px] text-zinc-500">{m.reactions?.filter(r => r.reaction === emoji).length}</span>
                              </div>
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

            <form onSubmit={sendMessage} className="p-6 sm:p-8 bg-[var(--vix-secondary)]/20 border-t border-[var(--vix-border)] flex flex-col gap-4 backdrop-blur-2xl">
              {mediaPreview && (
                <div className="relative w-32 h-32 rounded-2xl overflow-hidden border border-[var(--vix-border)] shadow-xl animate-vix-in">
                  <button 
                    type="button"
                    onClick={() => { setSelectedFile(null); setMediaPreview(null); }}
                    className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full hover:bg-black/70 transition-all z-10"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  {selectedFile?.type.startsWith('video') ? (
                    <video src={mediaPreview} className="w-full h-full object-cover" />
                  ) : (
                    <img src={mediaPreview} className="w-full h-full object-cover" />
                  )}
                </div>
              )}
              
              <div className="flex gap-4">
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-5 bg-[var(--vix-bg)] border border-[var(--vix-border)] rounded-full text-zinc-500 hover:text-pink-500 transition-all shadow-lg active:scale-90"
                >
                  <ImageIcon className="w-5 h-5" />
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    setEmojiPickerTarget('MESSAGE');
                    setShowFullEmojiPicker(!showFullEmojiPicker);
                  }}
                  className={`p-5 bg-[var(--vix-bg)] border border-[var(--vix-border)] rounded-full transition-all shadow-lg active:scale-90 ${showFullEmojiPicker && emojiPickerTarget === 'MESSAGE' ? 'text-pink-500 border-pink-500/30' : 'text-zinc-500 hover:text-pink-500'}`}
                >
                  <Smile className="w-5 h-5" />
                </button>
                <input 
                  ref={fileInputRef}
                  type="file" 
                  className="hidden" 
                  accept="image/*,video/*"
                  onChange={handleFileSelect}
                />
                <div className="flex-1 relative">
                  <input 
                    ref={messageInputRef}
                    value={text} 
                    onChange={e => setText(e.target.value)} 
                    placeholder={selectedFile ? t('Add a caption...') : t('Type your message...')}
                    dir="auto"
                    className="w-full bg-[var(--vix-bg)]/60 border border-[var(--vix-border)] rounded-[2.5rem] px-8 py-5 text-sm focus:border-pink-500/40 focus:ring-4 focus:ring-pink-500/5 outline-none transition-all text-[var(--vix-text)] placeholder:text-zinc-500 font-semibold shadow-inner" 
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={(!text.trim() && !selectedFile) || isUploading}
                  className="vix-gradient p-5 rounded-full shadow-2xl shadow-pink-500/20 active:scale-90 transition-all disabled:opacity-20 shrink-0 flex items-center justify-center group"
                >
                  {isUploading ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Send className="w-5 h-5 text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />}
                </button>
              </div>
            </form>

            {/* Global Emoji Picker Overlay */}
            {showFullEmojiPicker && (
              <div className="absolute bottom-32 right-8 z-[1000] animate-vix-in shadow-2xl rounded-3xl overflow-hidden border border-[var(--vix-border)]">
                <div className="bg-[var(--vix-card)] p-2 flex justify-between items-center border-b border-[var(--vix-border)]">
                  <span className="text-[10px] font-black uppercase tracking-widest px-3 text-zinc-500">
                    {emojiPickerTarget === 'REACTION' ? t('Choose Reaction') : t('Choose Emoji')}
                  </span>
                  <button onClick={() => setShowFullEmojiPicker(false)} className="p-2 hover:bg-[var(--vix-secondary)] rounded-full transition-all">
                    <X className="w-4 h-4 text-zinc-500" />
                  </button>
                </div>
                <EmojiPicker 
                  onEmojiClick={onEmojiClick}
                  autoFocusSearch={false}
                  theme={EmojiTheme.DARK}
                  width={350}
                  height={400}
                />
              </div>
            )}
          </>
        ) : (
          <div className="text-center space-y-12 animate-vix-in p-12 max-w-sm">
            <div className="relative">
              <div className="absolute inset-0 bg-pink-500/10 blur-3xl rounded-full"></div>
              <div className="w-28 h-28 rounded-[3rem] bg-[var(--vix-secondary)]/30 flex items-center justify-center mx-auto border border-[var(--vix-border)] border-dashed shadow-2xl relative z-10">
                <MessageCircle className="w-12 h-12 text-zinc-500" />
              </div>
            </div>
            <div className="space-y-6">
              <h3 className="text-2xl font-black uppercase tracking-[0.4em] text-[var(--vix-text)]">{t('Encrypted Signal')}</h3>
              <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] leading-relaxed opacity-60">
                {t('Initialize a secure narrative protocol to begin private signal exchange between creators.')}
              </p>
              <button onClick={() => setShowNewChatModal(true)} className="vix-gradient px-12 py-4 rounded-full text-[10px] font-black uppercase tracking-widest text-white shadow-2xl shadow-pink-500/20 active:scale-95 transition-all">{t('Select Creator')}</button>
            </div>
          </div>
        )}
      </div>

      {/* New Conversation Discovery Modal */}
      {showNewChatModal && (
        <div className="absolute inset-0 z-[100] bg-[var(--vix-bg)]/98 flex flex-col items-center justify-start pt-24 p-6 backdrop-blur-2xl animate-vix-in">
          <button 
            onClick={() => { setShowNewChatModal(false); setSearchQuery(''); setSearchResults([]); }}
            className="absolute top-12 right-12 p-3 text-zinc-700 hover:text-[var(--vix-text)] transition-colors bg-[var(--vix-secondary)]/50 rounded-full border border-[var(--vix-border)]"
          >
            <X className="w-6 h-6" />
          </button>
          
          <div className="w-full max-w-md space-y-10">
            <div className="text-center space-y-3">
               <h3 className="text-3xl font-black text-[var(--vix-text)] uppercase tracking-widest">{t('Signal Search')}</h3>
               <p className="text-[10px] text-zinc-600 font-black uppercase tracking-[0.4em]">{t('Establish new narrative connection')}</p>
            </div>

            <div className="relative group">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-700 group-focus-within:text-pink-500 transition-colors" />
              <input 
                type="text" 
                placeholder={t('Search @handle...')} 
                value={searchQuery}
                onChange={e => handleSearchUsers(e.target.value)}
                autoFocus
                className="w-full bg-[var(--vix-secondary)]/50 border border-[var(--vix-border)] rounded-[2rem] py-6 pl-16 pr-8 text-sm outline-none focus:border-pink-500/30 transition-all text-[var(--vix-text)] placeholder:text-zinc-500 font-bold"
              />
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto no-scrollbar">
              {isSearching ? (
                <div className="flex flex-col items-center py-10 gap-4">
                  <Loader2 className="w-6 h-6 text-pink-500 animate-spin" />
                  <span className="text-[10px] text-zinc-700 font-black uppercase tracking-widest">{t('Scanning Registry...')}</span>
                </div>
              ) : searchResults.length > 0 ? (
                searchResults.map(u => (
                  <div 
                    key={u.id}
                    onClick={() => { setActiveChat(u); setShowNewChatModal(false); setSearchQuery(''); setSearchResults([]); }}
                    className="flex items-center gap-4 p-5 rounded-[2rem] bg-[var(--vix-card)] border border-[var(--vix-border)]/50 hover:bg-[var(--vix-secondary)] hover:border-pink-500/20 cursor-pointer transition-all group"
                  >
                    <img src={u.avatar_url || `https://ui-avatars.com/api/?name=${u.username}`} className="w-12 h-12 rounded-full object-cover border border-[var(--vix-border)] shadow-xl" />
                    <div className="flex-1">
                      <p className="font-black text-sm text-[var(--vix-text)] flex items-center gap-1.5 opacity-80 group-hover:opacity-100">
                        @{u.username} {u.is_verified && <VerificationBadge size="w-3.5 h-3.5" />}
                      </p>
                      <p className="text-[9px] text-zinc-600 font-black uppercase tracking-widest truncate">{u.full_name || t('Individual Creator')}</p>
                    </div>
                    <div className="bg-[var(--vix-secondary)] p-3 rounded-2xl text-zinc-600 group-hover:text-pink-500 transition-colors">
                      <ChevronLeft className="w-4 h-4 rotate-180" />
                    </div>
                  </div>
                ))
              ) : searchQuery.length >= 2 && (
                <div className="text-center py-20 opacity-30">
                  <Search className="w-10 h-10 text-zinc-500 mx-auto mb-4" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t('No identity match found')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Messages;
