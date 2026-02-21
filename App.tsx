
import React, { useState, useEffect } from 'react';
import { Loader2, Users, LogOut, Trash2, X, UserPlus, CheckCircle, Plus } from 'lucide-react';
import { supabase } from './lib/supabase';
import { UserProfile, Post as PostType, ViewType, AccountSession } from './types';
import Sidebar from './components/Sidebar';
import Post from './components/Post';
import Profile from './components/Profile';
import CreatePost from './components/CreatePost';
import Search from './components/Search';
import Auth from './components/Auth';
import Messages from './components/Messages';
import Admin from './components/Admin';
import Notifications from './components/Notifications';
import Explore from './components/Explore';
import SettingsPage from './components/SettingsPage';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [viewedUser, setViewedUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<ViewType>('FEED');
  const [posts, setPosts] = useState<PostType[]>([]);
  const [initialChatUser, setInitialChatUser] = useState<UserProfile | null>(null);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [profileAutoEdit, setProfileAutoEdit] = useState(false);
  const [duetSource, setDuetSource] = useState<PostType | null>(null);
  const [stitchSource, setStitchSource] = useState<PostType | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('vixreel_theme');
    return (saved as 'light' | 'dark') || 'dark';
  });
  
  const [savedAccounts, setSavedAccounts] = useState<AccountSession[]>(() => {
    const saved = localStorage.getItem('vixreel_saved_accounts');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    init();

    const handleGlobalPostDelete = (e: any) => {
      const deletedId = e.detail?.id;
      if (deletedId) setPosts(prev => prev.filter(p => p.id !== deletedId));
    };

    const handlePostUpdate = (e: any) => {
      const { id, boosted_likes } = e.detail;
      setPosts(prev => prev.map(p => p.id === id ? { ...p, boosted_likes } : p));
    };

    const handleIdentityUpdate = (e: any) => {
      const { id, ...updates } = e.detail;
      if (currentUser?.id === id) {
        setCurrentUser(prev => {
          const updated = prev ? { ...prev, ...updates } : null;
          if (updated) updateIdentityRegistry(updated);
          return updated;
        });
      }
      if (viewedUser?.id === id) setViewedUser(prev => prev ? { ...prev, ...updates } : null);
      setPosts(prev => prev.map(p => p.user_id === id ? { ...p, user: { ...p.user, ...updates } } : p));
    };

    window.addEventListener('vixreel-post-deleted', handleGlobalPostDelete);
    window.addEventListener('vixreel-post-updated', handlePostUpdate);
    window.addEventListener('vixreel-user-updated', handleIdentityUpdate);
    
    return () => {
      window.removeEventListener('vixreel-post-deleted', handleGlobalPostDelete);
      window.removeEventListener('vixreel-post-updated', handlePostUpdate);
      window.removeEventListener('vixreel-user-updated', handleIdentityUpdate);
    };
  }, [currentUser?.id, viewedUser?.id]);

  useEffect(() => {
    // Apply theme to document element
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('vixreel_theme', theme);
  }, [theme]);

  const init = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const profile = await resolveIdentity(session.user);
        if (profile) {
          if (session.user.email === 'davidhen498@gmail.com') profile.is_admin = true;
          setCurrentUser(profile);
          syncSavedAccount(profile, session);
          await fetchPosts();
        } else {
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
    } catch (err) {
      console.error("VixReel Engine Error:", err);
      setCurrentUser(null);
    } finally {
      setTimeout(() => setLoading(false), 2000);
    }
  };

  const syncSavedAccount = (profile: UserProfile, session: any) => {
    setSavedAccounts(prev => {
      const filtered = prev.filter(acc => acc.id !== profile.id);
      const updated = [{ 
        id: profile.id, 
        username: profile.username, 
        avatar_url: profile.avatar_url, 
        session_data: session 
      }, ...filtered];
      localStorage.setItem('vixreel_saved_accounts', JSON.stringify(updated));
      return updated;
    });
  };

  const updateIdentityRegistry = (profile: UserProfile) => {
    const saved = localStorage.getItem('vixreel_saved_accounts');
    if (!saved) return;
    const list: AccountSession[] = JSON.parse(saved);
    const updated = list.map(acc => acc.id === profile.id ? {
      ...acc,
      username: profile.username,
      avatar_url: profile.avatar_url
    } : acc);
    localStorage.setItem('vixreel_saved_accounts', JSON.stringify(updated));
    setSavedAccounts(updated);
  };

  const switchAccount = async (account: AccountSession) => {
    setLoading(true);
    setIsAccountMenuOpen(false);
    try {
      const { error } = await supabase.auth.setSession({
        access_token: account.session_data.access_token,
        refresh_token: account.session_data.refresh_token
      });
      if (error) throw error;
      await init();
    } catch (err) {
      removeAccount(account.id);
    } finally {
      setLoading(false);
    }
  };

  const removeAccount = (id: string) => {
    setSavedAccounts(prev => {
      const updated = prev.filter(acc => acc.id !== id);
      localStorage.setItem('vixreel_saved_accounts', JSON.stringify(updated));
      return updated;
    });
    if (currentUser?.id === id) handleLogout();
  };

  const handleLogout = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setCurrentUser(null);
    setIsAccountMenuOpen(false);
    setLoading(false);
  };

  const resolveIdentity = async (authUser: any): Promise<UserProfile | null> => {
    let { data: dbProfile, error } = await supabase.from('profiles').select('*').eq('id', authUser.id).maybeSingle();
    if (!dbProfile && !error) {
      const { data: fallback } = await supabase.from('profiles').upsert({
        id: authUser.id,
        username: `user_${authUser.id.slice(0, 5)}`,
        email: authUser.email
      }).select().single();
      return fallback as UserProfile;
    }
    return dbProfile as UserProfile;
  };

  const fetchPosts = async () => {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('posts')
      .select('*, user:profiles(*)')
      .gte('created_at', twentyFourHoursAgo)
      .order('created_at', { ascending: false });
    if (data) setPosts(data as any);
  };

  const setView = (view: ViewType, explicitUser?: UserProfile) => {
    setProfileAutoEdit(false);
    if (explicitUser) setViewedUser(explicitUser);
    else if (view === 'PROFILE') setViewedUser(currentUser);
    setCurrentView(view);
  };

  if (loading) return (
    <div className={`h-screen w-screen bg-[var(--vix-bg)] text-[var(--vix-text)] flex flex-col items-center justify-between py-24 transition-colors duration-500`}>
      <div />
      <div className="flex flex-col items-center animate-vix-in">
        <h1 className="logo-font text-7xl vix-text-gradient drop-shadow-[0_0_40px_rgba(255,0,128,0.2)]">
          VixReel
        </h1>
      </div>
      <div className="flex flex-col items-center gap-2 opacity-60 animate-pulse">
        <span className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.6em]">from</span>
        <span className={`text-lg font-black tracking-[0.25em] text-[var(--vix-text)]`}>VERISAZ</span>
      </div>
    </div>
  );

  if (!currentUser || isAddingAccount) {
    return (
      <Auth 
        onAuthSuccess={(profile) => { 
          setCurrentUser(profile);
          setIsAddingAccount(false); 
          fetchPosts();
          // Force refresh of accounts list
          const saved = localStorage.getItem('vixreel_saved_accounts');
          if (saved) setSavedAccounts(JSON.parse(saved));
        }} 
        onCancelAdd={() => setIsAddingAccount(false)}
        isAddingAccount={isAddingAccount}
      />
    );
  }

  return (
    <div className={`bg-[var(--vix-bg)] min-h-screen text-[var(--vix-text)] flex overflow-hidden transition-colors duration-300`}>
      <Sidebar 
        currentView={currentView} 
        setView={setView} 
        onLogout={() => setIsAccountMenuOpen(true)} 
        currentUser={currentUser} 
        isAdminUnlocked={currentUser.is_admin} 
      />

      <main className="flex-1 sm:ml-16 lg:ml-64 pb-20 sm:pb-0 overflow-y-auto h-screen no-scrollbar">
        <div className="container mx-auto max-w-[935px] pt-4 px-4">
          {currentView === 'FEED' && (
            <div className="flex flex-col items-center pb-20 animate-vix-in">
              <div className="w-full flex justify-between items-center mb-6 px-2">
                <h1 className="logo-font text-3xl vix-text-gradient">VixReel</h1>
                <button onClick={() => setIsAccountMenuOpen(true)} className="p-3 bg-[var(--vix-secondary)] rounded-full border border-[var(--vix-border)] hover:border-[var(--vix-muted)] transition-all">
                  <Users className={`w-5 h-5 text-[var(--vix-muted)]`} />
                </button>
              </div>
              <div className="w-full max-w-[470px] space-y-6">
                {posts.length > 0 ? (
                  posts.map(p => (
                    <Post 
                      key={p.id} 
                      post={p} 
                      currentUserId={currentUser.id} 
                      onDelete={(id) => setPosts(prev => prev.filter(x => x.id !== id))} 
                      onUpdate={fetchPosts} 
                      onSelectUser={(u) => setView('PROFILE', u)}
                      onDuet={(post) => { setDuetSource(post); setCurrentView('CREATE'); }}
                      onStitch={(post) => { setStitchSource(post); setCurrentView('CREATE'); }}
                    />
                  ))
                ) : (
                  <div className="py-32 text-center opacity-20 flex flex-col items-center">
                    <Trash2 className="w-16 h-16 mb-4" />
                    <p className="font-bold uppercase tracking-[0.3em] text-xs">No posts yet</p>
                  </div>
                )}
              </div>
            </div>
          )}
          {currentView === 'EXPLORE' && <Explore currentUserId={currentUser.id} onSelectUser={(u) => setView('PROFILE', u)} />}
          {currentView === 'PROFILE' && viewedUser && (
            <Profile 
              user={viewedUser} 
              isOwnProfile={viewedUser.id === currentUser.id} 
              onUpdateProfile={(u) => {
                if (viewedUser.id === currentUser.id) {
                  setCurrentUser(prev => {
                    const updated = prev ? {...prev, ...u} : null;
                    if (updated) updateIdentityRegistry(updated);
                    return updated;
                  });
                }
                setViewedUser(prev => prev ? {...prev, ...u} : null);
              }} 
              onMessageUser={(u) => { setInitialChatUser(u); setCurrentView('MESSAGES'); }} 
              onLogout={() => setIsAccountMenuOpen(true)}
              onOpenSettings={() => setCurrentView('SETTINGS')}
              autoEdit={profileAutoEdit}
            />
          )}
          
          {currentView === 'CREATE' && (
            <CreatePost 
              userId={currentUser.id} 
              onClose={() => {
                setCurrentView('FEED');
                setDuetSource(null);
                setStitchSource(null);
              }} 
              onPostSuccess={() => {
                fetchPosts();
                setDuetSource(null);
                setStitchSource(null);
              }} 
              duetSource={duetSource}
              stitchSource={stitchSource}
            />
          )}
          {currentView === 'SEARCH' && <Search onSelectUser={(u) => setView('PROFILE', u)} />}
          {currentView === 'MESSAGES' && <Messages currentUser={currentUser} initialChatUser={initialChatUser} />}
          {currentView === 'ADMIN' && currentUser.is_admin && <Admin />}
          {currentView === 'NOTIFICATIONS' && <Notifications currentUser={currentUser} onOpenAdmin={() => setCurrentView('ADMIN')} isAdminUnlocked={currentUser.is_admin} />}
          {currentView === 'SETTINGS' && (
            <SettingsPage 
              user={currentUser} 
              theme={theme}
              setTheme={setTheme}
              onUpdateProfile={(u) => {
                setCurrentUser(prev => {
                  const updated = prev ? {...prev, ...u} : null;
                  if (updated) updateIdentityRegistry(updated);
                  return updated;
                });
              }} 
              onLogout={() => setIsAccountMenuOpen(true)} 
              onOpenSwitchAccount={() => setIsAccountMenuOpen(true)}
              setView={setView}
              onTriggerEditProfile={() => {
                setView('PROFILE', currentUser);
                setProfileAutoEdit(true);
              }}
            />
          )}
        </div>
      </main>

      {isAccountMenuOpen && (
        <div className="fixed inset-0 z-[1000] bg-[var(--vix-bg)]/95 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="w-full max-sm bg-[var(--vix-card)] border border-[var(--vix-border)] rounded-[2.5rem] overflow-hidden shadow-2xl animate-vix-in ring-1 ring-white/5">
            <div className="p-6 border-b border-[var(--vix-border)] flex justify-between items-center bg-[var(--vix-secondary)]/20">
              <h3 className="font-black text-[10px] uppercase tracking-[0.3em] text-zinc-500">Switch Account</h3>
              <button onClick={() => setIsAccountMenuOpen(false)} className="p-2 text-zinc-700 hover:text-[var(--vix-text)] transition-colors"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto max-h-[60vh] no-scrollbar">
              {savedAccounts.map(acc => (
                <div key={acc.id} className={`flex items-center justify-between p-4 rounded-2xl transition-all group border ${acc.id === currentUser.id ? 'bg-[var(--vix-secondary)]/40 border-blue-500/20' : 'hover:bg-[var(--vix-secondary)]/20 border-transparent'}`}>
                   <div className="flex items-center gap-4 flex-1 cursor-pointer" onClick={() => acc.id !== currentUser.id && switchAccount(acc)}>
                      <div className={`w-12 h-12 rounded-full p-0.5 ${acc.id === currentUser.id ? 'vix-gradient' : 'bg-[var(--vix-secondary)]'}`}>
                        <img src={acc.avatar_url || `https://ui-avatars.com/api/?name=${acc.username}`} className="w-full h-full rounded-full object-cover bg-[var(--vix-bg)]" />
                      </div>
                      <div className="flex flex-col">
                        <p className="font-bold text-sm text-[var(--vix-text)]">@{acc.username}</p>
                        {acc.id === currentUser.id && <span className="text-[9px] text-blue-500 font-black uppercase tracking-widest mt-0.5 animate-pulse">Active</span>}
                      </div>
                   </div>
                   {acc.id !== currentUser.id ? (
                     <button onClick={(e) => { e.stopPropagation(); removeAccount(acc.id); }} className="p-3 text-zinc-700 hover:text-red-500 transition-all">
                       <Trash2 className="w-4 h-4" />
                     </button>
                   ) : <CheckCircle className="w-4 h-4 text-blue-500" />}
                </div>
              ))}
              <button 
                onClick={() => { setIsAccountMenuOpen(false); setIsAddingAccount(true); }}
                className="w-full flex items-center gap-4 p-4 hover:bg-[var(--vix-secondary)] rounded-2xl transition-all group border border-dashed border-[var(--vix-border)] hover:border-blue-500/30"
              >
                <div className="w-12 h-12 rounded-full bg-[var(--vix-secondary)] flex items-center justify-center text-zinc-600 group-hover:text-blue-500 group-hover:bg-blue-500/5 transition-all">
                  <Plus className="w-6 h-6" />
                </div>
                <span className="font-bold text-sm text-zinc-500 group-hover:text-[var(--vix-text)]">Add Account</span>
              </button>
            </div>
            <div className="p-6 border-t border-[var(--vix-border)] bg-[var(--vix-secondary)]/10">
              <button onClick={handleLogout} className="w-full py-4 text-center text-red-500 font-black text-[11px] uppercase tracking-widest hover:text-red-400 transition-colors">Relinquish Primary Session</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
