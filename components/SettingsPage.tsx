
import React, { useState } from 'react';
import { 
  Shield, 
  Lock, 
  User, 
  Bell, 
  HelpCircle, 
  LogOut, 
  ChevronRight, 
  Moon, 
  Eye, 
  MessageSquare,
  Smartphone,
  Info,
  Check,
  X
} from 'lucide-react';
import { UserProfile, ViewType } from '../types';
import { supabase } from '../lib/supabase';

interface SettingsPageProps {
  user: UserProfile;
  onUpdateProfile: (updates: Partial<UserProfile>) => void;
  onLogout: () => void;
  onOpenSwitchAccount: () => void;
  setView: (view: ViewType) => void;
  onTriggerEditProfile: () => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ 
  user, 
  onUpdateProfile, 
  onLogout, 
  onOpenSwitchAccount, 
  setView,
  onTriggerEditProfile
}) => {
  const [isPrivate, setIsPrivate] = useState(user.is_private || false);
  const [allowComments, setAllowComments] = useState(user.allow_comments !== false);
  const [isFollowingPublic, setIsFollowingPublic] = useState(user.is_following_public !== false);
  const [saving, setSaving] = useState<string | null>(null);
  const [infoModal, setInfoModal] = useState<{title: string, content: string} | null>(null);

  const toggleSetting = async (key: keyof UserProfile, value: boolean) => {
    setSaving(key);
    try {
      const { error } = await supabase.from('profiles').update({ [key]: value }).eq('id', user.id);
      if (!error) {
        onUpdateProfile({ [key]: value });
        if (key === 'is_private') setIsPrivate(value);
        if (key === 'allow_comments') setAllowComments(value);
        if (key === 'is_following_public') setIsFollowingPublic(value);
      }
    } finally {
      setTimeout(() => setSaving(null), 500);
    }
  };

  const sections = [
    {
      title: 'Account Settings',
      items: [
        { 
          icon: User, 
          label: 'Edit Profile', 
          action: onTriggerEditProfile, 
          desc: 'Update handle, bio, and identity.' 
        },
        { 
          icon: Smartphone, 
          label: 'Linked Accounts', 
          action: onOpenSwitchAccount, 
          desc: 'Manage other VixReel identities.' 
        },
        { 
          icon: Bell, 
          label: 'Notifications', 
          action: () => setView('NOTIFICATIONS'), 
          desc: 'Control push alerts and signal pings.' 
        },
      ]
    },
    {
      title: 'Privacy & Narrative',
      items: [
        { 
          icon: Lock, 
          label: 'Private Account', 
          isToggle: true, 
          active: isPrivate, 
          onToggle: () => toggleSetting('is_private', !isPrivate),
          desc: 'Only followers can view your narrative posts.'
        },
        { 
          icon: MessageSquare, 
          label: 'Allow Comments', 
          isToggle: true, 
          active: allowComments, 
          onToggle: () => toggleSetting('allow_comments', !allowComments),
          desc: 'Enable others to respond to your signal.'
        },
        { 
          icon: Eye, 
          label: 'Public Following', 
          isToggle: true, 
          active: isFollowingPublic, 
          onToggle: () => toggleSetting('is_following_public', !isFollowingPublic),
          desc: 'Make your following list visible to visitors.'
        },
      ]
    },
    {
      title: 'Support',
      items: [
        { 
          icon: HelpCircle, 
          label: 'Help Center', 
          action: () => setInfoModal({
            title: 'VixReel Help Center',
            content: 'Welcome to the Help Center. Our narrative protocol is designed for creators. For issues with verification, billing, or identity synchronization, please contact core@vixreel.io. Remember: Always maintain your visual signal integrity.'
          }), 
          desc: 'FAQ and community guidelines.' 
        },
        { 
          icon: Info, 
          label: 'About VixReel', 
          action: () => setInfoModal({
            title: 'About VixReel',
            content: 'VixReel Version 3.2.0-Alpha. A premium social narrative protocol built for high-performance content sharing. Credits: Engineering by World-Class AI. Aesthetic Direction by Vix Design Labs.'
          }), 
          desc: 'Terms, conditions, and privacy policy.' 
        },
      ]
    }
  ];

  return (
    <div className="max-w-[700px] mx-auto py-12 px-6 animate-vix-in pb-32">
      <div className="mb-12">
        <h1 className="text-4xl font-black uppercase tracking-[0.1em] text-white">Settings</h1>
        <p className="text-[10px] text-zinc-600 font-black uppercase tracking-[0.4em] mt-2 italic">VixReel Narrative Protocol Configuration</p>
      </div>

      <div className="space-y-12">
        {sections.map((section, idx) => (
          <div key={idx} className="space-y-6">
            <h3 className="text-[11px] font-black text-zinc-700 uppercase tracking-[0.5em] px-2">{section.title}</h3>
            <div className="bg-zinc-950/50 border border-zinc-900 rounded-[2.5rem] overflow-hidden shadow-2xl">
              {section.items.map((item, iIdx) => (
                <div 
                  key={iIdx} 
                  className={`p-6 flex items-center justify-between border-b border-zinc-900/50 last:border-0 hover:bg-zinc-900/30 transition-all cursor-pointer group`}
                  onClick={!item.isToggle ? item.action : undefined}
                >
                  <div className="flex items-center gap-5">
                    <div className="p-3 bg-zinc-900 rounded-2xl text-zinc-500 group-hover:text-blue-500 transition-colors">
                      <item.icon className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-sm text-white group-hover:text-blue-400 transition-colors">{item.label}</span>
                      <span className="text-[10px] text-zinc-600 font-medium">{item.desc}</span>
                    </div>
                  </div>
                  
                  {item.isToggle ? (
                    <button 
                      onClick={(e) => { e.stopPropagation(); item.onToggle?.(); }}
                      className={`w-14 h-8 rounded-full p-1 transition-all flex items-center relative ${item.active ? 'bg-blue-600' : 'bg-zinc-800'}`}
                    >
                      <div className={`w-6 h-6 bg-white rounded-full shadow-lg transition-transform ${item.active ? 'translate-x-6' : 'translate-x-0'} flex items-center justify-center`}>
                        {saving === (item.label.toLowerCase().replace(' ', '_')) ? (
                          <div className="w-2 h-2 rounded-full bg-blue-600 animate-ping"></div>
                        ) : null}
                      </div>
                    </button>
                  ) : (
                    <ChevronRight className="w-5 h-5 text-zinc-800 group-hover:text-blue-500 transition-colors" />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="pt-8">
           <button 
            onClick={onLogout}
            className="w-full py-6 bg-zinc-950 border border-red-500/20 rounded-[2.5rem] flex items-center justify-center gap-3 text-red-500 font-black text-[11px] uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all shadow-xl active:scale-95"
           >
             <LogOut className="w-4 h-4" /> Relinquish Current Session
           </button>
        </div>
      </div>

      {/* Info Modal */}
      {infoModal && (
        <div className="fixed inset-0 z-[10001] bg-black/90 backdrop-blur-md flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-900 rounded-[3rem] p-10 space-y-6 shadow-2xl animate-vix-in">
             <div className="flex justify-between items-center">
                <h3 className="text-xl font-black uppercase text-white tracking-widest">{infoModal.title}</h3>
                <button onClick={() => setInfoModal(null)} className="p-2 text-zinc-500 hover:text-white"><X className="w-6 h-6" /></button>
             </div>
             <p className="text-zinc-400 text-sm leading-loose whitespace-pre-wrap">{infoModal.content}</p>
             <button onClick={() => setInfoModal(null)} className="w-full py-4 bg-zinc-900 rounded-2xl text-[10px] font-black uppercase text-white hover:bg-zinc-800 transition-all">Understood</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
