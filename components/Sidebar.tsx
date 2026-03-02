
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
    { id: 'LIVE' as ViewType, label: t('Live'), icon: 'fa-solid fa-tower-broadcast' },
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
      <div className="fixed left-0 top-0 h-screen w-20 lg:w-64 border-r border-[var(--vix-border)] bg-[var(--vix-bg)] hidden sm:flex flex-col py-8 px-4 z-50 transition-all duration-300 shrink-0">
        <div className="mb-10 px-4">
          <h1 
            className="logo-font text-3xl vix-text-gradient hidden lg:block cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => setView('FEED')}
          >
            VixReel
          </h1>
          <div className="lg:hidden w-12 h-12 vix-gradient rounded-2xl flex items-center justify-center shadow-lg shadow-pink-500/20 mx-auto">
            <span className="logo-font text-2xl text-white">V</span>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`w-full flex items-center p-3 lg:p-4 rounded-2xl transition-all group relative ${
                  isActive ? 'bg-[var(--vix-secondary)] text-[var(--vix-text)]' : 'text-zinc-500 hover:bg-[var(--vix-secondary)]/40 hover:text-[var(--vix-text)]'
                }`}
              >
                <div className={`w-6 h-6 flex items-center justify-center transition-all duration-300 ${isActive ? 'scale-110 text-pink-500' : 'group-hover:scale-110 group-hover:text-pink-400'}`}>
                  <i className={`${item.icon} text-xl`}></i>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 lg:-top-2 lg:-right-2 bg-pink-500 text-white text-[8px] font-black px-1 min-w-[16px] h-[16px] rounded-full flex items-center justify-center border-2 border-[var(--vix-bg)] shadow-lg">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </div>
                <span className={`ml-4 hidden lg:block font-bold text-sm tracking-tight ${isActive ? 'text-[var(--vix-text)]' : 'text-zinc-500'}`}>
                  {item.label}
                </span>
                {isActive && <div className="absolute right-0 w-1 h-5 vix-gradient rounded-l-full hidden lg:block" />}
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

        <div className="mt-auto pt-6 border-t border-[var(--vix-border)] space-y-2">
          <button 
            onClick={() => setView('SETTINGS')}
            className={`w-full flex items-center p-3 lg:p-4 rounded-2xl transition-all group ${currentView === 'SETTINGS' ? 'bg-[var(--vix-secondary)] text-[var(--vix-text)]' : 'text-zinc-500 hover:bg-[var(--vix-secondary)]/40 hover:text-[var(--vix-text)]'}`}
          >
            <div className={`w-6 h-6 flex items-center justify-center transition-all ${currentView === 'SETTINGS' ? 'text-pink-500 scale-110' : 'group-hover:text-pink-400'}`}>
              <SettingsIcon className="w-5 h-5" />
            </div>
            <span className={`ml-4 hidden lg:block font-bold text-sm tracking-tight ${currentView === 'SETTINGS' ? 'text-[var(--vix-text)]' : 'text-zinc-500'}`}>{t('Settings')}</span>
          </button>

          {currentUser && (
            <div className="flex items-center gap-3 p-3 lg:p-4 rounded-2xl cursor-pointer hover:bg-[var(--vix-secondary)]/40 transition-all group" onClick={() => setView('PROFILE')}>
               <div className="relative shrink-0">
                 <img src={currentUser.avatar_url || `https://ui-avatars.com/api/?name=${currentUser.username}`} className="w-8 h-8 lg:w-9 lg:h-9 rounded-full object-cover border border-[var(--vix-border)] group-hover:border-pink-500 transition-all" />
                 <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[var(--vix-bg)]" />
               </div>
               <div className="hidden lg:flex flex-col min-w-0">
                 <span className="font-bold text-xs truncate flex items-center gap-1 text-[var(--vix-text)]">
                   @{currentUser.username}
                   {currentUser.is_verified && <VerificationBadge size="w-3.5 h-3.5" />}
                 </span>
                 <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">{currentUser.is_admin ? t('Admin') : t('Member')}</span>
               </div>
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 h-16 bg-[var(--vix-bg)]/80 backdrop-blur-xl border-t border-[var(--vix-border)] sm:hidden flex items-center justify-around px-4 z-50 transition-all duration-300">
        {navItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`p-2 transition-all relative flex flex-col items-center ${isActive ? 'text-pink-500' : 'text-zinc-500'}`}
            >
              <div className={`transition-transform duration-300 ${isActive ? 'scale-110' : ''}`}>
                <i className={`${item.icon} text-xl`}></i>
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="absolute top-1 right-1 bg-pink-500 text-white text-[8px] font-black px-1 min-w-[14px] h-[14px] rounded-full flex items-center justify-center border border-[var(--vix-bg)] shadow-lg">
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
