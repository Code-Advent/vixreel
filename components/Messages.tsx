
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Send, User, ChevronLeft, MessageCircle, Loader2, Search, Plus, X, 
  Image as ImageIcon, Smile, MoreVertical, Trash2, Sticker as StickerIcon,
  Check, CheckCheck, Clock, Paperclip, Phone, Video as VideoIcon, Info,
  CheckCircle, Heart, Users
} from 'lucide-react';
import EmojiPicker, { EmojiClickData, Theme as EmojiTheme } from 'emoji-picker-react';
import { supabase } from '../lib/supabase';
import { UserProfile, Message, MessageReaction } from '../types';
import VerificationBadge from './VerificationBadge';
import { useTranslation } from '../lib/translation';
import { sanitizeFilename } from '../lib/utils';
import StickerPicker from './StickerPicker';
import LiveStream from './LiveStream';
import LiveIndicator from './LiveIndicator';

interface MessagesProps {
  currentUser: UserProfile;
  initialChatUser?: UserProfile | null;
  onJoinLive?: (user: UserProfile) => void;
}

interface ChatPreview extends UserProfile {
  last_message?: string;
  last_message_at?: string;
  unread_count?: number;
}

const Messages: React.FC<MessagesProps> = ({ currentUser, initialChatUser, onJoinLive }) => {
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
  const [showLiveStream, setShowLiveStream] = useState(false);
  const [liveRoomID, setLiveRoomID] = useState('');
  
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

  const handleStartLive = () => {
    if (!activeChat) return;
    // Generate a room ID based on both users to ensure they join the same one
    const sortedIds = [currentUser.id, activeChat.id].sort();
    const roomID = `chat_${sortedIds[0]}_${sortedIds[1]}`;
    setLiveRoomID(roomID);
    setShowLiveStream(true);
  };

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-80px)] bg-white dark:bg-black overflow-hidden animate-vix-in">
      
      {/* Sidebar - Chat List */}
      <div className={`w-full md:w-80 lg:w-96 md:border-r border-gray-100 dark:border-zinc-900 flex flex-col ${activeChat ? 'hidden md:flex' : 'flex'} h-full`}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-100 dark:border-zinc-900">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-black text-black dark:text-white tracking-tight">{t('Inbox')}</h1>
            <div className="flex gap-4">
              <button 
                onClick={() => setShowNewChatModal(true)}
                className="p-2 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-zinc-900 rounded-full transition-colors"
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* TikTok Activities Row */}
          <div className="flex justify-between px-2 py-4 overflow-x-auto no-scrollbar gap-4">
            <div className="flex flex-col items-center gap-2 cursor-pointer group min-w-[60px]">
              <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform">
                <Users className="w-6 h-6 text-white" />
              </div>
              <span className="text-[11px] font-bold text-gray-500 dark:text-zinc-400">{t('New followers')}</span>
            </div>
            <div className="flex flex-col items-center gap-2 cursor-pointer group">
              <div className="w-12 h-12 rounded-full bg-pink-500 flex items-center justify-center shadow-lg shadow-pink-500/20 group-hover:scale-110 transition-transform">
                <Heart className="w-6 h-6 text-white" />
              </div>
              <span className="text-[11px] font-bold text-gray-500 dark:text-zinc-400">{t('Activities')}</span>
            </div>
            <div className="flex flex-col items-center gap-2 cursor-pointer group">
              <div className="w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20 group-hover:scale-110 transition-transform">
                <MessageCircle className="w-6 h-6 text-white" />
              </div>
              <span className="text-[11px] font-bold text-gray-500 dark:text-zinc-400">{t('Comments')}</span>
            </div>
            <div className="flex flex-col items-center gap-2 cursor-pointer group">
              <div className="w-12 h-12 rounded-full bg-purple-500 flex items-center justify-center shadow-lg shadow-purple-500/20 group-hover:scale-110 transition-transform">
                <Plus className="w-6 h-6 text-white" />
              </div>
              <span className="text-[11px] font-bold text-gray-500 dark:text-zinc-400">{t('Mentions')}</span>
            </div>
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto no-scrollbar">
          <div className="px-4 py-2">
            <h3 className="text-xs font-black text-gray-400 dark:text-zinc-600 uppercase tracking-widest mb-2">{t('Messages')}</h3>
          </div>
          {filteredChats.length > 0 ? filteredChats.map(u => (
            <div 
              key={u.id} 
              onClick={() => setActiveChat(u)}
              className={`flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-zinc-900 cursor-pointer transition-all relative group ${activeChat?.id === u.id ? 'bg-gray-50 dark:bg-zinc-900' : ''}`}
            >
              <div className="relative flex-shrink-0">
                <LiveIndicator user={u} size="lg" onClick={() => onJoinLive?.(u)}>
                  <img 
                    src={u.avatar_url || `https://ui-avatars.com/api/?name=${u.username}`} 
                    className="w-14 h-14 rounded-full object-cover border border-gray-100 dark:border-zinc-800" 
                  />
                </LiveIndicator>
                <div className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-white dark:border-black rounded-full"></div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-0.5">
                  <span className="text-[16px] font-bold text-black dark:text-white truncate">
                    {u.full_name || u.username}
                    {u.is_verified && <VerificationBadge size="w-3.5 h-3.5" className="inline ml-1" />}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <p className={`text-sm truncate flex-1 ${u.unread_count ? 'font-bold text-black dark:text-white' : 'text-gray-500 dark:text-zinc-500'}`}>
                    {u.last_message || t('Say hi!')}
                  </p>
                  <span className="text-[11px] text-gray-400 dark:text-zinc-600 whitespace-nowrap">
                    {u.last_message_at ? new Date(u.last_message_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}
                  </span>
                </div>
              </div>
              
              {u.unread_count && u.unread_count > 0 && (
                <div className="w-2.5 h-2.5 bg-pink-500 rounded-full ml-2"></div>
              )}
              
              {/* Delete conversation button on hover */}
              <button 
                onClick={(e) => { e.stopPropagation(); deleteConversation(u.id); }}
                className="absolute right-4 opacity-0 group-hover:opacity-100 p-2 bg-white dark:bg-zinc-800 rounded-full shadow-lg border border-gray-100 dark:border-zinc-700 hover:text-red-500 transition-all z-10"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )) : (
            <div className="flex flex-col items-center justify-center p-12 text-center text-gray-500">
              <MessageCircle className="w-16 h-16 mb-4 opacity-10" />
              <p className="text-sm font-medium">{t('No messages yet')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area - Overlay for mobile, side for desktop */}
      {activeChat && (
        <div className="fixed inset-0 z-[150] md:relative md:flex-1 flex flex-col bg-white dark:bg-black animate-vix-in">
          {/* Chat Header */}
          <div className="h-16 px-4 flex items-center justify-between border-b border-gray-100 dark:border-zinc-900 shadow-sm">
            <div className="flex items-center gap-3">
              <button onClick={() => setActiveChat(null)} className="p-2 -ml-2 text-black dark:text-white">
                <ChevronLeft className="w-7 h-7" />
              </button>
              <div className="relative">
                <LiveIndicator user={activeChat} size="sm" onClick={() => onJoinLive?.(activeChat)}>
                  <img 
                    src={activeChat.avatar_url || `https://ui-avatars.com/api/?name=${activeChat.username}`} 
                    className="w-10 h-10 rounded-full object-cover" 
                  />
                </LiveIndicator>
              </div>
              <div className="flex flex-col">
                <h3 className="font-black text-[15px] text-black dark:text-white leading-tight flex items-center gap-1">
                  {activeChat.full_name || activeChat.username}
                  {activeChat.is_verified && <VerificationBadge size="w-3.5 h-3.5" />}
                </h3>
                <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest">{t('Active now')}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={handleStartLive}
                className="p-2 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-zinc-900 rounded-full transition-colors"
              >
                <VideoIcon className="w-6 h-6" />
              </button>
              <button className="p-2 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-zinc-900 rounded-full transition-colors">
                <Info className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Messages List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar flex flex-col bg-gray-50/30 dark:bg-black">
            {loading && messages.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
              </div>
            ) : (
              messages.map((m, i) => {
                const isOwn = m.sender_id === currentUser.id;
                const prevMsg = i > 0 ? messages[i - 1] : null;
                const nextMsg = i < messages.length - 1 ? messages[i + 1] : null;
                
                const isStartOfGroup = !prevMsg || prevMsg.sender_id !== m.sender_id;
                const isEndOfGroup = !nextMsg || nextMsg.sender_id !== m.sender_id;
                
                const msgDate = new Date(m.created_at);
                const showDate = !prevMsg || (msgDate.getTime() - new Date(prevMsg.created_at).getTime() > 1000 * 60 * 30);

                return (
                  <React.Fragment key={m.id}>
                    {showDate && (
                      <div className="flex justify-center my-6">
                        <span className="text-[10px] font-black text-gray-400 dark:text-zinc-600 uppercase tracking-[0.2em]">
                          {msgDate.toLocaleDateString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
                        </span>
                      </div>
                    )}
                    
                    <div className={`flex items-end gap-2 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                      {!isOwn && (
                        <div className="w-8 h-8 flex-shrink-0 mb-1">
                          {isEndOfGroup ? (
                            <img 
                              src={activeChat.avatar_url || `https://ui-avatars.com/api/?name=${activeChat.username}`} 
                              className="w-8 h-8 rounded-full object-cover" 
                            />
                          ) : <div className="w-8" />}
                        </div>
                      )}
                      
                      <div className={`group relative max-w-[75%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                        <div 
                          className={`px-4 py-2.5 text-[15px] leading-relaxed break-words whitespace-pre-wrap ${
                            isOwn 
                              ? 'bg-blue-500 text-white' 
                              : 'bg-white dark:bg-zinc-900 text-black dark:text-white border border-gray-100 dark:border-zinc-800'
                          } ${
                            isOwn 
                              ? `rounded-2xl ${isStartOfGroup ? 'rounded-tr-2xl' : 'rounded-tr-md'} ${isEndOfGroup ? 'rounded-br-2xl' : 'rounded-br-md'}`
                              : `rounded-2xl ${isStartOfGroup ? 'rounded-tl-2xl' : 'rounded-tl-md'} ${isEndOfGroup ? 'rounded-bl-2xl' : 'rounded-bl-md'}`
                          }`}
                        >
                          {m.media_url && (
                            <div className="mb-2 -mx-2 -mt-2 rounded-xl overflow-hidden">
                              {m.media_type === 'video' ? (
                                <video src={m.media_url} controls className="max-w-full max-h-72" />
                              ) : (
                                <img src={m.media_url} className="max-w-full max-h-72 object-cover" />
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
                          <div className={`flex gap-0.5 mt-[-10px] z-10 ${isOwn ? 'mr-3' : 'ml-3'}`}>
                            {Array.from(new Set(m.reactions.map(r => r.reaction))).map(emoji => (
                              <div key={emoji} className="bg-white dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 rounded-full px-1.5 py-0.5 text-[12px] shadow-md flex items-center">
                                {emoji}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Action Buttons on Hover */}
                        <div className={`absolute top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${isOwn ? 'right-full mr-2' : 'left-full ml-2'}`}>
                          <button 
                            onClick={() => setShowReactionPicker(showReactionPicker === m.id ? null : m.id)}
                            className="p-2 text-gray-400 hover:text-pink-500 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-900"
                          >
                            <Smile className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => deleteMessage(m.id)}
                            className="p-2 text-gray-400 hover:text-red-500 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-900"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Reaction Picker */}
                        {showReactionPicker === m.id && (
                          <div className={`absolute bottom-full mb-2 bg-white dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 rounded-full p-1.5 flex gap-1 shadow-2xl z-50 animate-vix-in ${isOwn ? 'right-0' : 'left-0'}`}>
                            {REACTION_OPTIONS.map(emoji => (
                              <button key={emoji} onClick={() => toggleReaction(m.id, emoji)} className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-full transition-all text-xl">{emoji}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </React.Fragment>
                );
              })
            )}
            <div ref={messagesEndRef} className="h-4" />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white dark:bg-black border-t border-gray-100 dark:border-zinc-900">
            {mediaPreview && (
              <div className="relative inline-block mb-4 ml-2 animate-vix-in">
                <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-pink-500 shadow-xl">
                  {selectedFile?.type.startsWith('video') ? <video src={mediaPreview} className="w-full h-full object-cover" /> : <img src={mediaPreview} className="w-full h-full object-cover" />}
                </div>
                <button 
                  onClick={() => { setSelectedFile(null); setMediaPreview(null); }} 
                  className="absolute -top-2 -right-2 p-1.5 bg-black text-white rounded-full shadow-lg hover:bg-zinc-800 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            
            <div className="flex items-end gap-3 max-w-5xl mx-auto">
              <div className="flex-1 relative flex items-center bg-gray-100 dark:bg-zinc-900 rounded-2xl px-4 py-1.5">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 text-black dark:text-white hover:text-pink-500 transition-colors"
                >
                  <ImageIcon className="w-6 h-6" />
                </button>
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
                  placeholder={t('Send a message...')}
                  rows={1}
                  className="flex-1 bg-transparent border-none py-2 text-[15px] outline-none text-black dark:text-white resize-none max-h-32 no-scrollbar" 
                />
                <button 
                  onClick={() => setShowFullEmojiPicker(!showFullEmojiPicker)}
                  className={`p-1.5 transition-colors ${showFullEmojiPicker ? 'text-pink-500' : 'text-black dark:text-white hover:text-pink-500'}`}
                >
                  <Smile className="w-6 h-6" />
                </button>

                <button 
                  onClick={() => setShowStickerPicker(!showStickerPicker)}
                  className={`p-1.5 transition-colors ${showStickerPicker ? 'text-pink-500' : 'text-black dark:text-white hover:text-pink-500'}`}
                >
                  <StickerIcon className="w-6 h-6" />
                </button>

                {showFullEmojiPicker && (
                  <div className="absolute bottom-full right-0 mb-4 z-[200]">
                    <div className="fixed inset-0" onClick={() => setShowFullEmojiPicker(false)} />
                    <div className="relative">
                      <EmojiPicker 
                        onEmojiClick={(emojiData: EmojiClickData) => {
                          setText(prev => prev + emojiData.emoji);
                          setShowFullEmojiPicker(false);
                          messageInputRef.current?.focus();
                        }}
                        theme={EmojiTheme.AUTO}
                        lazyLoadEmojis={true}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center mb-1 relative">
                {showStickerPicker && (
                  <div className="absolute bottom-full right-0 mb-4 z-[200]">
                    <div className="fixed inset-0" onClick={() => setShowStickerPicker(false)} />
                    <div className="relative">
                      <StickerPicker 
                        currentUser={currentUser}
                        onSelect={(url) => {
                          sendSticker(url);
                          setShowStickerPicker(false);
                        }}
                        onClose={() => setShowStickerPicker(false)}
                      />
                    </div>
                  </div>
                )}
                {isUploading ? (
                  <div className="p-2">
                    <Loader2 className="w-6 h-6 animate-spin text-pink-500" />
                  </div>
                ) : (
                  <button 
                    onClick={sendMessage}
                    disabled={!text.trim() && !selectedFile}
                    className={`p-3 rounded-full transition-all shadow-lg active:scale-95 flex items-center justify-center ${text.trim() || selectedFile ? 'bg-pink-500 text-white' : 'bg-gray-100 dark:bg-zinc-800 text-gray-400'}`}
                  >
                    <Send className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
            <input ref={fileInputRef} type="file" className="hidden" accept="image/*,video/*" onChange={handleFileSelect} />
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 flex-col items-center justify-center bg-gray-50 dark:bg-black">
          <div className="w-24 h-24 bg-white dark:bg-zinc-900 rounded-full flex items-center justify-center mb-6 shadow-xl border border-gray-100 dark:border-zinc-800">
            <MessageCircle className="w-12 h-12 text-gray-300" />
          </div>
          <h3 className="text-xl font-bold text-black dark:text-white mb-2">{t('Your Messages')}</h3>
          <p className="text-gray-500 text-sm max-w-xs text-center">
            {t('Send private messages to your friends and followers.')}
          </p>
          <button 
            onClick={() => setShowNewChatModal(true)}
            className="mt-8 px-8 py-3 bg-pink-500 text-white rounded-full font-bold text-sm hover:bg-pink-600 transition-all shadow-lg active:scale-95"
          >
            {t('Send Message')}
          </button>
        </div>
      )}

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

      {showLiveStream && (
        <LiveStream 
          currentUser={currentUser}
          roomID={liveRoomID}
          isHost={true}
          onClose={() => setShowLiveStream(false)}
        />
      )}
    </div>
  );
};

export default Messages;
