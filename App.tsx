
import React, { useState, useEffect } from 'react';
import { MoreHorizontal, Users, LogOut, UserPlus, Trash2, X, Check, Loader2 } from 'lucide-react';
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

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [viewedUser, setViewedUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<ViewType>('FEED');
  const [posts, setPosts] = useState<PostType[]>([]);
  const [initialChatUser, setInitialChatUser] = useState<UserProfile | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAccountSwitcherOpen, setIsAccountSwitcherOpen] = useState(false);
  
  const [savedAccounts, setSavedAccounts] = useState<AccountSession[]>(() => {
    const saved = localStorage.getItem('vixreel_accounts');
    return saved ? JSON.parse(saved) : [];
  });

  const [isAdminUnlocked, setIsAdminUnlocked] = useState(() => {
    return localStorage.getItem('vixreel_admin_unlocked') === 'true';
  });

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        if (profile) {
          saveAccountToList(profile, session);
        }
        await fetchPosts();
      }
    } catch (err) {
      console.error("Initialization error:", err);
    } finally {
      setTimeout(() => setLoading(false), 800);
    }
  };

  const saveAccountToList = (profile: UserProfile, session: any) => {
    setSavedAccounts(prev => {
      const filtered = prev.filter(acc => acc.id !== profile.id);
      const newList = [...filtered, { id: profile.id, username: profile.username, avatar_url: profile.avatar_url, session }];
      localStorage.setItem('vixreel_accounts', JSON.stringify(newList));
      return newList;
    });
  };

  const handleSwitchAccount = async (account: AccountSession) => {
    setLoading(true);
    const { error } = await supabase.auth.setSession(account.session);
    if (!error) {
      window.location.reload(); 
    } else {
      alert("Session expired. Signing out...");
      handleRemoveAccount(account.id);
      setLoading(false);
    }
  };

  const handleRemoveAccount = (id: string) => {
    const updated = savedAccounts.filter(acc => acc.id !== id);
    setSavedAccounts(updated);
    localStorage.setItem('vixreel_accounts', JSON.stringify(updated));
  };

  const handleDeleteAccount = async () => {
    if (!currentUser) return;
    if (window.confirm("CRITICAL: This will permanently log you out and remove your profile from this device. Proceed?")) {
      handleRemoveAccount(currentUser.id);
      await supabase.auth.signOut();
      window.location.reload();
    }
  };

  const handleAddAccount = () => {
    setIsMenuOpen(false);
    setIsAccountSwitcherOpen(false);
    setCurrentUser(null);
  };

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) {
        setCurrentUser(data as UserProfile);
        return data as UserProfile;
    }
    return null;
  };

  const fetchPosts = async () => {
    const { data } = await supabase
      .from('posts')
      .select('*, user:profiles(*)')
      .order('created_at', { ascending: false });
    if (data) setPosts(data as any);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('vixreel_admin_unlocked');
    setCurrentUser(null);
    window.location.reload();
  };

  const handleSidebarViewChange = (view: ViewType) => {
    if (view === 'PROFILE') setViewedUser(currentUser);
    setCurrentView(view);
  };

  if (loading) return (
    <div className="h-screen w-screen bg-black flex flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-radial-gradient from-pink-500/10 to-transparent opacity-50 blur-[120px]" />
      <div className="relative flex flex-col items-center">
        <div className="w-24 h-24 rounded-[2rem] vix-gradient flex items-center justify-center mb-8 animate-pulse shadow-[0_0_50px_rgba(255,0,128,0.4)]">
          <span className="text-white font-black text-5xl logo-font">V</span>
        </div>
        <h1 className="logo-font text-4xl font-bold vix-text-gradient tracking-widest animate-vix-in">VixReel</h1>
        <Loader2 className="w-6 h-6 text-zinc-800 animate-spin mt-4" />
      </div>
    </div>
  );

  if (!currentUser) return <Auth onAuthSuccess={() => init()} />;

  return (
    <div className="bg-black min-h-screen text-white flex relative overflow-hidden">
      <Sidebar 
        currentView={currentView} 
        setView={handleSidebarViewChange} 
        onLogout={() => setIsMenuOpen(true)} 
        currentUser={currentUser} 
        isAdminUnlocked={isAdminUnlocked}
      />

      <main className="flex-1 lg:ml-64 pb-24 lg:pb-0 overflow-y-auto h-screen">
        <div className="container mx-auto max-w-[935px] pt-4 px-4 relative min-h-full">
          {/* Top Right Three Dot Menu */}
          <div className="absolute top-4 right-4 z-[60]">
             <button onClick={() => setIsMenuOpen(true)} className="p-2 hover:bg-zinc-900 rounded-full transition-colors bg-black/20 backdrop-blur-md">
                <MoreHorizontal className="w-6 h-6" />
             </button>
          </div>

          {currentView === 'FEED' && (
            <div className="flex flex-col items-center pb-10">
              <Stories currentUser={currentUser} />
              <div className="w-full max-w-[470px] mt-8">
                {posts.map(p => <Post key={p.id} post={p} currentUserId={currentUser.id} onDelete={() => fetchPosts()} />)}
              </div>
            </div>
          )}

          {currentView === 'SEARCH' && <Search onSelectUser={(u) => { setViewedUser(u); setCurrentView('PROFILE'); }} />}

          {currentView === 'PROFILE' && viewedUser && (
            <Profile 
              user={viewedUser} 
              isOwnProfile={viewedUser.id === currentUser.id} 
              onUpdateProfile={(u) => setCurrentUser(prev => prev ? {...prev, ...u} : null)} 
              onMessageUser={(u) => { setInitialChatUser(u); setCurrentView('MESSAGES'); }}
            />
          )}

          {currentView === 'CREATE' && (
            <CreatePost userId={currentUser.id} onClose={() => setCurrentView('FEED')} onPostSuccess={fetchPosts} />
          )}

          {currentView === 'MESSAGES' && <Messages currentUser={currentUser} initialChatUser={initialChatUser} />}
          {currentView === 'ADMIN' && isAdminUnlocked && <Admin />}
          {currentView === 'NOTIFICATIONS' && <Notifications currentUser={currentUser} onOpenAdmin={() => setCurrentView('ADMIN')} isAdminUnlocked={isAdminUnlocked} />}
        </div>
      </main>

      {/* Account Switcher / Bottom Sheet Menu */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => {setIsMenuOpen(false); setIsAccountSwitcherOpen(false);}}></div>
          <div className="relative w-full max-w-md bg-zinc-950 rounded-t-[2.5rem] p-6 pb-12 shadow-[0_-20px_100px_rgba(0,0,0,0.8)] animate-in slide-in-from-bottom duration-300 border-t border-zinc-900">
             <div className="w-12 h-1 bg-zinc-800 rounded-full mx-auto mb-8"></div>
             
             {!isAccountSwitcherOpen ? (
               <div className="space-y-3">
                 <button onClick={() => setIsAccountSwitcherOpen(true)} className="w-full flex items-center justify-between p-4 hover:bg-zinc-900 rounded-2xl transition-all group border border-zinc-900/50">
                    <div className="flex items-center gap-4">
                       <Users className="w-5 h-5 text-zinc-400 group-hover:text-white transition-colors" />
                       <span className="font-bold text-sm">Switch Account</span>
                    </div>
                    <Check className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity text-pink-500" />
                 </button>
                 <button onClick={handleDeleteAccount} className="w-full flex items-center gap-4 p-4 hover:bg-red-500/10 rounded-2xl transition-all text-red-400 border border-transparent hover:border-red-500/20 group">
                    <Trash2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    <span className="font-bold text-sm">Delete Account from Device</span>
                 </button>
                 <button onClick={handleLogout} className="w-full flex items-center gap-4 p-4 hover:bg-zinc-900 rounded-2xl transition-all text-white border border-transparent">
                    <LogOut className="w-5 h-5 text-zinc-500" />
                    <span className="font-bold text-sm">Log Out</span>
                 </button>
                 <button onClick={() => setIsMenuOpen(false)} className="w-full p-4 text-sm font-bold text-zinc-500 hover:text-white">Cancel</button>
               </div>
             ) : (
               <div className="space-y-5">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Local Accounts</h3>
                    <button onClick={() => setIsAccountSwitcherOpen(false)} className="text-zinc-500 hover:text-white p-2"><X className="w-5 h-5" /></button>
                  </div>
                  <div className="space-y-3 max-h-[45vh] overflow-y-auto no-scrollbar pr-1">
                    {savedAccounts.map(acc => (
                      <div key={acc.id} className="flex items-center justify-between p-3 rounded-2xl hover:bg-zinc-900 transition-colors group border border-zinc-900/40">
                        <div className="flex items-center gap-4 cursor-pointer flex-1" onClick={() => handleSwitchAccount(acc)}>
                          <div className={`w-12 h-12 rounded-full p-[2px] ${acc.id === currentUser.id ? 'vix-gradient' : 'bg-zinc-800'}`}>
                            <img src={acc.avatar_url || `https://ui-avatars.com/api/?name=${acc.username}`} className="w-full h-full rounded-full object-cover bg-black" />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-sm">{acc.username}</span>
                            {acc.id === currentUser.id ? (
                                <span className="text-[10px] text-pink-500 font-black uppercase tracking-widest mt-0.5">Logged In</span>
                            ) : (
                                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Switch Profile</span>
                            )}
                          </div>
                        </div>
                        {acc.id !== currentUser.id && (
                            <button onClick={() => handleRemoveAccount(acc.id)} className="p-3 text-zinc-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                <X className="w-4 h-4" />
                            </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button onClick={handleAddAccount} className="w-full flex items-center justify-center gap-3 p-4 mt-2 border border-zinc-800 rounded-2xl hover:bg-zinc-900 transition-all text-pink-500 font-black uppercase tracking-widest text-[10px]">
                    <UserPlus className="w-4 h-4" />
                    Add Account
                  </button>
               </div>
             )}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
