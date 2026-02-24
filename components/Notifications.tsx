
import React from 'react';
import { Bell } from 'lucide-react';
import { UserProfile } from '../types';
import { useTranslation } from '../lib/translation';

interface NotificationsProps {
  currentUser: UserProfile;
  onOpenAdmin: () => void;
  onUnlockAdmin?: () => void;
  isAdminUnlocked?: boolean;
}

const Notifications: React.FC<NotificationsProps> = ({ currentUser }) => {
  const { t } = useTranslation();
  return (
    <div className="max-w-[600px] mx-auto py-8 px-4 relative animate-vix-in">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold uppercase tracking-widest text-[var(--vix-text)]">{t('Notifications')}</h2>
      </div>

      <div className="flex flex-col items-center justify-center py-20 text-zinc-500 text-center">
        <div className="w-24 h-24 rounded-[2rem] bg-[var(--vix-secondary)] border border-[var(--vix-border)] flex items-center justify-center mb-8 shadow-2xl">
          <Bell className="w-10 h-10 text-zinc-700" />
        </div>
        <h3 className="text-xl font-black text-[var(--vix-text)] mb-3 uppercase tracking-tight">{t('No signals detected')}</h3>
        <p className="max-w-xs text-[11px] font-medium leading-loose uppercase tracking-widest opacity-40">
          {t('When creators interact with your narrative, alerts will manifest here.')}
        </p>
      </div>
    </div>
  );
};

export default Notifications;
