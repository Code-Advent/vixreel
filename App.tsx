
import React, { useState, useEffect } from 'react';
import { Home as HomeIcon, Search as SearchIcon, PlaySquare, PlusSquare, Compass, Users, Heart, MoreHorizontal, UserPlus, LogOut, Check, X } from 'lucide-react';
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
  const [explorePosts, setExplorePosts] = useState<PostType[]>([]);
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
      window.location.reload(); // Refresh to update all hooks and context
    } else {
      alert("Session expired. Please log in again.");
      handleRemoveAccount(account.id);
      setLoading(false);
    }
  };

  const handleRemoveAccount = (id: string) => {
    const updated = savedAccounts.filter(acc => acc.id !== id);
    setSavedAccounts(updated);
    localStorage.setItem('vixreel_accounts', JSON.stringify(updated));
  };

  const handleAddAccount = () => {
    setIsMenuOpen(false);
    setIsAccountSwitcherOpen(false);
    setCurrentUser(null); // Force Auth screen
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
    if (currentUser) {
      handleRemoveAccount(currentUser.id);
    }
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
        <div className="container mx-auto max-w-[935px] pt-4 px-4 relative">
          {/* Top Right Menu Trigger (Mobile & Desktop) */}
          <div className="absolute top-4 right-4 z-[60]">
             <button onClick={() => setIsMenuOpen(true)} className="p-2 hover:bg-zinc-900 rounded-full transition-colors">
                <MoreHorizontal className="w-6 h-6" />
             </button>
          </div>

          {currentView === 'FEED' && (
            <div className="flex flex-col items-center">
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

      {/* Bottom Sheet Menu */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => {setIsMenuOpen(false); setIsAccountSwitcherOpen(false);}}></div>
          <div className="relative w-full max-w-md bg-zinc-900 rounded-t-[2.5rem] p-6 pb-10 shadow-2xl animate-in slide-in-from-bottom duration-300 border-t border-zinc-800">
             <div className="w-12 h-1 bg-zinc-800 rounded-full mx-auto mb-6"></div>
             
             {!isAccountSwitcherOpen ? (
               <div className="space-y-2">
                 <button onClick={() => setIsAccountSwitcherOpen(true)} className="w-full flex items-center justify-between p-4 hover:bg-zinc-800 rounded-2xl transition-all group">
                    <div className="flex items-center gap-4">
                       <Users className="w-5 h-5 text-zinc-400" />
                       <span className="font-bold">Switch Account</span>
                    </div>
                    <Check className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                 </button>
                 <button onClick={handleLogout} className="w-full flex items-center gap-4 p-4 hover:bg-zinc-800 rounded-2xl transition-all text-red-500">
                    <LogOut className="w-5 h-5" />
                    <span className="font-bold">Log Out</span>
                 </button>
               </div>
             ) : (
               <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-black uppercase tracking-widest text-zinc-500">Accounts</h3>
                    <button onClick={() => setIsAccountSwitcherOpen(false)} className="text-zinc-500 hover:text-white"><X className="w-5 h-5" /></button>
                  </div>
                  <div className="space-y-3 max-h-[40vh] overflow-y-auto no-scrollbar">
                    {savedAccounts.map(acc => (
                      <div key={acc.id} className="flex items-center justify-between p-3 rounded-2xl hover:bg-zinc-800 transition-colors group">
                        <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleSwitchAccount(acc)}>
                          <img src={acc.avatar_url || `https://ui-avatars.com/api/?name=${acc.username}`} className="w-10 h-10 rounded-full object-cover" />
                          <div className="flex flex-col">
                            <span className="font-bold text-sm">{acc.username}</span>
                            {acc.id === currentUser.id && <span className="text-[10px] text-pink-500 font-bold uppercase">Active</span>}
                          </div>
                        </div>
                        <button onClick={() => handleRemoveAccount(acc.id)} className="p-2 text-zinc-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2Icon className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button onClick={handleAddAccount} className="w-full flex items-center gap-4 p-4 mt-2 border border-zinc-800 rounded-2xl hover:bg-zinc-800 transition-all text-blue-400">
                    <UserPlus className="w-5 h-5" />
                    <span className="font-bold">Add New Account</span>
                  </button>
               </div>
             )}
          </div>
        </div>
      )}
    </div>
  );
};

const Trash2Icon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
    </svg>
);

export default App;
