
import React from 'react';
import { Heart, UserPlus, Shield, Bell } from 'lucide-react';
import { UserProfile } from '../types';

interface NotificationsProps {
  currentUser: UserProfile;
  onOpenAdmin: () => void;
  onUnlockAdmin?: () => void;
  isAdminUnlocked?: boolean;
}

const Notifications: React.FC<NotificationsProps> = ({ currentUser, onOpenAdmin, onUnlockAdmin, isAdminUnlocked }) => {
  return (
    <div className="max-w-[600px] mx-auto py-8 px-4 relative">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold">Notifications</h2>
        
        {/* Secret Admin Trigger */}
        <div 
          onClick={(e) => {
            e.stopPropagation();
            onUnlockAdmin?.();
          }}
          className="p-4 -m-4 cursor-pointer flex items-center justify-center group"
          title="System Access"
        >
          <div 
            className={`w-2 h-2 rounded-full transition-all group-hover:scale-150 ${
              isAdminUnlocked 
                ? 'bg-purple-500 shadow-[0_0_10px_#a855f7]' 
                : 'bg-zinc-800 group-hover:bg-zinc-700'
            }`}
          />
        </div>
        
        {isAdminUnlocked && (
          <button 
            onClick={onOpenAdmin}
            className="flex items-center gap-2 vix-gradient px-4 py-2 rounded-xl text-white font-bold text-sm shadow-xl shadow-pink-500/20 hover:scale-105 transition-transform animate-in fade-in zoom-in duration-300"
          >
            <Shield className="w-4 h-4" /> OPEN ADMIN
          </button>
        )}
      </div>

      <div className="flex flex-col items-center justify-center py-20 text-stone-500 text-center">
        <div className="w-20 h-20 rounded-full border border-zinc-800 flex items-center justify-center mb-6">
          <Bell className="w-10 h-10 text-zinc-700" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">No notifications yet</h3>
        <p className="max-w-xs text-sm leading-relaxed">When people like your posts or follow you, you'll see it here.</p>
      </div>
    </div>
  );
};

export default Notifications;
