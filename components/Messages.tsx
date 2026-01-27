
import React, { useState, useEffect } from 'react';
import { Send, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { UserProfile, Message } from '../types';

interface MessagesProps {
  currentUser: UserProfile;
}

const Messages: React.FC<MessagesProps> = ({ currentUser }) => {
  const [chats, setChats] = useState<UserProfile[]>([]);
  const [activeChat, setActiveChat] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');

  useEffect(() => {
    fetchChats();
  }, []);

  useEffect(() => {
    if (activeChat) fetchMessages();
  }, [activeChat]);

  const fetchChats = async () => {
    const { data } = await supabase.from('profiles').select('*').neq('id', currentUser.id).limit(10);
    if (data) setChats(data);
  };

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${activeChat?.id}),and(sender_id.eq.${activeChat?.id},receiver_id.eq.${currentUser.id})`)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
  };

  const sendMessage = async () => {
    if (!text.trim() || !activeChat) return;
    const { error } = await supabase.from('messages').insert({
      sender_id: currentUser.id,
      receiver_id: activeChat.id,
      content: text
    });
    if (!error) {
      setText('');
      fetchMessages();
    }
  };

  return (
    <div className="max-w-[935px] mx-auto h-[80vh] border border-zinc-800 rounded-lg flex overflow-hidden mt-4 bg-black">
      <div className="w-80 border-r border-zinc-800 flex flex-col">
        <div className="p-4 border-b border-zinc-800 font-bold">{currentUser.username}</div>
        <div className="flex-1 overflow-y-auto">
          {chats.map(u => (
            <div 
              key={u.id} 
              onClick={() => setActiveChat(u)}
              className={`flex items-center gap-3 p-4 cursor-pointer hover:bg-zinc-900 ${activeChat?.id === u.id ? 'bg-zinc-900' : ''}`}
            >
              <img src={u.avatar_url || `https://ui-avatars.com/api/?name=${u.username}`} className="w-12 h-12 rounded-full" />
              <div className="font-semibold text-sm">{u.username}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 flex flex-col bg-black">
        {activeChat ? (
          <>
            <div className="p-4 border-b border-zinc-800 font-bold flex items-center gap-3">
              <img src={activeChat.avatar_url || `https://ui-avatars.com/api/?name=${activeChat.username}`} className="w-8 h-8 rounded-full" />
              {activeChat.username}
            </div>
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
              {messages.map(m => (
                <div key={m.id} className={`flex ${m.sender_id === currentUser.id ? 'justify-end' : 'justify-start'}`}>
                  <div className={`p-3 rounded-2xl max-w-xs text-sm ${m.sender_id === currentUser.id ? 'vix-gradient text-white' : 'bg-zinc-800 text-white'}`}>
                    {m.content}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-zinc-800 flex gap-3">
              <input 
                value={text} 
                onChange={e => setText(e.target.value)}
                placeholder="Message..." 
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-full px-4 py-2 outline-none text-sm text-white"
              />
              <button onClick={sendMessage} className="vix-text-gradient font-bold"><Send className="w-6 h-6" /></button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-stone-500">Select a chat to start messaging</div>
        )}
      </div>
    </div>
  );
};

export default Messages;
