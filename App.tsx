
import React, { useState, useEffect } from 'react';
import { MoreHorizontal, Users, LogOut, UserPlus, Trash2, X, Check, Loader2, Heart, PlaySquare, Shield, Settings } from 'lucide-react';
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

  const handleDeleteAccountFromDevice = () => {
    if (!currentUser) return;
    if (window.confirm("Remove this account from your device history?")) {
      handleRemoveAccount(currentUser.id);
      supabase.auth.signOut().then(() => {
        window.location.reload();
      });
    }
  };

  const handlePermanentDeleteAccount = async () => {
    if (!currentUser) return;
    if (window.confirm("Permanently delete your VixReel presence? This cannot be undone.")) {
      const { error } = await supabase.from('profiles').delete().eq('id', currentUser.id);
      if (!error) {
        handleRemoveAccount(currentUser.id);
        await supabase.auth.signOut();
        window.location.reload();
      }
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
    setIsMenuOpen(false);
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
    <div className="bg-black min-h-screen text-white flex relative overflow-x-hidden">
      <Sidebar currentView={currentView} setView={handleSidebarViewChange} onLogout={() => setIsMenuOpen(true)} currentUser={currentUser} isAdminUnlocked={isAdminUnlocked} />

      <main className="flex-1 sm:ml-16 lg:ml-64 pb-20 sm:pb-0 overflow-y-auto h-screen">
        <div className="container mx-auto max-w-[935px] pt-2 sm:pt-4 px-2 sm:px-4 relative min-h-full">
          <div className="sm:hidden flex items-center justify-between py-2 px-4 mb-4 border-b border-zinc-900 bg-black/60 backdrop-blur-md sticky top-0 z-40">
            <h1 className="logo-font text-2xl font-bold vix-text-gradient" onClick={() => setCurrentView('FEED')}>VixReel</h1>
            <div className="flex items-center gap-3">
              <button onClick={() => setCurrentView('NOTIFICATIONS')}><Heart className={`w-6 h-6 ${currentView === 'NOTIFICATIONS' ? 'text-pink-500 fill-pink-500' : ''}`} /></button>
              <button onClick={() => setIsMenuOpen(true)}><MoreHorizontal className="w-6 h-6" /></button>
            </div>
          </div>

          <div className="animate-vix-in">
            {currentView === 'FEED' && (
              <div className="flex flex-col items-center pb-10">
                <Stories currentUser={currentUser} />
                <div className="w-full max-w-[470px] mt-4 sm:mt-8 space-y-6">
                  {posts.map(p => <Post key={p.id} post={p} currentUserId={currentUser.id} onDelete={fetchPosts} onUpdate={fetchPosts} />)}
                </div>
              </div>
            )}
            {currentView === 'PROFILE' && viewedUser && (
              <Profile user={viewedUser} isOwnProfile={viewedUser.id === currentUser.id} onUpdateProfile={(u) => {
                if (viewedUser.id === currentUser.id) setCurrentUser(prev => prev ? {...prev, ...u} : null);
                setViewedUser(prev => prev ? {...prev, ...u} : null);
              }} onMessageUser={(u) => { setInitialChatUser(u); setCurrentView('MESSAGES'); }} />
            )}
            {currentView === 'CREATE' && <CreatePost userId={currentUser.id} onClose={() => setCurrentView('FEED')} onPostSuccess={fetchPosts} />}
            {currentView === 'SEARCH' && <Search onSelectUser={(u) => { setViewedUser(u); setCurrentView('PROFILE'); }} />}
            {currentView === 'EXPLORE' && (
              <div className="grid grid-cols-3 gap-1 sm:gap-4 mt-4">
                {posts.map(p => (
                  <div key={p.id} onClick={() => { setViewedUser(p.user); setCurrentView('PROFILE'); }} className="aspect-square bg-zinc-950 border border-zinc-900 rounded-sm sm:rounded-xl overflow-hidden cursor-pointer hover:scale-[0.98] transition-all relative">
                    {p.media_type === 'video' ? <video src={p.media_url} className="w-full h-full object-cover" /> : <img src={p.media_url} className="w-full h-full object-cover" />}
                    {p.media_type === 'video' && <PlaySquare className="absolute top-2 right-2 w-4 h-4 text-white/50" />}
                  </div>
                ))}
              </div>
            )}
            {currentView === 'MESSAGES' && <Messages currentUser={currentUser} initialChatUser={initialChatUser} />}
            {currentView === 'ADMIN' && isAdminUnlocked && <Admin />}
          </div>
        </div>
      </main>

      {isMenuOpen && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => {setIsMenuOpen(false); setIsAccountSwitcherOpen(false);}}></div>
          <div className="relative w-full max-w-md bg-zinc-950 rounded-t-[2.5rem] p-6 pb-12 shadow-[0_-20px_100px_rgba(255,0,128,0.15)] border-t border-zinc-900 animate-in slide-in-from-bottom duration-300">
             <div className="w-12 h-1 bg-zinc-800 rounded-full mx-auto mb-10"></div>
             {!isAccountSwitcherOpen ? (
               <div className="space-y-4">
                 <button onClick={() => setIsAccountSwitcherOpen(true)} className="w-full flex items-center justify-between p-5 hover:bg-zinc-900 rounded-3xl transition-all border border-zinc-900/50 group"><div className="flex items-center gap-4"><Users className="w-5 h-5 text-zinc-500 group-hover:text-white" /><span className="font-black uppercase tracking-widest text-xs">Presences</span></div></button>
                 <button onClick={handleDeleteAccountFromDevice} className="w-full flex items-center gap-4 p-5 hover:bg-zinc-900 rounded-3xl transition-all text-white border border-transparent"><LogOut className="w-5 h-5 text-zinc-500" /><span className="font-black uppercase tracking-widest text-xs">Clear Presence</span></button>
                 <button onClick={handlePermanentDeleteAccount} className="w-full flex items-center gap-4 p-5 hover:bg-red-500/10 rounded-3xl transition-all text-red-500 border border-transparent"><Trash2 className="w-5 h-5" /><span className="font-black uppercase tracking-widest text-xs">Terminate</span></button>
                 <button onClick={() => setIsMenuOpen(false)} className="w-full p-4 text-[10px] font-black uppercase tracking-[0.3em] text-zinc-700">Close</button>
               </div>
             ) : (
               <div className="space-y-6">
                  <div className="flex items-center justify-between mb-2"><h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600">Active Presences</h3><button onClick={() => setIsAccountSwitcherOpen(false)} className="text-zinc-500 p-2"><X className="w-5 h-5" /></button></div>
                  <div className="space-y-3 max-h-[45vh] overflow-y-auto no-scrollbar">
                    {savedAccounts.map(acc => (
                      <div key={acc.id} onClick={() => handleSwitchAccount(acc)} className="flex items-center justify-between p-4 rounded-3xl hover:bg-zinc-900 transition-all cursor-pointer border border-zinc-900/40">
                        <div className="flex items-center gap-4"><img src={acc.avatar_url || `https://ui-avatars.com/api/?name=${acc.username}`} className="w-12 h-12 rounded-full object-cover" /><div><span className="font-black text-sm uppercase">{acc.username}</span></div></div>
                      </div>
                    ))}
                  </div>
                  <button onClick={handleAddAccount} className="w-full p-5 mt-2 border border-zinc-900 rounded-3xl hover:bg-zinc-900 text-pink-500 font-black uppercase tracking-widest text-[10px]">New Identity</button>
               </div>
             )}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
