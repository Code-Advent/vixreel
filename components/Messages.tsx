
import React, { useState, useEffect, useRef } from 'react';
import { Send, User, ChevronLeft, MessageCircle, Loader2 } from 'lucide-react';
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
      .channel('vix-messages-realtime')
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

    return () => {
      supabase.removeChannel(channel);
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
    
    const uniqueUsersMap = new Map();
    sent?.forEach(m => m.receiver && uniqueUsersMap.set(m.receiver.id, m.receiver));
    recv?.forEach(m => m.sender && uniqueUsersMap.set(m.sender.id, m.sender));
    
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
    }
  };

  return (
    <div className="max-w-[935px] mx-auto h-[85vh] border border-zinc-900 rounded-[2.5rem] flex overflow-hidden mt-2 bg-black shadow-[0_0_100px_rgba(0,0,0,0.8)] border-t-white/5">
      {/* Sidebar - Chat List */}
      <div className={`w-full md:w-80 border-r border-zinc-900 flex flex-col ${activeChat ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-6 border-b border-zinc-900 flex items-center justify-between">
          <span className="font-black uppercase text-[10px] tracking-[0.3em] text-zinc-500">Narrative Grid</span>
          <MessageCircle className="w-4 h-4 text-zinc-800" />
        </div>
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {chats.map(u => (
            <div 
              key={u.id} 
              onClick={() => setActiveChat(u)}
              className={`flex items-center gap-4 p-5 cursor-pointer transition-all duration-300 ${activeChat?.id === u.id ? 'bg-zinc-900/80 border-l-[3px] border-pink-500' : 'hover:bg-zinc-900/30 border-l-[3px] border-transparent'}`}
            >
              <div className="relative">
                <img src={u.avatar_url || `https://ui-avatars.com/api/?name=${u.username}`} className="w-12 h-12 rounded-full border border-zinc-800 object-cover" />
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-black rounded-full"></div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm truncate flex items-center gap-1.5 text-zinc-200">
                  {u.username} {u.is_verified && <VerificationBadge size="w-3.5 h-3.5" />}
                </div>
                <div className="text-[9px] text-zinc-600 font-black uppercase tracking-widest mt-0.5">Established Signal</div>
              </div>
            </div>
          ))}
          {chats.length === 0 && (
            <div className="p-12 text-center">
              <p className="text-zinc-700 text-[10px] font-black uppercase tracking-widest">No Signals Found</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={`flex-1 flex flex-col bg-zinc-950/40 backdrop-blur-3xl ${!activeChat ? 'hidden md:flex items-center justify-center' : 'flex'}`}>
        {activeChat ? (
          <>
            <div className="p-5 border-b border-zinc-900 flex items-center justify-between bg-zinc-900/50">
              <div className="flex items-center gap-4">
                <button onClick={() => setActiveChat(null)} className="md:hidden p-2 text-zinc-400"><ChevronLeft className="w-6 h-6" /></button>
                <div className="relative">
                  <img src={activeChat.avatar_url || `https://ui-avatars.com/api/?name=${activeChat.username}`} className="w-10 h-10 rounded-full border border-zinc-800" />
                </div>
                <div>
                  <div className="font-bold text-sm flex items-center gap-1.5 text-white">
                    {activeChat.username} {activeChat.is_verified && <VerificationBadge size="w-4 h-4" />}
                  </div>
                  <span className="text-[9px] text-green-500 font-black uppercase tracking-tighter">Encrypted Protocol Active</span>
                </div>
              </div>
            </div>

            <div className="flex-1 p-6 overflow-y-auto space-y-5 no-scrollbar bg-[radial-gradient(circle_at_top_right,_rgba(255,0,128,0.03)_0%,_transparent_50%)]">
              {loading ? (
                <div className="h-full flex items-center justify-center"><Loader2 className="w-8 h-8 text-zinc-800 animate-spin" /></div>
              ) : (
                messages.map(m => (
                  <div key={m.id} className={`flex ${m.sender_id === currentUser.id ? 'justify-end' : 'justify-start'} animate-vix-in`}>
                    <div className={`p-4 rounded-[1.5rem] max-w-[80%] text-[13px] shadow-2xl ${
                      m.sender_id === currentUser.id 
                        ? 'vix-gradient text-white rounded-tr-none border border-white/10' 
                        : 'bg-zinc-900 text-zinc-300 rounded-tl-none border border-zinc-800 shadow-black'
                    }`}>
                      <p className="leading-relaxed">{m.content}</p>
                      <div className={`text-[8px] opacity-50 mt-2 font-black uppercase tracking-widest ${m.sender_id === currentUser.id ? 'text-right' : 'text-left'}`}>
                        {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={sendMessage} className="p-6 bg-zinc-900/80 border-t border-zinc-800 flex gap-4">
              <input 
                value={text} 
                onChange={e => setText(e.target.value)} 
                placeholder="Synchronize a signal..." 
                className="flex-1 bg-black border border-zinc-800 rounded-2xl px-6 py-4 text-sm focus:border-pink-500/30 outline-none transition-all text-white placeholder:text-zinc-800" 
              />
              <button 
                type="submit" 
                disabled={!text.trim()}
                className="vix-gradient p-4 rounded-2xl shadow-2xl shadow-pink-500/20 active:scale-95 transition-all disabled:opacity-20"
              >
                <Send className="w-5 h-5 text-white" />
              </button>
            </form>
          </>
        ) : (
          <div className="text-center space-y-6">
            <div className="w-24 h-24 rounded-[2rem] bg-zinc-900/50 flex items-center justify-center mx-auto border border-zinc-800 border-dashed">
              <MessageCircle className="w-10 h-10 text-zinc-800" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black uppercase tracking-[0.2em] text-zinc-300">Signal Terminal</h3>
              <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest max-w-xs mx-auto leading-loose">
                Establish a direct narrative connection with other creators across the social grid.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Messages;
