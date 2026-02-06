
import React, { useState, useEffect } from 'react';
import { Loader2, Users, LogOut, Trash2, X, UserPlus } from 'lucide-react';
import { supabase } from './lib/supabase';
import { UserProfile, Post as PostType, ViewType, AccountSession } from './types';
import Sidebar from './components/Sidebar';
import Post from './components/Post';
import Stories from './components/Stories';
import Profile from './components/Profile';
import CreatePost from './components/CreatePost';
import Search from './components/Search';
import Auth from './components/Auth';
import Messages from './components/Messages';
import Admin from './components/Admin';
import Notifications from './components/Notifications';
import Explore from './components/Explore';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [viewedUser, setViewedUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<ViewType>('FEED');
  const [posts, setPosts] = useState<PostType[]>([]);
  const [initialChatUser, setInitialChatUser] = useState<UserProfile | null>(null);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  
  const [savedAccounts, setSavedAccounts] = useState<AccountSession[]>(() => {
    const saved = localStorage.getItem('vixreel_saved_accounts');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    const handleGlobalUpdate = (e: any) => {
      const { id, ...updates } = e.detail;
      
      if (currentUser && id === currentUser.id) {
        setCurrentUser(prev => prev ? { ...prev, ...updates } : null);
      }
      
      if (viewedUser && id === viewedUser.id) {
        setViewedUser(prev => prev ? { ...prev, ...updates } : null);
      }

      setPosts(prev => prev.map(p => 
        p.user.id === id ? { ...p, user: { ...p.user, ...updates } } : p
      ));
    };

    window.addEventListener('vixreel-user-updated', handleGlobalUpdate);
    return () => window.removeEventListener('vixreel-user-updated', handleGlobalUpdate);
  }, [currentUser, viewedUser]);

  const init = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const profile = await resolveIdentity(session.user);
        if (profile) {
          setCurrentUser(profile);
          updateSavedAccounts(profile, session);
          await fetchPosts();
        }
      } else {
        setCurrentUser(null);
      }
    } catch (err) {
      console.error("VixReel Core Error:", err);
    } finally {
      setLoading(false);
      setIsAddingAccount(false);
    }
  };

  const updateSavedAccounts = (profile: UserProfile, session: any) => {
    setSavedAccounts(prev => {
      const filtered = prev.filter(acc => acc.id !== profile.id);
      const updated = [{ 
        id: profile.id, 
        username: profile.username, 
        avatar_url: profile.avatar_url, 
        session 
      }, ...filtered];
      localStorage.setItem('vixreel_saved_accounts', JSON.stringify(updated));
      return updated;
    });
  };

  const handleSwitchAccount = async (account: AccountSession) => {
    if (account.id === currentUser?.id) return;
    setLoading(true);
    setIsAccountMenuOpen(false);
    
    try {
      const { error } = await supabase.auth.setSession({
        access_token: account.session.access_token,
        refresh_token: account.session.refresh_token
      });
      
      if (!error) {
        await init();
        setCurrentView('FEED');
      } else {
        throw error;
      }
    } catch (err) {
      console.error("Narrative switch failed", err);
      const updated = savedAccounts.filter(acc => acc.id !== account.id);
      setSavedAccounts(updated);
      localStorage.setItem('vixreel_saved_accounts', JSON.stringify(updated));
      alert("Session expired. Identity re-authentication required.");
      setLoading(false);
    }
  };

  const handleRemoveAccount = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedAccounts.filter(acc => acc.id !== id);
    setSavedAccounts(updated);
    localStorage.setItem('vixreel_saved_accounts', JSON.stringify(updated));
    if (id === currentUser?.id) {
      handleLogout();
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setCurrentUser(null);
    setIsAccountMenuOpen(false);
    setLoading(false);
  };

  const resolveIdentity = async (authUser: any): Promise<UserProfile | null> => {
    const { data: dbProfile } = await supabase.from('profiles').select('*').eq('id', authUser.id).maybeSingle();
    const metadata = authUser.user_metadata || {};
    const emailPrefix = authUser.email?.split('@')[0];
    const masterUsername = dbProfile?.username || metadata.username || emailPrefix;
    const isAdmin = authUser.email === 'davidhen498@gmail.com';

    if (!dbProfile) {
      const { data: retryProfile } = await supabase.from('profiles').select('*').eq('id', authUser.id).maybeSingle();
      if (!retryProfile) {
        await supabase.from('profiles').upsert({
          id: authUser.id,
          username: masterUsername,
          full_name: metadata.full_name || masterUsername,
          email: authUser.email,
          date_of_birth: metadata.date_of_birth || null,
          is_admin: isAdmin,
          is_verified: isAdmin
        });
      }
    }

    return {
      id: authUser.id,
      username: masterUsername,
      full_name: metadata.full_name || dbProfile?.full_name || masterUsername,
      avatar_url: dbProfile?.avatar_url || metadata.avatar_url || null,
      bio: dbProfile?.bio || null,
      date_of_birth: dbProfile?.date_of_birth || metadata.date_of_birth || null,
      is_admin: isAdmin || !!dbProfile?.is_admin,
      is_verified: isAdmin || !!dbProfile?.is_verified, 
      email: authUser.email
    };
  };

  const fetchPosts = async () => {
    const { data } = await supabase.from('posts').select('*, user:profiles(*)').order('created_at', { ascending: false });
    if (data) setPosts(data as any);
  };

  const setView = (view: ViewType, explicitUser?: UserProfile) => {
    if (explicitUser) {
      setViewedUser(explicitUser);
    } else if (view === 'PROFILE') {
      setViewedUser(currentUser);
    }
    setCurrentView(view);
  };

  const handlePostDeleted = (deletedId: string) => {
    setPosts(prev => prev.filter(p => p.id !== deletedId));
  };

  if (loading) return (
    <div className="h-screen w-screen bg-black flex flex-col items-center justify-center text-white">
      <div className="w-16 h-16 rounded-2xl vix-gradient flex items-center justify-center mb-6 animate-pulse">
        <span className="text-white font-black text-3xl logo-font">V</span>
      </div>
      <Loader2 className="w-4 h-4 text-zinc-800 animate-spin" />
    </div>
  );

  if (!currentUser || isAddingAccount) return <Auth onAuthSuccess={() => { setIsAddingAccount(false); init(); }} />;

  return (
    <div className="bg-black min-h-screen text-white flex overflow-hidden">
      <Sidebar 
        currentView={currentView} 
        setView={(v) => setView(v)} 
        onLogout={() => setIsAccountMenuOpen(true)} 
        currentUser={currentUser} 
        isAdminUnlocked={currentUser.is_admin} 
      />

      <main className="flex-1 sm:ml-16 lg:ml-64 pb-20 sm:pb-0 overflow-y-auto h-screen no-scrollbar">
        <div className="container mx-auto max-w-[935px] pt-4 px-4 animate-vix-in">
          {currentView === 'FEED' && (
            <div className="flex flex-col items-center pb-20">
              <div className="w-full flex justify-between items-center mb-6 px-2">
                <h1 className="logo-font text-3xl vix-text-gradient cursor-pointer" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>VixReel</h1>
                <button onClick={() => setIsAccountMenuOpen(true)} className="p-2 bg-zinc-900/50 rounded-full hover:bg-zinc-800 transition-all border border-zinc-800/50">
                  <Users className="w-5 h-5 text-zinc-400" />
                </button>
              </div>
              <div className="w-full max-w-[470px] mt-2 space-y-6">
                <Stories currentUser={currentUser} />
                {posts.length > 0 ? (
                  posts.map(p => (
                    <Post key={p.id} post={p} currentUserId={currentUser.id} onDelete={handlePostDeleted} onUpdate={fetchPosts} />
                  ))
                ) : (
                  <div className="py-20 text-center text-zinc-700 font-black uppercase tracking-widest text-xs">Awaiting Narrative Injections...</div>
                )}
              </div>
            </div>
          )}
          {currentView === 'EXPLORE' && (
            <Explore 
              currentUserId={currentUser.id} 
              onSelectUser={(u) => setView('PROFILE', u)} 
            />
          )}
          {currentView === 'PROFILE' && viewedUser && (
            <Profile user={viewedUser} isOwnProfile={viewedUser.id === currentUser.id} onUpdateProfile={(u) => {
              if (viewedUser.id === currentUser.id) setCurrentUser(prev => prev ? {...prev, ...u} : null);
              setViewedUser(prev => prev ? {...prev, ...u} : null);
            }} onMessageUser={(u) => { setInitialChatUser(u); setCurrentView('MESSAGES'); }} />
          )}
          {currentView === 'CREATE' && <CreatePost userId={currentUser.id} onClose={() => setCurrentView('FEED')} onPostSuccess={fetchPosts} />}
          {currentView === 'SEARCH' && <Search onSelectUser={(u) => setView('PROFILE', u)} />}
          {currentView === 'MESSAGES' && <Messages currentUser={currentUser} initialChatUser={initialChatUser} />}
          {currentView === 'ADMIN' && currentUser.is_admin && <Admin />}
          {currentView === 'NOTIFICATIONS' && <Notifications currentUser={currentUser} onOpenAdmin={() => setCurrentView('ADMIN')} isAdminUnlocked={currentUser.is_admin} />}
        </div>
      </main>

      {/* Account Switcher Modal */}
      {isAccountMenuOpen && (
        <div className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-zinc-950 border border-zinc-900 rounded-[2.5rem] overflow-hidden shadow-2xl animate-vix-in">
            <div className="p-6 border-b border-zinc-900 flex justify-between items-center">
              <h3 className="font-black uppercase tracking-widest text-[10px] text-zinc-500">Narrative Accounts</h3>
              <button onClick={() => setIsAccountMenuOpen(false)}><X className="w-5 h-5 text-zinc-600" /></button>
            </div>
            <div className="p-4 space-y-2 max-h-[400px] overflow-y-auto no-scrollbar">
              {savedAccounts.map(acc => (
                <div 
                  key={acc.id} 
                  onClick={() => handleSwitchAccount(acc)}
                  className={`flex items-center justify-between p-3 rounded-2xl transition-all cursor-pointer ${acc.id === currentUser?.id ? 'bg-zinc-900/50 border border-pink-500/20' : 'hover:bg-zinc-900 border border-transparent'}`}
                >
                  <div className="flex items-center gap-3">
                    <img src={acc.avatar_url || `https://ui-avatars.com/api/?name=${acc.username}`} className="w-10 h-10 rounded-full object-cover" />
                    <div className="flex flex-col">
                      <p className="font-bold text-sm">@{acc.username}</p>
                      {acc.id === currentUser?.id && <span className="text-[8px] text-pink-500 font-black uppercase">Active</span>}
                    </div>
                  </div>
                  <button onClick={(e) => handleRemoveAccount(acc.id, e)} className="p-2 text-zinc-700 hover:text-red-500 transition-all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              
              <button 
                onClick={() => { setIsAddingAccount(true); setIsAccountMenuOpen(false); }}
                className="w-full flex items-center justify-center gap-3 p-4 rounded-2xl bg-zinc-900/50 hover:bg-zinc-800 transition-all font-black uppercase tracking-widest text-[10px] text-white border border-zinc-800 border-dashed mt-2"
              >
                <UserPlus className="w-4 h-4" /> Add Account
              </button>

              <button 
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-3 p-4 rounded-2xl bg-zinc-900/30 hover:bg-zinc-800/50 transition-all font-black uppercase tracking-widest text-[10px] text-zinc-500 mt-6"
              >
                <LogOut className="w-4 h-4" /> Terminate Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
