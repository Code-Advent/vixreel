
import React, { useState, useEffect, useRef } from 'react';
import { Send, User, ChevronLeft, MessageCircle } from 'lucide-react';
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
    const interval = setInterval(fetchChats, 10000); // Polling for new chats
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeChat) {
      fetchMessages();
      const interval = setInterval(fetchMessages, 3000); // More frequent polling for active chat
      return () => clearInterval(interval);
    }
  }, [activeChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchChats = async () => {
    // Queries both sent and received messages to find unique conversation partners
    const { data: sent } = await supabase.from('messages').select('receiver:profiles(*)').eq('sender_id', currentUser.id);
    const { data: recv } = await supabase.from('messages').select('sender:profiles(*)').eq('receiver_id', currentUser.id);
    
    const uniqueUsersMap = new Map();
    sent?.forEach(m => m.receiver && uniqueUsersMap.set(m.receiver.id, m.receiver));
    recv?.forEach(m => m.sender && uniqueUsersMap.set(m.sender.id, m.sender));
    
    setChats(Array.from(uniqueUsersMap.values()));
  };

  const fetchMessages = async () => {
    if (!activeChat) return;
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${activeChat.id}),and(sender_id.eq.${activeChat.id},receiver_id.eq.${currentUser.id})`)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
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
    if (!error) fetchMessages();
  };

  return (
    <div className="max-w-[935px] mx-auto h-[85vh] border border-zinc-900 rounded-2xl flex overflow-hidden mt-2 bg-black shadow-2xl">
      <div className={`w-full md:w-80 border-r border-zinc-900 flex flex-col ${activeChat ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-5 border-b border-zinc-900 font-black uppercase text-xs tracking-[0.2em] text-zinc-500">Inbox</div>
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {chats.map(u => (
            <div 
              key={u.id} 
              onClick={() => setActiveChat(u)}
              className={`flex items-center gap-3 p-4 cursor-pointer transition-colors ${activeChat?.id === u.id ? 'bg-zinc-900 border-l-4 border-pink-500' : 'hover:bg-zinc-900/50 border-l-4 border-transparent'}`}
            >
              <img src={u.avatar_url || `https://ui-avatars.com/api/?name=${u.username}`} className="w-10 h-10 rounded-full bg-zinc-800" />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm truncate flex items-center">
                  {u.username} {u.is_verified && <VerificationBadge size="w-3 h-3" />}
                </div>
                <div className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Active Chat</div>
              </div>
            </div>
          ))}
          {chats.length === 0 && <div className="p-10 text-center text-zinc-700 text-xs italic">No messages yet.</div>}
        </div>
      </div>

      <div className={`flex-1 flex flex-col bg-zinc-950/20 ${!activeChat ? 'hidden md:flex items-center justify-center' : 'flex'}`}>
        {activeChat ? (
          <>
            <div className="p-4 border-b border-zinc-900 flex items-center gap-3 bg-black">
              <button onClick={() => setActiveChat(null)} className="md:hidden p-2"><ChevronLeft className="w-5 h-5" /></button>
              <img src={activeChat.avatar_url || `https://ui-avatars.com/api/?name=${activeChat.username}`} className="w-8 h-8 rounded-full" />
              <div className="font-bold text-sm flex items-center">{activeChat.username} {activeChat.is_verified && <VerificationBadge size="w-3.5 h-3.5" />}</div>
            </div>
            <div className="flex-1 p-6 overflow-y-auto space-y-4 no-scrollbar">
              {messages.map(m => (
                <div key={m.id} className={`flex ${m.sender_id === currentUser.id ? 'justify-end' : 'justify-start'}`}>
                  <div className={`p-4 rounded-2xl max-w-[75%] text-sm shadow-md ${m.sender_id === currentUser.id ? 'vix-gradient text-white rounded-tr-none' : 'bg-zinc-800 text-zinc-200 rounded-tl-none border border-zinc-700'}`}>
                    {m.content}
                    <div className="text-[8px] opacity-40 mt-1 text-right">{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={sendMessage} className="p-5 bg-black border-t border-zinc-900 flex gap-3">
              <input value={text} onChange={e => setText(e.target.value)} placeholder="Send a direct message..." className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-zinc-700 outline-none" />
              <button type="submit" className="vix-gradient p-3 rounded-xl shadow-lg shadow-pink-500/20"><Send className="w-5 h-5 text-white" /></button>
            </form>
          </>
        ) : (
          <div className="text-center space-y-4">
            <MessageCircle className="w-16 h-16 text-zinc-800 mx-auto" />
            <h3 className="text-xl font-bold">Creator Inbox</h3>
            <p className="text-zinc-600 text-sm max-w-xs">Chat privately with your favorite creators.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Messages;
