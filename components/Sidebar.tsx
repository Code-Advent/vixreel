
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
    { id: 'CREATE' as ViewType, label: 'Create', icon: PlusSquare },
    { id: 'MESSAGES' as ViewType, label: 'Messages', icon: MessageCircle },
    { id: 'PROFILE' as ViewType, label: 'Profile', icon: User },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="fixed left-0 top-0 h-screen w-16 lg:w-64 border-r border-zinc-900 bg-black hidden sm:flex flex-col p-4 z-50">
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
              <span className="ml-4 hidden lg:block text-lg text-purple-400 font-bold">Admin Panel</span>
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
                  <span className="text-[10px] text-zinc-500 truncate">VixReel Pro</span>
               </div>
            </div>
          </div>
        )}

        <div className="mt-auto pt-4 border-t border-zinc-900">
          <button 
            onClick={onLogout}
            className="w-full flex items-center p-3 rounded-lg hover:bg-zinc-900 group"
          >
            <Menu className="w-6 h-6 text-stone-300 group-hover:scale-110 transition-transform" />
            <span className="ml-4 hidden lg:block text-stone-300 text-lg">More</span>
          </button>
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 h-16 bg-black/80 backdrop-blur-xl border-t border-zinc-900 sm:hidden flex items-center justify-around px-2 z-50">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className="p-3 relative"
            >
              <Icon 
                className={`w-6 h-6 transition-all ${isActive ? 'vix-text-gradient scale-110' : 'text-zinc-500'}`} 
                strokeWidth={isActive ? 3 : 2}
              />
              {isActive && <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-pink-500 rounded-full shadow-[0_0_8px_#ff0080]"></div>}
            </button>
          );
        })}
      </div>
    </>
  );
};

export default Sidebar;
