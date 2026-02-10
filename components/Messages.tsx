
import React, { useState, useEffect, useRef } from 'react';
import { Send, User, ChevronLeft, MessageCircle, Loader2, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { UserProfile, Message } from '../types';
import VerificationBadge from './VerificationBadge';

interface MessagesProps {
  currentUser: UserProfile;
  initialChatUser?: UserProfile | null;
}

const Messages: React.FC<MessagesProps> = ({ currentUser, initialChatUser }) => {
  const [chats, setChats] = useState<UserProfile[]>([]);
  const [activeChat, setActiveChat] = useState<UserProfile | null>(initialChatUser || null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchChats();
    
    // Subscribe to new messages real-time
    const channel = supabase
      .channel('vix-messages-realtime-global')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newMsg = payload.new as Message;
          // Only append if message is relevant to current active chat
          if (activeChat && (
            (newMsg.sender_id === activeChat.id && newMsg.receiver_id === currentUser.id) ||
            (newMsg.sender_id === currentUser.id && newMsg.receiver_id === activeChat.id)
          )) {
            setMessages(prev => [...prev, newMsg]);
          }
          fetchChats(); // Refresh sidebar to show latest activity
        }
      )
      .subscribe();

    // Listen for global identity updates (Verification)
    const handleIdentityUpdate = (e: any) => {
      const { id, ...updates } = e.detail;
      setChats(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u));
      if (activeChat?.id === id) {
        setActiveChat(prev => prev ? { ...prev, ...updates } : null);
      }
    };

    window.addEventListener('vixreel-user-updated', handleIdentityUpdate);
    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('vixreel-user-updated', handleIdentityUpdate);
    };
  }, [activeChat, currentUser.id]);

  useEffect(() => {
    if (activeChat) {
      fetchMessages();
    }
  }, [activeChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchChats = async () => {
    const { data: sent } = await supabase.from('messages').select('receiver:profiles(*)').eq('sender_id', currentUser.id);
    const { data: recv } = await supabase.from('messages').select('sender:profiles(*)').eq('receiver_id', currentUser.id);
    
    const uniqueUsersMap = new Map<string, UserProfile>();
    
    // Add initial user if exists (ensures they appear even if no messages exist)
    if (initialChatUser) {
      uniqueUsersMap.set(initialChatUser.id, initialChatUser);
    }

    sent?.forEach(m => {
      const u = m.receiver as unknown as UserProfile;
      if (u) uniqueUsersMap.set(u.id, u);
    });
    
    recv?.forEach(m => {
      const u = m.sender as unknown as UserProfile;
      if (u) uniqueUsersMap.set(u.id, u);
    });
    
    setChats(Array.from(uniqueUsersMap.values()));
  };

  const fetchMessages = async () => {
    if (!activeChat) return;
    setLoading(true);
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${activeChat.id}),and(sender_id.eq.${activeChat.id},receiver_id.eq.${currentUser.id})`)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
    setLoading(false);
  };

  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!text.trim() || !activeChat) return;
    
    const msgText = text;
    setText('');
    
    const { error } = await supabase.from('messages').insert({
      sender_id: currentUser.id,
      receiver_id: activeChat.id,
      content: msgText
    });
    
    if (error) {
      console.error("Message transmission failure", error);
      setText(msgText); // Restore text on failure
    } else {
      fetchChats(); // Update chat list immediately for new conversations
    }
  };

  return (
    <div className="max-w-[935px] mx-auto h-[88vh] border border-zinc-900 rounded-[3rem] flex overflow-hidden mt-4 bg-black shadow-2xl">
      {/* Sidebar - Chat List */}
      <div className={`w-full md:w-80 border-r border-zinc-900 flex flex-col ${activeChat ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-8 border-b border-zinc-900 flex items-center justify-between bg-zinc-900/20">
          <span className="font-black uppercase text-[11px] tracking-[0.4em] text-zinc-500">Narrative Grid</span>
          <MessageCircle className="w-5 h-5 text-zinc-800" />
        </div>
        <div className="flex-1 overflow-y-auto no-scrollbar bg-black">
          {chats.map(u => (
            <div 
              key={u.id} 
              onClick={() => setActiveChat(u)}
              className={`flex items-center gap-4 p-6 cursor-pointer transition-all duration-300 border-b border-zinc-900/30 ${activeChat?.id === u.id ? 'bg-zinc-900/60 border-l-[4px] border-pink-500' : 'hover:bg-zinc-900/20 border-l-[4px] border-transparent'}`}
            >
              <div className="relative shrink-0">
                <img src={u.avatar_url || `https://ui-avatars.com/api/?name=${u.username}`} className="w-12 h-12 rounded-full border border-zinc-800 object-cover shadow-lg" />
                <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-black rounded-full"></div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-black text-[14px] truncate flex items-center gap-1.5 text-zinc-200">
                  {u.username} {u.is_verified && <VerificationBadge size="w-3.5 h-3.5" />}
                </div>
                <div className="text-[9px] text-zinc-600 font-black uppercase tracking-widest mt-1">Established Signal</div>
              </div>
            </div>
          ))}
          {chats.length === 0 && (
            <div className="p-20 text-center opacity-30 flex flex-col items-center">
              <div className="w-16 h-16 rounded-[2rem] bg-zinc-900 flex items-center justify-center mb-6 border border-zinc-800 border-dashed">
                <MessageCircle className="w-8 h-8 text-zinc-700" />
              </div>
              <p className="text-zinc-700 text-[10px] font-black uppercase tracking-[0.4em]">Empty Grid</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={`flex-1 flex flex-col bg-zinc-950/40 backdrop-blur-3xl ${!activeChat ? 'hidden md:flex items-center justify-center' : 'flex'}`}>
        {activeChat ? (
          <>
            <div className="p-6 border-b border-zinc-900 flex items-center justify-between bg-zinc-900/50 backdrop-blur-xl z-20">
              <div className="flex items-center gap-5">
                <button onClick={() => setActiveChat(null)} className="md:hidden p-3 -ml-3 text-zinc-500 hover:text-white transition-colors"><ArrowLeft className="w-6 h-6" /></button>
                <div className="relative">
                  <img src={activeChat.avatar_url || `https://ui-avatars.com/api/?name=${activeChat.username}`} className="w-11 h-11 rounded-full border border-zinc-800 object-cover shadow-xl" />
                </div>
                <div>
                  <div className="font-black text-[16px] flex items-center gap-2 text-white">
                    {activeChat.username} {activeChat.is_verified && <VerificationBadge size="w-4 h-4" />}
                  </div>
                  <span className="text-[9px] text-green-500 font-black uppercase tracking-widest flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                    Secure Signal
                  </span>
                </div>
              </div>
            </div>

            <div className="flex-1 p-8 overflow-y-auto space-y-6 no-scrollbar bg-[radial-gradient(circle_at_bottom_left,_rgba(255,0,128,0.02)_0%,_transparent_50%)]">
              {loading ? (
                <div className="h-full flex items-center justify-center"><Loader2 className="w-8 h-8 text-zinc-800 animate-spin" /></div>
              ) : (
                messages.map(m => (
                  <div key={m.id} className={`flex ${m.sender_id === currentUser.id ? 'justify-end' : 'justify-start'} animate-vix-in`}>
                    <div className={`p-5 px-8 rounded-[2.5rem] max-w-[85%] sm:max-w-[65%] text-[14px] shadow-2xl relative group ${
                      m.sender_id === currentUser.id 
                        ? 'vix-gradient text-white rounded-tr-none border border-white/10' 
                        : 'bg-zinc-900 text-zinc-300 rounded-tl-none border border-zinc-800'
                    }`}>
                      <p className="leading-relaxed font-medium">{m.content}</p>
                      <div className={`text-[8px] opacity-40 mt-3 font-black uppercase tracking-widest ${m.sender_id === currentUser.id ? 'text-right' : 'text-left'}`}>
                        {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={sendMessage} className="p-8 bg-zinc-900/40 border-t border-zinc-900 flex gap-5 backdrop-blur-2xl">
              <input 
                value={text} 
                onChange={e => setText(e.target.value)} 
                placeholder="Synchronize signal..." 
                className="flex-1 bg-black/60 border border-zinc-800 rounded-[2.5rem] px-10 py-5 text-sm focus:border-pink-500/30 outline-none transition-all text-white placeholder:text-zinc-800 font-medium shadow-inner" 
              />
              <button 
                type="submit" 
                disabled={!text.trim()}
                className="vix-gradient p-5 rounded-full shadow-2xl shadow-pink-500/20 active:scale-90 transition-all disabled:opacity-20 shrink-0"
              >
                <Send className="w-5 h-5 text-white" />
              </button>
            </form>
          </>
        ) : (
          <div className="text-center space-y-10 animate-vix-in p-12">
            <div className="w-32 h-32 rounded-[4rem] bg-zinc-900/30 flex items-center justify-center mx-auto border border-zinc-800 border-dashed shadow-2xl">
              <MessageCircle className="w-14 h-14 text-zinc-800" />
            </div>
            <div className="space-y-4">
              <h3 className="text-3xl font-black uppercase tracking-[0.5em] text-zinc-400">CORE STANDBY</h3>
              <p className="text-zinc-700 text-[11px] font-black uppercase tracking-[0.2em] max-w-sm mx-auto leading-loose opacity-60">
                Establish direct narrative synchronization with creators across the encrypted grid. Select a fragment to initialize terminal.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Messages;
