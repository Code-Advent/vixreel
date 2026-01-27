
import React from 'react';
import { 
  Home, Search, Compass, PlaySquare, MessageCircle, Heart, PlusSquare, User, Menu 
} from 'lucide-react';
import { ViewType } from '../types';

interface SidebarProps {
  currentView: ViewType;
  setView: (view: ViewType) => void;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, onLogout }) => {
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

      <nav className="flex-1 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`w-full flex items-center p-3 rounded-lg transition-all duration-200 hover:bg-zinc-900 group ${
                isActive ? 'font-bold' : 'font-normal'
              }`}
            >
              <div className="relative">
                <Icon 
                  className={`w-6 h-6 transition-transform group-hover:scale-110 ${isActive ? 'vix-text-gradient' : 'text-stone-300'}`} 
                  strokeWidth={isActive ? 3 : 2}
                  style={isActive ? { stroke: 'url(#vix-gradient-svg)' } : {}}
                />
                {/* SVG for gradient stroke if needed, though Tailwind text-gradient usually works for icons with certain setups */}
                <svg width="0" height="0" className="absolute">
                  <linearGradient id="vix-gradient-svg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{ stopColor: '#ff0080' }} />
                    <stop offset="50%" style={{ stopColor: '#7928ca' }} />
                    <stop offset="100%" style={{ stopColor: '#0070f3' }} />
                  </linearGradient>
                </svg>
              </div>
              <span className={`ml-4 hidden lg:block text-lg ${isActive ? 'vix-text-gradient' : 'text-stone-300'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto space-y-2">
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
