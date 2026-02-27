
import React, { useState, useEffect } from 'react';
import { ViewType, UserProfile } from '../types';
import VerificationBadge from './VerificationBadge';
import { ShieldAlert, LogOut, Settings as SettingsIcon, Bell } from 'lucide-react';
import { useTranslation } from '../lib/translation';
import { supabase } from '../lib/supabase';

interface SidebarProps {
  currentView: ViewType;
  setView: (view: ViewType) => void;
  onLogout: () => void;
  currentUser?: UserProfile | null;
  isAdminUnlocked?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, onLogout, currentUser, isAdminUnlocked }) => {
  const { t } = useTranslation();
  const [unreadCount, setUnreadCount] = useState(0);
  const isActuallyAdmin = isAdminUnlocked || currentUser?.email === 'davidhen498@gmail.com';

  useEffect(() => {
    if (!currentUser) return;

    const fetchUnreadCount = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', currentUser.id)
        .eq('is_read', false);
      setUnreadCount(count || 0);
    };

    fetchUnreadCount();

    const channel = supabase
      .channel('sidebar-notifications')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${currentUser.id}`
      }, () => {
        fetchUnreadCount();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser]);
  
  const navItems = [
    { id: 'FEED' as ViewType, label: t('Home'), icon: 'fa-solid fa-house' },
    { id: 'SEARCH' as ViewType, label: t('Search'), icon: 'fa-solid fa-magnifying-glass' },
    { id: 'EXPLORE' as ViewType, label: t('Explore'), icon: 'fa-solid fa-compass' },
    { id: 'NOTIFICATIONS' as ViewType, label: t('Notifications'), icon: 'fa-solid fa-bell', badge: unreadCount },
    { id: 'CREATE' as ViewType, label: t('Create'), icon: 'fa-solid fa-square-plus' },
    { id: 'MESSAGES' as ViewType, label: t('Messages'), icon: 'fa-solid fa-paper-plane' },
    { id: 'GROUPS' as ViewType, label: t('Groups'), icon: 'fa-solid fa-users' },
    { id: 'PROFILE' as ViewType, label: t('Profile'), icon: 'fa-solid fa-user' },
  ];

  return (
    <>
      <div className="fixed left-0 top-0 h-screen w-16 lg:w-64 border-r border-[var(--vix-border)] bg-[var(--vix-bg)] hidden sm:flex flex-col p-6 z-50 transition-colors duration-300">
        <div className="mb-10 px-2">
          <h1 
            className="logo-font text-3xl vix-text-gradient hidden lg:block cursor-pointer"
            onClick={() => setView('FEED')}
          >
            VixReel
          </h1>
          <div className="lg:hidden w-8 h-8 vix-gradient rounded-xl flex items-center justify-center">
            <span className="logo-font text-xl text-white">V</span>
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          {navItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`w-full flex items-center p-3 rounded-2xl transition-all group ${
                  isActive ? 'bg-[var(--vix-secondary)] text-[var(--vix-text)] shadow-sm' : 'text-zinc-500 hover:bg-[var(--vix-secondary)] hover:text-[var(--vix-text)]'
                }`}
              >
                <div className={`w-6 h-6 flex items-center justify-center transition-transform relative ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                  <i className={`${item.icon} text-lg`}></i>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-black px-1 min-w-[14px] h-[14px] rounded-full flex items-center justify-center border border-[var(--vix-bg)]">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </div>
                <span className={`ml-4 hidden lg:block font-bold text-sm ${isActive ? 'text-[var(--vix-text)]' : 'text-zinc-400'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}

          {isActuallyAdmin && (
            <button
              onClick={() => setView('ADMIN')}
              className={`w-full flex items-center p-3 rounded-2xl mt-8 transition-all group ${
                currentView === 'ADMIN' ? 'bg-pink-600/20 text-pink-500 border border-pink-500/20' : 'text-pink-600/50 hover:bg-pink-900/10 hover:text-pink-500'
              }`}
            >
              <div className="w-6 h-6 flex items-center justify-center relative">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <span className="ml-4 hidden lg:block font-bold uppercase text-[10px] tracking-widest">{t('Admin Panel')}</span>
            </button>
          )}
        </nav>

        <div className="mt-auto pt-6 border-t border-[var(--vix-border)] space-y-4">
          {currentUser && (
            <div className="hidden lg:flex items-center gap-3 p-3 rounded-2xl bg-[var(--vix-card)] border border-[var(--vix-border)] cursor-pointer hover:bg-[var(--vix-secondary)] transition-colors" onClick={() => setView('PROFILE')}>
               <img src={currentUser.avatar_url || `https://ui-avatars.com/api/?name=${currentUser.username}`} className="w-8 h-8 rounded-full object-cover" />
               <div className="flex flex-col min-w-0">
                 <span className="font-bold text-xs truncate flex items-center gap-1 text-[var(--vix-text)]">
                   @{currentUser.username}
                   {currentUser.is_verified && <VerificationBadge size="w-3.5 h-3.5" />}
                 </span>
                 <span className="text-[8px] text-zinc-600 font-bold uppercase">{currentUser.is_admin ? t('Admin') : t('Member')}</span>
               </div>
            </div>
          )}
          <button 
            onClick={() => setView('SETTINGS')}
            className={`w-full flex items-center p-3 rounded-2xl transition-all group ${currentView === 'SETTINGS' ? 'bg-[var(--vix-secondary)] text-[var(--vix-text)]' : 'text-zinc-500 hover:bg-[var(--vix-secondary)] hover:text-[var(--vix-text)]'}`}
          >
            <div className="w-6 h-6 flex items-center justify-center">
              <SettingsIcon className="w-5 h-5" />
            </div>
            <span className="ml-4 hidden lg:block font-bold text-sm">{t('Settings')}</span>
          </button>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 h-16 bg-[var(--vix-bg)] border-t border-[var(--vix-border)] sm:hidden flex items-center justify-around z-50 transition-colors duration-300">
        {navItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`p-3 transition-all relative ${isActive ? 'text-pink-500 scale-125' : 'text-zinc-400'}`}
            >
              <i className={`${item.icon} text-xl`}></i>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="absolute top-2 right-2 bg-red-500 text-white text-[8px] font-black px-1 min-w-[12px] h-[12px] rounded-full flex items-center justify-center border border-[var(--vix-bg)]">
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
};

export default Sidebar;
