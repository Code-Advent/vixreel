import React, { useState, useEffect } from 'react';
import { Loader2, Users, LogOut, Trash2, X, UserPlus, CheckCircle } from 'lucide-react';
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

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [viewedUser, setViewedUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<ViewType>('FEED');
  const [posts, setPosts] = useState<PostType[]>([]);
  const [initialChatUser, setInitialChatUser] = useState<UserProfile | null>(null);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [switchSuccess, setSwitchSuccess] = useState<string | null>(null);
  
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
          if (session.user.email === 'davidhen498@gmail.com') {
            profile.is_admin = true;
          }
          setCurrentUser(profile);
          updateSavedAccounts(profile, session);
          await fetchPosts();
        } else {
          // Fallback if trigger was slow
          await new Promise(r => setTimeout(r, 1000));
          const retryProfile = await resolveIdentity(session.user);
          if (retryProfile) {
            setCurrentUser(retryProfile);
            await fetchPosts();
          }
        }
      } else {
        setCurrentUser(null);
      }
    } catch (err) {
      console.error("VixReel Core Sync Failure:", err);
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
    if (account.id === currentUser?.id) {
      setIsAccountMenuOpen(false);
      return;
    }
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
        setSwitchSuccess(account.username);
        setTimeout(() => setSwitchSuccess(null), 3000);
      } else {
        throw error;
      }
    } catch (err) {
      const updated = savedAccounts.filter(acc => acc.id !== account.id);
      setSavedAccounts(updated);
      localStorage.setItem('vixreel_saved_accounts', JSON.stringify(updated));
      setLoading(false);
    }
  };

  const handleRemoveAccount = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Permanently remove this identity from vault?")) return;
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
    try {
      // First attempt to find existing profile
      let { data: dbProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();
      
      if (dbProfile) return dbProfile as UserProfile;

      // If missing (common on first phone login), perform a manual sync/upsert
      const metadata = authUser.user_metadata || {};
      const username = metadata.username || (authUser.phone ? `user_${authUser.phone.slice(-4)}` : `user_${authUser.id.slice(0, 5)}`);
      
      const { data: retryProfile, error: upsertError } = await supabase.from('profiles').upsert({
        id: authUser.id,
        username: username,
        full_name: metadata.full_name || username,
        email: authUser.email || metadata.email,
        phone: authUser.phone || metadata.phone || null,
        phone_verified: !!(authUser.phone_confirmed_at || metadata.phone_verified),
        date_of_birth: metadata.date_of_birth || null,
        is_admin: authUser.email === 'davidhen498@gmail.com',
        is_verified: authUser.email === 'davidhen498@gmail.com'
      }, { onConflict: 'id' }).select().single();
      
      if (upsertError) throw upsertError;
      return retryProfile as UserProfile;
    } catch (err) {
      console.error("Identity Resolution Exception:", err);
      return null;
    }
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
    <div className="h-screen w-screen bg-black flex flex-col items-center justify-center text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#111_0%,_#000_100%)]"></div>
      <div className="relative z-10 flex flex-col items-center">
        <div className="w-24 h-24 rounded-[2rem] vix-gradient flex items-center justify-center mb-8 animate-pulse shadow-[0_0_50px_rgba(255,0,128,0.3)]">
          <span className="text-white font-black text-4xl logo-font">V</span>
        </div>
        <div className="space-y-3 text-center">
          <h2 className="logo-font text-3xl vix-text-gradient">VixReel</h2>
          <div className="flex items-center gap-2 justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-bounce" style={{ animationDelay: '0s' }}></div>
            <div className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-600 mt-4">Synchronizing Narrative Cores</p>
        </div>
      </div>
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
        isAdminUnlocked={currentUser.is_admin || currentUser.email === 'davidhen498@gmail.com'} 
      />

      <main className="flex-1 sm:ml-16 lg:ml-64 pb-20 sm:pb-0 overflow-y-auto h-screen no-scrollbar">
        {switchSuccess && (
          <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[3000] bg-green-500 text-white px-8 py-4 rounded-[2rem] font-black uppercase tracking-widest text-[10px] shadow-2xl animate-in slide-in-from-top duration-500 flex items-center gap-3">
             <CheckCircle className="w-4 h-4" /> Signal Switched: @{switchSuccess}
          </div>
        )}

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
                {posts.length > 0 ? (
                  posts.map(p => (
                    <Post key={p.id} post={p} currentUserId={currentUser.id} onDelete={handlePostDeleted} onUpdate={fetchPosts} />
                  ))
                ) : (
                  <div className="py-20 text-center text-zinc-700 font-black uppercase tracking-widest text-xs">Waiting for Signal Injections...</div>
                )}
              </div>
            </div>
          )}
          {currentView === 'EXPLORE' && <Explore currentUserId={currentUser.id} onSelectUser={(u) => setView('PROFILE', u)} />}
          {currentView === 'PROFILE' && viewedUser && <Profile user={viewedUser} isOwnProfile={viewedUser.id === currentUser.id} onUpdateProfile={(u) => {
              if (viewedUser.id === currentUser.id) setCurrentUser(prev => prev ? {...prev, ...u} : null);
              setViewedUser(prev => prev ? {...prev, ...u} : null);
            }} onMessageUser={(u) => { setInitialChatUser(u); setCurrentView('MESSAGES'); }} />}
          {currentView === 'CREATE' && <CreatePost userId={currentUser.id} onClose={() => setCurrentView('FEED')} onPostSuccess={fetchPosts} />}
          {currentView === 'SEARCH' && <Search onSelectUser={(u) => setView('PROFILE', u)} />}
          {currentView === 'MESSAGES' && <Messages currentUser={currentUser} initialChatUser={initialChatUser} />}
          {currentView === 'ADMIN' && (currentUser.is_admin || currentUser.email === 'davidhen498@gmail.com') && <Admin />}
          {currentView === 'NOTIFICATIONS' && <Notifications currentUser={currentUser} onOpenAdmin={() => setCurrentView('ADMIN')} isAdminUnlocked={currentUser.is_admin || currentUser.email === 'davidhen498@gmail.com'} />}
        </div>
      </main>

      {/* Persistent Identity Vault Modal */}
      {isAccountMenuOpen && (
        <div className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-zinc-950 border border-zinc-900 rounded-[2.5rem] overflow-hidden shadow-2xl animate-vix-in">
            <div className="p-6 border-b border-zinc-900 flex justify-between items-center">
              <h3 className="font-black uppercase tracking-widest text-[10px] text-zinc-500">Identity Vault</h3>
              <button onClick={() => setIsAccountMenuOpen(false)}><X className="w-5 h-5 text-zinc-600" /></button>
            </div>
            <div className="p-4 space-y-2 max-h-[400px] overflow-y-auto no-scrollbar">
              {savedAccounts.map(acc => (
                <div 
                  key={acc.id} 
                  onClick={() => handleSwitchAccount(acc)}
                  className={`flex items-center justify-between p-3 rounded-2xl transition-all cursor-pointer ${acc.id === currentUser?.id ? 'bg-zinc-900/50 border border-pink-500/20 shadow-lg' : 'hover:bg-zinc-900 border border-transparent opacity-60 hover:opacity-100'}`}
                >
                  <div className="flex items-center gap-3">
                    <img src={acc.avatar_url || `https://ui-avatars.com/api/?name=${acc.username}`} className="w-10 h-10 rounded-full object-cover" />
                    <div className="flex flex-col">
                      <p className="font-bold text-sm">@{acc.username}</p>
                      {acc.id === currentUser?.id && <span className="text-[8px] text-pink-500 font-black uppercase tracking-tighter">Active Protocol</span>}
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
                <UserPlus className="w-4 h-4" /> Add New Fragment
              </button>

              <button 
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-3 p-4 rounded-2xl bg-zinc-900/30 hover:bg-zinc-800/50 transition-all font-black uppercase tracking-widest text-[10px] text-zinc-500 mt-6"
              >
                <LogOut className="w-4 h-4" /> Suspend Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;