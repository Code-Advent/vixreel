
import React from 'react';
import { 
  Home, Search, Compass, PlaySquare, MessageCircle, Heart, PlusSquare, User, Menu, Shield
} from 'lucide-react';
import { ViewType, UserProfile } from '../types';
import VerificationBadge from './VerificationBadge';

interface SidebarProps {
  currentView: ViewType;
  setView: (view: ViewType) => void;
  onLogout: () => void;
  currentUser?: UserProfile | null;
  isAdminUnlocked?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, onLogout, currentUser, isAdminUnlocked }) => {
  const navItems = [
    { id: 'FEED' as ViewType, label: 'Home', icon: Home },
    { id: 'SEARCH' as ViewType, label: 'Search', icon: Search },
    { id: 'EXPLORE' as ViewType, label: 'Explore', icon: Compass },
    { id: 'REELS' as ViewType, label: 'Reels', icon: PlaySquare },
    { id: 'MESSAGES' as ViewType, label: 'Messages', icon: MessageCircle },
    { id: 'NOTIFICATIONS' as ViewType, label: 'Notifications', icon: Heart },
    { id: 'CREATE' as ViewType, label: 'Create', icon: PlusSquare },
    { id: 'PROFILE' as ViewType, label: 'Profile', icon: User },
  ];

  return (
    <div className="fixed left-0 top-0 h-screen w-16 lg:w-64 border-r border-stone-800 bg-black flex flex-col p-4 z-50 transition-all">
      <div className="mb-10 px-2 lg:px-4">
        <h1 
          className="text-2xl lg:text-3xl font-bold logo-font hidden lg:block cursor-pointer vix-text-gradient"
          onClick={() => setView('FEED')}
        >
          VixReel
        </h1>
        <div className="lg:hidden w-8 h-8 rounded-full vix-gradient flex items-center justify-center">
          <span className="text-white font-bold text-xs">V</span>
        </div>
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto no-scrollbar pb-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`w-full flex items-center p-3 rounded-lg transition-all duration-200 hover:bg-zinc-900 group ${
                isActive ? 'font-bold text-white' : 'text-stone-300'
              }`}
            >
              <div className="relative">
                <Icon 
                  className={`w-6 h-6 transition-transform group-hover:scale-110 ${isActive ? 'vix-text-gradient' : ''}`} 
                  strokeWidth={isActive ? 3 : 2}
                />
              </div>
              <span className={`ml-4 hidden lg:block text-lg ${isActive ? 'vix-text-gradient' : ''}`}>
                {item.label}
              </span>
            </button>
          );
        })}

        {isAdminUnlocked && (
          <button
            onClick={() => setView('ADMIN')}
            className={`w-full flex items-center p-3 rounded-lg transition-all duration-200 hover:bg-zinc-900 group border border-purple-900/30 mt-4 bg-purple-900/5 ${
              currentView === 'ADMIN' ? 'font-bold border-purple-500' : ''
            }`}
          >
            <Shield className="w-6 h-6 text-purple-400" />
            <span className="ml-4 hidden lg:block text-lg text-purple-400 font-bold">Admin Console</span>
          </button>
        )}
      </nav>

      {currentUser && (
        <div className="mb-4 hidden lg:block px-3 py-2">
          <div className="flex items-center gap-3">
             <img src={currentUser.avatar_url || `https://ui-avatars.com/api/?name=${currentUser.username}`} className="w-8 h-8 rounded-full object-cover" />
             <div className="flex flex-col truncate">
                <span className="text-xs font-bold text-white flex items-center truncate">
                  {currentUser.username} {currentUser.is_verified && <VerificationBadge size="w-3 h-3" />}
                </span>
                <span className="text-[10px] text-zinc-500 truncate">Creator Access</span>
             </div>
          </div>
        </div>
      )}

      <div className="mt-auto space-y-2 border-t border-zinc-800 pt-4">
        <button 
          onClick={onLogout}
          className="w-full flex items-center p-3 rounded-lg hover:bg-zinc-900 group"
        >
          <Menu className="w-6 h-6 text-stone-300 group-hover:scale-110 transition-transform" />
          <span className="ml-4 hidden lg:block text-stone-300 text-lg">Logout</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
