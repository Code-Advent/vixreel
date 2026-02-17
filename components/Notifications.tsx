
import React from 'react';
import { Bell } from 'lucide-react';
import { UserProfile } from '../types';

interface NotificationsProps {
  currentUser: UserProfile;
  onOpenAdmin: () => void;
  onUnlockAdmin?: () => void;
  isAdminUnlocked?: boolean;
}

const Notifications: React.FC<NotificationsProps> = ({ currentUser }) => {
  return (
    <div className="max-w-[600px] mx-auto py-8 px-4 relative animate-vix-in">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold uppercase tracking-widest text-white">Notifications</h2>
      </div>

      <div className="flex flex-col items-center justify-center py-20 text-zinc-500 text-center">
        <div className="w-24 h-24 rounded-[2rem] bg-zinc-900/50 border border-zinc-900 flex items-center justify-center mb-8 shadow-2xl">
          <Bell className="w-10 h-10 text-zinc-700" />
        </div>
        <h3 className="text-xl font-black text-white mb-3 uppercase tracking-tight">No signals detected</h3>
        <p className="max-w-xs text-[11px] font-medium leading-loose uppercase tracking-widest opacity-40">
          When creators interact with your narrative, alerts will manifest here.
        </p>
      </div>
    </div>
  );
};

export default Notifications;
