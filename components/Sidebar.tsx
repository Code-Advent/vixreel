
import React from 'react';
import { ViewType, UserProfile } from '../types';
import VerificationBadge from './VerificationBadge';
import { ShieldAlert, LogOut, Settings as SettingsIcon } from 'lucide-react';

interface SidebarProps {
  currentView: ViewType;
  setView: (view: ViewType) => void;
  onLogout: () => void;
  currentUser?: UserProfile | null;
  isAdminUnlocked?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, onLogout, currentUser, isAdminUnlocked }) => {
  const isActuallyAdmin = isAdminUnlocked || currentUser?.email === 'davidhen498@gmail.com';
  
  const navItems = [
    { id: 'FEED' as ViewType, label: 'Home', icon: 'fa-solid fa-house' },
    { id: 'SEARCH' as ViewType, label: 'Search', icon: 'fa-solid fa-magnifying-glass' },
    { id: 'EXPLORE' as ViewType, label: 'Explore', icon: 'fa-solid fa-compass' },
    { id: 'CREATE' as ViewType, label: 'Create', icon: 'fa-solid fa-square-plus' },
    { id: 'MESSAGES' as ViewType, label: 'Messages', icon: 'fa-solid fa-paper-plane' },
    { id: 'PROFILE' as ViewType, label: 'Profile', icon: 'fa-solid fa-user' },
  ];

  return (
    <>
      <div className="fixed left-0 top-0 h-screen w-16 lg:w-64 border-r border-zinc-900 bg-black hidden sm:flex flex-col p-6 z-50">
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
                  isActive ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-900/50 hover:text-white'
                }`}
              >
                <div className={`w-6 h-6 flex items-center justify-center transition-transform ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                  <i className={`${item.icon} text-lg`}></i>
                </div>
                <span className={`ml-4 hidden lg:block font-bold text-sm ${isActive ? 'text-white' : 'text-zinc-400'}`}>
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
              <span className="ml-4 hidden lg:block font-bold uppercase text-[10px] tracking-widest">Admin Panel</span>
            </button>
          )}
        </nav>

        <div className="mt-auto pt-6 border-t border-zinc-900 space-y-4">
          {currentUser && (
            <div className="hidden lg:flex items-center gap-3 p-3 rounded-2xl bg-zinc-950/50 border border-zinc-900 cursor-pointer hover:bg-zinc-900 transition-colors" onClick={() => setView('PROFILE')}>
               <img src={currentUser.avatar_url || `https://ui-avatars.com/api/?name=${currentUser.username}`} className="w-8 h-8 rounded-full object-cover" />
               <div className="flex flex-col min-w-0">
                 <span className="font-bold text-xs truncate flex items-center gap-1 text-white">
                   @{currentUser.username}
                   {currentUser.is_verified && <VerificationBadge size="w-3.5 h-3.5" />}
                 </span>
                 <span className="text-[8px] text-zinc-600 font-bold uppercase">{currentUser.is_admin ? 'Admin' : 'Member'}</span>
               </div>
            </div>
          )}
          <button 
            onClick={() => setView('SETTINGS')}
            className={`w-full flex items-center p-3 rounded-2xl transition-all group ${currentView === 'SETTINGS' ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-900 hover:text-white'}`}
          >
            <div className="w-6 h-6 flex items-center justify-center">
              <SettingsIcon className="w-5 h-5" />
            </div>
            <span className="ml-4 hidden lg:block font-bold text-sm">Settings</span>
          </button>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 h-16 bg-black border-t border-zinc-900 sm:hidden flex items-center justify-around z-50">
        {navItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`p-3 transition-all ${isActive ? 'text-blue-500 scale-125' : 'text-zinc-600'}`}
            >
              <i className={`${item.icon} text-xl`}></i>
            </button>
          );
        })}
      </div>
    </>
  );
};

export default Sidebar;
