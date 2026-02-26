
import React, { useState, useEffect } from 'react';
import { Bell, Heart, MessageCircle, UserPlus, AtSign, Repeat2, Columns2, Scissors, Loader2, Trash2, CheckCircle2 } from 'lucide-react';
import { UserProfile, Notification } from '../types';
import { useTranslation } from '../lib/translation';
import { supabase } from '../lib/supabase';
import VerificationBadge from './VerificationBadge';

interface NotificationsProps {
  currentUser: UserProfile;
  onSelectUser?: (user: UserProfile) => void;
  onSelectPost?: (postId: string) => void;
}

const Notifications: React.FC<NotificationsProps> = ({ currentUser, onSelectUser, onSelectPost }) => {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();

    const subscription = supabase
      .channel('notifications_realtime')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notifications',
        filter: `user_id=eq.${currentUser.id}`
      }, (payload) => {
        fetchNotifications(); // Refresh on new notification
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [currentUser.id]);

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          actor:profiles!actor_id(*),
          post:posts(*)
        `)
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setNotifications(data as any);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'LIKE': return <Heart className="w-4 h-4 text-pink-500 fill-pink-500" />;
      case 'COMMENT': return <MessageCircle className="w-4 h-4 text-blue-500" />;
      case 'FOLLOW': return <UserPlus className="w-4 h-4 text-green-500" />;
      case 'MENTION': return <AtSign className="w-4 h-4 text-purple-500" />;
      case 'REPOST': return <Repeat2 className="w-4 h-4 text-orange-500" />;
      case 'DUET': return <Columns2 className="w-4 h-4 text-indigo-500" />;
      case 'STITCH': return <Scissors className="w-4 h-4 text-rose-500" />;
      default: return <Bell className="w-4 h-4 text-zinc-500" />;
    }
  };

  const getMessage = (n: Notification) => {
    switch (n.type) {
      case 'LIKE': return t('liked your post');
      case 'COMMENT': return `${t('commented on your post')}: "${n.content}"`;
      case 'FOLLOW': return t('started following you');
      case 'MENTION': return t('mentioned you in a post');
      case 'REPOST': return t('reposted your narrative');
      case 'DUET': return t('created a duet with your signal');
      case 'STITCH': return t('stitched your narrative');
      default: return t('interacted with you');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-40">
        <Loader2 className="w-10 h-10 animate-spin text-zinc-800" />
      </div>
    );
  }

  return (
    <div className="max-w-[600px] mx-auto py-8 px-4 relative animate-vix-in">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold uppercase tracking-widest text-[var(--vix-text)]">{t('Notifications')}</h2>
        {notifications.some(n => !n.is_read) && (
          <button 
            onClick={async () => {
              await supabase.from('notifications').update({ is_read: true }).eq('user_id', currentUser.id);
              setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            }}
            className="text-[9px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-400 transition-colors"
          >
            {t('Mark all as read')}
          </button>
        )}
      </div>

      {notifications.length > 0 ? (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div 
              key={n.id}
              onClick={() => markAsRead(n.id)}
              className={`flex items-center gap-4 p-4 rounded-[2rem] border transition-all group cursor-pointer ${
                n.is_read 
                  ? 'bg-[var(--vix-card)] border-[var(--vix-border)] opacity-60' 
                  : 'bg-[var(--vix-secondary)] border-blue-500/20 shadow-lg shadow-blue-500/5'
              }`}
            >
              <div className="relative" onClick={(e) => { e.stopPropagation(); if (n.actor) onSelectUser?.(n.actor); }}>
                <img 
                  src={n.actor?.avatar_url || `https://ui-avatars.com/api/?name=${n.actor?.username}`} 
                  className="w-12 h-12 rounded-full object-cover border border-[var(--vix-border)]" 
                />
                <div className="absolute -bottom-1 -right-1 bg-[var(--vix-card)] p-1.5 rounded-full border border-[var(--vix-border)] shadow-sm">
                  {getIcon(n.type)}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm text-[var(--vix-text)] leading-tight">
                  <span className="font-bold mr-1" onClick={(e) => { e.stopPropagation(); if (n.actor) onSelectUser?.(n.actor); }}>
                    @{n.actor?.username}
                  </span>
                  <span className="text-zinc-500">{getMessage(n)}</span>
                </p>
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mt-1 block">
                  {new Date(n.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </span>
              </div>

              {n.post && (
                <div 
                  onClick={(e) => { e.stopPropagation(); onSelectPost?.(n.post!.id); }}
                  className="w-12 h-12 rounded-xl overflow-hidden border border-[var(--vix-border)] flex-shrink-0 cursor-pointer hover:scale-105 transition-transform"
                >
                  {n.post.media_type === 'video' ? (
                    <video src={n.post.media_url} className="w-full h-full object-cover" />
                  ) : (
                    <img src={n.post.media_url} className="w-full h-full object-cover" />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-500 text-center">
          <div className="w-24 h-24 rounded-[2rem] bg-[var(--vix-secondary)] border border-[var(--vix-border)] flex items-center justify-center mb-8 shadow-2xl">
            <Bell className="w-10 h-10 text-zinc-700" />
          </div>
          <h3 className="text-xl font-black text-[var(--vix-text)] mb-3 uppercase tracking-tight">{t('No signals detected')}</h3>
          <p className="max-w-xs text-[11px] font-medium leading-loose uppercase tracking-widest opacity-40">
            {t('When creators interact with your narrative, alerts will manifest here.')}
          </p>
        </div>
      )}
    </div>
  );
};

export default Notifications;
