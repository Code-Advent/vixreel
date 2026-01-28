
import React, { useState, useEffect, useRef } from 'react';
// Added MessageCircle to the imports from lucide-react
import { Send, User, ChevronLeft, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { UserProfile, Message } from '../types';

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
  }, []);

  useEffect(() => {
    if (activeChat) {
      fetchMessages();
      // Ensure active chat is in the list
      setChats(prev => {
        if (!prev.find(c => c.id === activeChat.id)) return [activeChat, ...prev];
        return prev;
      });
    }
  }, [activeChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchChats = async () => {
    // Basic logic: find everyone user has messaged or was messaged by
    const { data: sent } = await supabase.from('messages').select('receiver:profiles(*)').eq('sender_id', currentUser.id);
    const { data: recv = [] } = await supabase.from('messages').select('sender:profiles(*)').eq('receiver_id', currentUser.id);
    
    const uniqueUsersMap = new Map();
    sent?.forEach(m => uniqueUsersMap.set(m.receiver.id, m.receiver));
    recv?.forEach(m => uniqueUsersMap.set(m.sender.id, m.sender));
    
    setChats(Array.from(uniqueUsersMap.values()));
  };

  const fetchMessages = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${activeChat?.id}),and(sender_id.eq.${activeChat?.id},receiver_id.eq.${currentUser.id})`)
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
    
    if (!error) {
      fetchMessages();
    }
  };

  return (
    <div className="max-w-[935px] mx-auto h-[85vh] border border-zinc-800 rounded-2xl flex overflow-hidden mt-2 bg-black shadow-2xl">
      {/* Sidebar - Hidden on mobile if chat active */}
      <div className={`w-full md:w-80 border-r border-zinc-800 flex flex-col ${activeChat ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-5 border-b border-zinc-800 font-bold text-lg flex items-center justify-between">
          <span>Messages</span>
        </div>
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {chats.length > 0 ? chats.map(u => (
            <div 
              key={u.id} 
              onClick={() => setActiveChat(u)}
              className={`flex items-center gap-3 p-4 cursor-pointer hover:bg-zinc-900 transition-colors ${activeChat?.id === u.id ? 'bg-zinc-900 border-l-4 border-pink-500' : 'border-l-4 border-transparent'}`}
            >
              <img src={u.avatar_url || `https://ui-avatars.com/api/?name=${u.username}`} className="w-12 h-12 rounded-full border border-zinc-800" />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm truncate">{u.username}</div>
                <div className="text-[10px] text-zinc-500 truncate">Tap to chat</div>
              </div>
            </div>
          )) : (
            <div className="p-10 text-center text-zinc-600 italic text-sm">No conversations yet. Go discover creators!</div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`flex-1 flex flex-col bg-zinc-950/20 ${!activeChat ? 'hidden md:flex items-center justify-center' : 'flex'}`}>
        {activeChat ? (
          <>
            <div className="p-4 border-b border-zinc-800 flex items-center gap-3 bg-black">
              <button onClick={() => setActiveChat(null)} className="md:hidden p-2 text-zinc-400"><ChevronLeft /></button>
              <div className="w-10 h-10 rounded-full vix-gradient p-[1px]">
                <img src={activeChat.avatar_url || `https://ui-avatars.com/api/?name=${activeChat.username}`} className="w-full h-full rounded-full bg-black" />
              </div>
              <div className="font-bold">{activeChat.username}</div>
            </div>
            
            <div className="flex-1 p-6 overflow-y-auto space-y-4 no-scrollbar">
              {messages.map(m => (
                <div key={m.id} className={`flex ${m.sender_id === currentUser.id ? 'justify-end' : 'justify-start'}`}>
                  <div className={`p-4 rounded-2xl max-w-[70%] text-sm shadow-lg ${m.sender_id === currentUser.id ? 'vix-gradient text-white rounded-tr-none' : 'bg-zinc-800 text-white rounded-tl-none border border-zinc-700'}`}>
                    {m.content}
                    <div className="text-[8px] opacity-50 mt-1 text-right">
                      {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={sendMessage} className="p-6 bg-black border-t border-zinc-800 flex gap-3">
              <input 
                value={text} 
                onChange={e => setText(e.target.value)}
                placeholder="Message..." 
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-3 outline-none text-sm text-white focus:border-zinc-700 transition-colors"
              />
              <button type="submit" className="vix-gradient p-3 rounded-2xl shadow-lg shadow-pink-500/20 hover:scale-105 active:scale-95 transition-all">
                <Send className="w-6 h-6 text-white" />
              </button>
            </form>
          </>
        ) : (
          <div className="text-center space-y-6 max-w-xs animate-in fade-in duration-500">
            <div className="w-20 h-20 rounded-full border-2 border-zinc-800 flex items-center justify-center mx-auto mb-6">
               <MessageCircle className="w-10 h-10 text-zinc-700" />
            </div>
            <h3 className="text-2xl font-bold">Your Inbox</h3>
            <p className="text-zinc-500 text-sm">Send private photos and messages to a friend or creator on VixReel.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Messages;
