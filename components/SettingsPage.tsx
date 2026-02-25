
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
  X,
  Sun,
  MapPin,
  Users2,
  Loader2,
  Globe
} from 'lucide-react';
import { UserProfile, ViewType } from '../types';
import { supabase } from '../lib/supabase';
import { useTranslation, SUPPORTED_LANGUAGES } from '../lib/translation';

interface SettingsPageProps {
  user: UserProfile;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  onUpdateProfile: (updates: Partial<UserProfile>) => void;
  onLogout: () => void;
  onOpenSwitchAccount: () => void;
  setView: (view: ViewType) => void;
  onTriggerEditProfile: () => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ 
  user, 
  theme,
  setTheme,
  onUpdateProfile, 
  onLogout, 
  onOpenSwitchAccount, 
  setView,
  onTriggerEditProfile
}) => {
  const { t, language, setLanguage, isTranslating, translationProgress } = useTranslation();
  const [isPrivate, setIsPrivate] = useState(user.is_private || false);
  const [allowComments, setAllowComments] = useState(user.allow_comments !== false);
  const [isFollowingPublic, setIsFollowingPublic] = useState(user.is_following_public !== false);
  const [location, setLocation] = useState(user.location || '');
  const [isLocationPrivate, setIsLocationPrivate] = useState(user.is_location_private || false);
  const [showFollowersTo, setShowFollowersTo] = useState(user.show_followers_to || 'EVERYONE');
  const [saving, setSaving] = useState<string | null>(null);
  const [infoModal, setInfoModal] = useState<{title: string, content: string} | null>(null);

  const toggleSetting = async (key: keyof UserProfile, value: any) => {
    setSaving(key);
    try {
      const { error } = await supabase.from('profiles').update({ [key]: value }).eq('id', user.id);
      if (!error) {
        onUpdateProfile({ [key]: value });
        if (key === 'is_private') setIsPrivate(value);
        if (key === 'allow_comments') setAllowComments(value);
        if (key === 'is_following_public') setIsFollowingPublic(value);
        if (key === 'is_location_private') setIsLocationPrivate(value);
        if (key === 'show_followers_to') setShowFollowersTo(value);
      }
    } finally {
      setTimeout(() => setSaving(null), 500);
    }
  };

  const updateLocation = async () => {
    setSaving('location');
    try {
      const { error } = await supabase.from('profiles').update({ location }).eq('id', user.id);
      if (!error) onUpdateProfile({ location });
    } finally {
      setTimeout(() => setSaving(null), 500);
    }
  };

  const sections = [
    {
      title: t('Account Settings'),
      items: [
        { 
          icon: User, 
          label: t('Edit Profile'), 
          action: onTriggerEditProfile, 
          desc: t('Update handle, bio, and identity.') 
        },
        { 
          icon: Smartphone, 
          label: t('Linked Accounts'), 
          action: onOpenSwitchAccount, 
          desc: t('Manage other VixReel identities.') 
        },
        { 
          icon: Bell, 
          label: t('Notifications'), 
          action: () => setView('NOTIFICATIONS'), 
          desc: t('Control push alerts and signal pings.') 
        },
        { 
          icon: Globe, 
          label: t('Language'), 
          isSelect: true,
          value: language,
          options: SUPPORTED_LANGUAGES.map(l => ({ label: l.name, value: l.code })),
          onSelect: (val: string) => setLanguage(val),
          desc: isTranslating 
            ? `${t('Downloading language pack...')}` 
            : t('Select your preferred narrative language.')
        },
        { 
          icon: theme === 'dark' ? Moon : Sun, 
          label: t('Appearance'), 
          isToggle: true, 
          active: theme === 'dark', 
          onToggle: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
          desc: `${t('Currently using')} ${t(theme)} ${t('mode protocol.')}`
        },
      ]
    },
    {
      title: t('Privacy & Narrative'),
      items: [
        { 
          icon: Lock, 
          label: t('Private Account'), 
          isToggle: true, 
          active: isPrivate, 
          onToggle: () => toggleSetting('is_private', !isPrivate),
          desc: t('Only followers can view your narrative posts and lists.')
        },
        { 
          icon: Users2, 
          label: t('Follower Visibility'), 
          isSelect: true,
          value: showFollowersTo,
          options: [
            { label: t('Everyone'), value: 'EVERYONE' },
            { label: t('Followers'), value: 'FOLLOWERS' },
            { label: t('Only Me'), value: 'ONLY_ME' }
          ],
          onSelect: (val: any) => toggleSetting('show_followers_to', val),
          desc: t('Control who can see your follower registry.')
        },
        { 
          icon: MapPin, 
          label: t('Private Location'), 
          isToggle: true, 
          active: isLocationPrivate, 
          onToggle: () => toggleSetting('is_location_private', !isLocationPrivate),
          desc: t('Hide your physical signal from your profile.')
        },
        { 
          icon: MessageSquare, 
          label: t('Allow Comments'), 
          isToggle: true, 
          active: allowComments, 
          onToggle: () => toggleSetting('allow_comments', !allowComments),
          desc: t('Enable others to respond to your signal.')
        },
        { 
          icon: Eye, 
          label: t('Public Following'), 
          isToggle: true, 
          active: isFollowingPublic, 
          onToggle: () => toggleSetting('is_following_public', !isFollowingPublic),
          desc: t('Make your following list visible to visitors.')
        },
      ]
    },
    {
      title: t('Identity Signal'),
      items: [
        {
          icon: MapPin,
          label: t('Current Location'),
          isInput: true,
          value: location,
          onChange: (val: string) => setLocation(val),
          onBlur: updateLocation,
          desc: t('Broadcast your current sector.')
        }
      ]
    },
    {
      title: t('Support'),
      items: [
        { 
          icon: HelpCircle, 
          label: t('Help Center'), 
          action: () => setInfoModal({
            title: t('VixReel Help Center'),
            content: t('Welcome to the Help Center. Our narrative protocol is designed for creators. For issues with verification, billing, or identity synchronization, please contact core@vixreel.io. Remember: Always maintain your visual signal integrity.')
          }), 
          desc: t('FAQ and community guidelines.') 
        },
        { 
          icon: Info, 
          label: t('About VixReel'), 
          action: () => setInfoModal({
            title: t('About VixReel'),
            content: t('VixReel Version 3.2.0-Alpha. A premium social narrative protocol built for high-performance content sharing. Credits: Engineering by World-Class AI. Aesthetic Direction by Vix Design Labs.')
          }), 
          desc: t('Terms, conditions, and privacy policy.') 
        },
      ]
    }
  ];

  return (
    <div className="max-w-[700px] mx-auto py-12 px-6 animate-vix-in pb-32">
      <div className="mb-12">
        <h1 className="text-4xl font-black uppercase tracking-[0.1em] text-[var(--vix-text)]">{t('Settings')}</h1>
        <p className="text-[10px] text-zinc-600 font-black uppercase tracking-[0.4em] mt-2 italic">{t('VixReel Narrative Protocol Configuration')}</p>
      </div>

      <div className="space-y-12">
        {sections.map((section, idx) => (
          <div key={idx} className="space-y-6">
            <h3 className="text-[11px] font-black text-zinc-700 uppercase tracking-[0.5em] px-2">{section.title}</h3>
            <div className="bg-[var(--vix-card)] border border-[var(--vix-border)] rounded-[2.5rem] overflow-hidden shadow-2xl">
              {section.items.map((item, iIdx) => (
                <div 
                  key={iIdx} 
                  className={`p-6 flex items-center justify-between border-b border-[var(--vix-border)] last:border-0 hover:bg-[var(--vix-secondary)] transition-all cursor-pointer group`}
                  onClick={!item.isToggle ? item.action : undefined}
                >
                  <div className="flex items-center gap-5">
                    <div className="p-3 bg-[var(--vix-secondary)] rounded-2xl text-zinc-500 group-hover:text-blue-500 transition-colors">
                      <item.icon className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-sm text-[var(--vix-text)] group-hover:text-blue-400 transition-colors">{item.label}</span>
                      <span className="text-[10px] text-zinc-600 font-medium">{item.desc}</span>
                    </div>
                  </div>
                  
                  {item.isToggle ? (
                    <button 
                      onClick={(e) => { e.stopPropagation(); item.onToggle?.(); }}
                      className={`w-14 h-8 rounded-full p-1 transition-all flex items-center relative ${item.active ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-800'}`}
                    >
                      <div className={`w-6 h-6 bg-white rounded-full shadow-lg transition-transform ${item.active ? 'translate-x-6' : 'translate-x-0'} flex items-center justify-center`}>
                        {saving === (item.label.toLowerCase().replace(' ', '_')) ? (
                          <div className="w-2 h-2 rounded-full bg-blue-600 animate-ping"></div>
                        ) : null}
                      </div>
                    </button>
                  ) : item.isSelect ? (
                    <div className="flex flex-col items-end gap-2">
                      <select 
                        value={item.value} 
                        onChange={(e) => item.onSelect?.(e.target.value)}
                        className="bg-[var(--vix-secondary)] border border-[var(--vix-border)] rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest outline-none text-[var(--vix-text)]"
                      >
                        {item.options?.map((opt: any) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      {item.label === t('Language') && isTranslating && (
                        <div className="w-32 h-1 bg-zinc-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 transition-all duration-500" 
                            style={{ width: `${translationProgress}%` }}
                          />
                        </div>
                      )}
                    </div>
                  ) : item.isInput ? (
                    <div className="relative">
                      <input 
                        type="text" 
                        value={item.value} 
                        onChange={(e) => item.onChange?.(e.target.value)}
                        onBlur={item.onBlur}
                        className="bg-[var(--vix-secondary)] border border-[var(--vix-border)] rounded-xl px-4 py-2 text-xs font-bold outline-none text-[var(--vix-text)] w-40"
                        placeholder="Location..."
                      />
                      {saving === 'location' && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 animate-spin text-blue-500" />}
                    </div>
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
            className="w-full py-6 bg-[var(--vix-card)] border border-red-500/20 rounded-[2.5rem] flex items-center justify-center gap-3 text-red-500 font-black text-[11px] uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all shadow-xl active:scale-95"
           >
             <LogOut className="w-4 h-4" /> {t('Relinquish Current Session')}
           </button>
        </div>
      </div>

      {/* Info Modal */}
      {infoModal && (
        <div className="fixed inset-0 z-[10001] bg-[var(--vix-bg)]/90 backdrop-blur-md flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-[var(--vix-card)] border border-[var(--vix-border)] rounded-[3rem] p-10 space-y-6 shadow-2xl animate-vix-in">
             <div className="flex justify-between items-center">
                <h3 className="text-xl font-black uppercase text-[var(--vix-text)] tracking-widest">{infoModal.title}</h3>
                <button onClick={() => setInfoModal(null)} className="p-2 text-zinc-500 hover:text-white"><X className="w-6 h-6" /></button>
             </div>
             <p className="text-zinc-400 text-sm leading-loose whitespace-pre-wrap">{infoModal.content}</p>
             <button onClick={() => setInfoModal(null)} className="w-full py-4 bg-[var(--vix-secondary)] rounded-2xl text-[10px] font-black uppercase text-[var(--vix-text)] hover:bg-zinc-800 transition-all">{t('Understood')}</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
