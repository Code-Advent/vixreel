
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Send, User, ChevronLeft, MessageCircle, Loader2, Search, Plus, X, 
  Image as ImageIcon, Smile, MoreVertical, Trash2, Sticker as StickerIcon,
  Check, CheckCheck, Clock, Paperclip, Phone, Video as VideoIcon, Info,
  CheckCircle, Heart
} from 'lucide-react';
import EmojiPicker, { EmojiClickData, Theme as EmojiTheme } from 'emoji-picker-react';
import { supabase } from '../lib/supabase';
import { UserProfile, Message, MessageReaction } from '../types';
import VerificationBadge from './VerificationBadge';
import { useTranslation } from '../lib/translation';
import { sanitizeFilename } from '../lib/utils';
import StickerPicker from './StickerPicker';

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
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  
  // Media State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // UI State
  const [showFullEmojiPicker, setShowFullEmojiPicker] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const REACTION_OPTIONS = ['❤️', '👍', '🔥', '😂', '😮', '😢'];

  const filteredChats = useMemo(() => {
    if (!chatSearchQuery.trim()) return chats;
    return chats.filter(chat => 
      chat.username.toLowerCase().includes(chatSearchQuery.toLowerCase()) ||
      chat.full_name?.toLowerCase().includes(chatSearchQuery.toLowerCase())
    );
  }, [chats, chatSearchQuery]);

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
      
      msgs.forEach(m => {
        const otherUser = m.sender_id === currentUser.id ? m.receiver : m.sender;
        if (otherUser && !uniqueUsersMap.has(otherUser.id)) {
          // Count unread messages from this user
          const unreadCount = msgs.filter(msg => 
            msg.sender_id === otherUser.id && 
            msg.receiver_id === currentUser.id && 
            !msg.is_read
          ).length;

          uniqueUsersMap.set(otherUser.id, {
            ...otherUser,
            last_message: m.content || (m.media_url ? '📷 Media' : (m.sticker_url ? '🎨 Sticker' : '')),
            last_message_at: m.created_at,
            unread_count: unreadCount
          });
        }
      });

      if (initialChatUser && !uniqueUsersMap.has(initialChatUser.id)) {
        uniqueUsersMap.set(initialChatUser.id, { ...initialChatUser });
      }
      
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

      // Mark messages as read
      const unreadIds = data?.filter(m => m.receiver_id === currentUser.id && !m.is_read).map(m => m.id);
      if (unreadIds && unreadIds.length > 0) {
        await supabase
          .from('messages')
          .update({ is_read: true })
          .in('id', unreadIds);
        
        // Refresh chat list to update unread counts
        fetchChats();
      }
    } catch (err) {
      console.error("Message fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const sendSticker = async (url: string) => {
    if (!activeChat) return;
    setShowStickerPicker(false);
    try {
      const { data, error } = await supabase.from('messages').insert({
        sender_id: currentUser.id,
        receiver_id: activeChat.id,
        sticker_url: url
      }).select().single();
      if (error) throw error;
      setMessages(prev => [...prev, data]);
    } catch (err) {
      console.error("Sticker send error:", err);
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

  const deleteMessage = async (messageId: string) => {
    if (!confirm(t('Are you sure you want to delete this message?'))) return;
    try {
      const { error } = await supabase.from('messages').delete().eq('id', messageId);
      if (error) throw error;
      setMessages(prev => prev.filter(m => m.id !== messageId));
    } catch (err) {
      console.error("Delete message error:", err);
    }
  };

  const deleteConversation = async (otherUserId: string) => {
    if (!confirm(t('Are you sure you want to remove this conversation? This will delete all messages for both participants.'))) return;
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUser.id})`);
      
      if (error) throw error;
      setChats(prev => prev.filter(c => c.id !== otherUserId));
      if (activeChat?.id === otherUserId) setActiveChat(null);
    } catch (err) {
      console.error("Delete conversation error:", err);
    }
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
    <div className="flex h-[calc(100vh-80px)] bg-white dark:bg-[#18191a] overflow-hidden animate-vix-in">
      
      {/* Sidebar - Chat List */}
      <div className={`w-full md:w-[360px] flex flex-col border-r border-gray-200 dark:border-gray-800 ${activeChat ? 'hidden md:flex' : 'flex'}`}>
        {/* Sidebar Header */}
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-black dark:text-white">{t('Chats')}</h1>
            <div className="flex gap-2">
              <button className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                <MoreVertical className="w-5 h-5 text-black dark:text-white" />
              </button>
              <button className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                <VideoIcon className="w-5 h-5 text-black dark:text-white" />
              </button>
              <button 
                onClick={() => setShowNewChatModal(true)}
                className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <Plus className="w-5 h-5 text-black dark:text-white" />
              </button>
            </div>
          </div>
          
          {/* Search */}
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-blue-600 transition-colors" />
            <input 
              type="text" 
              value={chatSearchQuery}
              onChange={(e) => setChatSearchQuery(e.target.value)}
              placeholder={t('Search Messenger')}
              className="w-full bg-gray-100 dark:bg-gray-800 border border-transparent focus:border-blue-500/30 focus:bg-white dark:focus:bg-gray-700 rounded-full py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-500/10 transition-all text-black dark:text-white placeholder-gray-500 outline-none"
            />
          </div>

          {/* Active Users Row */}
          <div className="flex gap-4 overflow-x-auto no-scrollbar py-2">
            <div className="flex flex-col items-center gap-1 flex-shrink-0 cursor-pointer">
              <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center border border-gray-200 dark:border-gray-700">
                <Plus className="w-6 h-6 text-gray-500" />
              </div>
              <span className="text-[11px] text-gray-500 font-medium">{t('Your story')}</span>
            </div>
            {chats.slice(0, 8).map(u => (
              <div key={u.id} className="flex flex-col items-center gap-1 flex-shrink-0 cursor-pointer" onClick={() => setActiveChat(u)}>
                <div className="relative">
                  <img src={u.avatar_url || `https://ui-avatars.com/api/?name=${u.username}`} className="w-14 h-14 rounded-full object-cover border-2 border-transparent p-0.5" />
                  <div className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-white dark:border-[#18191a] rounded-full"></div>
                </div>
                <span className="text-[11px] text-gray-500 font-medium truncate w-14 text-center">{u.username}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {filteredChats.length > 0 ? filteredChats.map(u => (
            <div 
              key={u.id} 
              onClick={() => setActiveChat(u)}
              className={`flex items-center gap-3 p-3 mx-2 rounded-xl cursor-pointer transition-colors relative group ${activeChat?.id === u.id ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
            >
              <div className="relative flex-shrink-0">
                <img 
                  src={u.avatar_url || `https://ui-avatars.com/api/?name=${u.username}`} 
                  className="w-14 h-14 rounded-full object-cover" 
                />
                <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white dark:border-[#18191a] rounded-full"></div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                  <span className={`text-[15px] truncate ${u.unread_count ? 'font-bold text-black dark:text-white' : 'font-medium text-gray-900 dark:text-gray-100'}`}>
                    {u.full_name || u.username}
                  </span>
                  {u.last_message_at && (
                    <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                      {new Date(u.last_message_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase()}
                    </span>
                  )}
                </div>
                <div className="flex justify-between items-center">
                  <p className={`text-sm truncate ${u.unread_count ? 'font-bold text-black dark:text-white' : 'text-gray-500'}`}>
                    {u.last_message || t('New conversation')}
                  </p>
                  {u.unread_count && u.unread_count > 0 && (
                    <div className="w-3 h-3 bg-blue-600 rounded-full ml-2 flex-shrink-0"></div>
                  )}
                </div>
              </div>
              
              {/* Delete conversation button on hover */}
              <button 
                onClick={(e) => { e.stopPropagation(); deleteConversation(u.id); }}
                className="absolute right-4 opacity-0 group-hover:opacity-100 p-2 bg-white dark:bg-gray-700 rounded-full shadow-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-all z-10"
              >
                <Trash2 className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          )) : (
            <div className="flex flex-col items-center justify-center p-8 text-center text-gray-500">
              <MessageCircle className="w-12 h-12 mb-2 opacity-20" />
              <p className="text-sm">{t('No chats found')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={`flex-1 flex flex-col bg-white dark:bg-[#18191a] ${!activeChat ? 'hidden md:flex items-center justify-center' : 'flex'}`}>
        {activeChat ? (
          <>
            {/* Chat Header */}
            <div className="h-16 px-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-800 shadow-sm z-10">
              <div className="flex items-center gap-3">
                <button onClick={() => setActiveChat(null)} className="md:hidden p-2 -ml-2 text-blue-600">
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <div className="relative">
                  <img 
                    src={activeChat.avatar_url || `https://ui-avatars.com/api/?name=${activeChat.username}`} 
                    className="w-10 h-10 rounded-full object-cover" 
                  />
                  <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white dark:border-[#18191a] rounded-full"></div>
                </div>
                <div className="flex flex-col">
                  <h3 className="font-bold text-[15px] text-black dark:text-white leading-tight flex items-center gap-1">
                    {activeChat.full_name || activeChat.username}
                    {activeChat.is_verified && <VerificationBadge size="w-3.5 h-3.5" />}
                  </h3>
                  <span className="text-xs text-gray-500">{t('Active now')}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-1">
                <button className="p-2 text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                  <Phone className="w-5 h-5 fill-current" />
                </button>
                <button className="p-2 text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                  <VideoIcon className="w-6 h-6 fill-current" />
                </button>
                <button className="p-2 text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                  <Info className="w-6 h-6 fill-current" />
                </button>
              </div>
            </div>

            {/* Messages List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1 no-scrollbar flex flex-col">
              {loading && messages.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : (
                messages.map((m, i) => {
                  const isOwn = m.sender_id === currentUser.id;
                  const prevMsg = i > 0 ? messages[i - 1] : null;
                  const nextMsg = i < messages.length - 1 ? messages[i + 1] : null;
                  
                  const isStartOfGroup = !prevMsg || prevMsg.sender_id !== m.sender_id;
                  const isEndOfGroup = !nextMsg || nextMsg.sender_id !== m.sender_id;
                  
                  // Date separator logic
                  const msgDate = new Date(m.created_at);
                  const showDate = !prevMsg || (msgDate.getTime() - new Date(prevMsg.created_at).getTime() > 1000 * 60 * 30);

                  return (
                    <React.Fragment key={m.id}>
                      {showDate && (
                        <div className="flex justify-center my-4">
                          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                            {msgDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          </span>
                        </div>
                      )}
                      
                      <div className={`flex items-end gap-2 ${isOwn ? 'justify-end' : 'justify-start'} ${isEndOfGroup ? 'mb-2' : 'mb-0.5'}`}>
                        {!isOwn && (
                          <div className="w-7 h-7 flex-shrink-0">
                            {isEndOfGroup ? (
                              <img 
                                src={activeChat.avatar_url || `https://ui-avatars.com/api/?name=${activeChat.username}`} 
                                className="w-7 h-7 rounded-full object-cover" 
                              />
                            ) : <div className="w-7" />}
                          </div>
                        )}
                        
                        <div className={`group relative max-w-[70%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                          <div 
                            className={`px-3 py-2 text-[15px] leading-snug break-words whitespace-pre-wrap shadow-sm ${
                              isOwn 
                                ? 'bg-gradient-to-b from-[#0084FF] to-[#00C6FF] text-white' 
                                : 'bg-gray-200 dark:bg-gray-800 text-black dark:text-white'
                            } ${
                              isOwn 
                                ? `rounded-[1.25rem] ${isStartOfGroup ? 'rounded-tr-[1.25rem]' : 'rounded-tr-[0.25rem]'} ${isEndOfGroup ? 'rounded-br-[1.25rem]' : 'rounded-br-[0.25rem]'}`
                                : `rounded-[1.25rem] ${isStartOfGroup ? 'rounded-tl-[1.25rem]' : 'rounded-tl-[0.25rem]'} ${isEndOfGroup ? 'rounded-bl-[1.25rem]' : 'rounded-bl-[0.25rem]'}`
                            }`}
                          >
                            {m.media_url && (
                              <div className="mb-1 -mx-1 -mt-1 rounded-lg overflow-hidden">
                                {m.media_type === 'video' ? (
                                  <video src={m.media_url} controls className="max-w-full max-h-60" />
                                ) : (
                                  <img src={m.media_url} className="max-w-full max-h-60 object-cover" />
                                )}
                              </div>
                            )}
                            {m.sticker_url && (
                              <div className="w-32 h-32">
                                <img src={m.sticker_url} className="w-full h-full object-contain" />
                              </div>
                            )}
                            {m.content}
                          </div>

                          {/* Reactions */}
                          {m.reactions && m.reactions.length > 0 && (
                            <div className={`flex gap-0.5 mt-[-8px] z-10 ${isOwn ? 'mr-2' : 'ml-2'}`}>
                              {Array.from(new Set(m.reactions.map(r => r.reaction))).map(emoji => (
                                <div key={emoji} className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-full px-1 py-0.5 text-[10px] shadow-sm flex items-center">
                                  {emoji}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Action Buttons on Hover */}
                          <div className={`absolute top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${isOwn ? 'right-full mr-2' : 'left-full ml-2'}`}>
                            <button 
                              onClick={() => setShowReactionPicker(showReactionPicker === m.id ? null : m.id)}
                              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                            >
                              <Smile className="w-4 h-4" />
                            </button>
                            <button className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Reaction Picker */}
                          {showReactionPicker === m.id && (
                            <div className={`absolute bottom-full mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full p-1 flex gap-1 shadow-xl z-50 animate-vix-in ${isOwn ? 'right-0' : 'left-0'}`}>
                              {REACTION_OPTIONS.map(emoji => (
                                <button key={emoji} onClick={() => toggleReaction(m.id, emoji)} className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-all text-lg">{emoji}</button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {isOwn && isEndOfGroup && i === messages.length - 1 && (
                        <div className="flex justify-end mb-2">
                          <div className="flex items-center gap-1 text-[10px] text-gray-400 font-medium">
                            {m.is_read ? (
                              <img 
                                src={activeChat.avatar_url || `https://ui-avatars.com/api/?name=${activeChat.username}`} 
                                className="w-3 h-3 rounded-full" 
                              />
                            ) : (
                              <CheckCircle className="w-3 h-3" />
                            )}
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })
              )}
              <div ref={messagesEndRef} className="h-2" />
            </div>

            {/* Input Area */}
            <div className="p-3 bg-white dark:bg-[#18191a] border-t border-gray-200 dark:border-gray-800">
              {mediaPreview && (
                <div className="relative inline-block mb-3 ml-12 animate-vix-in">
                  <div className="w-24 h-24 rounded-xl overflow-hidden border-2 border-blue-500 shadow-lg">
                    {selectedFile?.type.startsWith('video') ? <video src={mediaPreview} className="w-full h-full object-cover" /> : <img src={mediaPreview} className="w-full h-full object-cover" />}
                  </div>
                  <button 
                    onClick={() => { setSelectedFile(null); setMediaPreview(null); }} 
                    className="absolute -top-2 -right-2 p-1.5 bg-gray-900 text-white rounded-full shadow-md hover:bg-black transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              
              <div className="flex items-end gap-2 max-w-5xl mx-auto">
                <div className="flex items-center gap-0.5 mb-1">
                  <button title={t('More actions')} className="p-2 text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                    <Plus className="w-5 h-5" />
                  </button>
                  <button 
                    title={t('Attach photo or video')}
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                  >
                    <ImageIcon className="w-5 h-5" />
                  </button>
                  <button 
                    title={t('Choose a sticker')}
                    onClick={() => setShowStickerPicker(!showStickerPicker)}
                    className="p-2 text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                  >
                    <StickerIcon className="w-5 h-5" />
                  </button>
                  <button title={t('Start a video call')} className="p-2 text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                    <VideoIcon className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 relative flex items-center bg-gray-100 dark:bg-gray-800 rounded-2xl px-3 py-1.5 border border-transparent focus-within:border-gray-300 dark:focus-within:border-gray-600 transition-all">
                  <textarea 
                    ref={messageInputRef}
                    value={text} 
                    onChange={e => setText(e.target.value)} 
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder={t('Aa')}
                    rows={1}
                    className="flex-1 bg-transparent border-none py-1 text-[15px] outline-none text-black dark:text-white resize-none max-h-32 no-scrollbar" 
                  />
                  <button 
                    title={t('Choose an emoji')}
                    className="p-1.5 text-blue-600 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
                  >
                    <Smile className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex items-center mb-1">
                  {isUploading ? (
                    <div className="p-2">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                    </div>
                  ) : (
                    text.trim() || selectedFile ? (
                      <button 
                        onClick={sendMessage}
                        className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-all shadow-sm active:scale-95"
                      >
                        <Send className="w-5 h-5 fill-current" />
                      </button>
                    ) : (
                      <button 
                        onClick={(e) => { e.preventDefault(); setText('👍'); sendMessage(); }}
                        className="p-2 text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors active:scale-90"
                      >
                        <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current">
                          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3z" />
                        </svg>
                      </button>
                    )
                  )}
                </div>
              </div>
              <input ref={fileInputRef} type="file" className="hidden" accept="image/*,video/*" onChange={handleFileSelect} />
            </div>

            {showStickerPicker && (
              <div className="absolute bottom-20 left-4 z-50">
                <StickerPicker 
                  currentUser={currentUser}
                  onSelect={sendSticker}
                  onClose={() => setShowStickerPicker(false)}
                />
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center p-10 text-center">
            <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
              <MessageCircle className="w-10 h-10 text-gray-400" />
            </div>
            <h2 className="text-xl font-bold text-black dark:text-white mb-2">{t('Select a chat')}</h2>
            <p className="text-gray-500 text-sm max-w-xs">{t('Choose from your existing conversations or start a new one.')}</p>
            <button 
              onClick={() => setShowNewChatModal(true)}
              className="mt-6 bg-blue-600 text-white px-6 py-2 rounded-full font-bold hover:bg-blue-700 transition-colors"
            >
              {t('New Message')}
            </button>
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm animate-vix-in">
          <div className="w-full max-w-md bg-white dark:bg-[#242526] rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-black dark:text-white">{t('New Message')}</h3>
              <button 
                onClick={() => { setShowNewChatModal(false); setSearchQuery(''); setSearchResults([]); }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-4">
              <div className="relative mb-4">
                <span className="absolute left-0 top-1/2 -translate-y-1/2 text-gray-500 text-sm">{t('To:')}</span>
                <input 
                  type="text" 
                  placeholder={t('Type a name or @username')} 
                  value={searchQuery}
                  onChange={e => handleSearchUsers(e.target.value)}
                  autoFocus
                  className="w-full bg-transparent border-none pl-8 py-2 text-sm outline-none focus:ring-0 text-black dark:text-white"
                />
              </div>

              <div className="max-h-[300px] overflow-y-auto no-scrollbar space-y-1">
                {isSearching ? (
                  <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
                ) : searchResults.length > 0 ? searchResults.map(u => (
                  <div 
                    key={u.id}
                    onClick={() => { setActiveChat(u); setShowNewChatModal(false); setSearchQuery(''); setSearchResults([]); }}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                  >
                    <img src={u.avatar_url || `https://ui-avatars.com/api/?name=${u.username}`} className="w-10 h-10 rounded-full object-cover" />
                    <div className="flex-1">
                      <p className="font-bold text-sm text-black dark:text-white">{u.full_name || u.username}</p>
                      <p className="text-xs text-gray-500">@{u.username}</p>
                    </div>
                  </div>
                )) : searchQuery.length >= 2 ? (
                  <p className="text-center py-4 text-sm text-gray-500">{t('No users found')}</p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Messages;
