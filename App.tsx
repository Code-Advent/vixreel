
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

  const init = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const profile = await resolveIdentity(session.user);
        if (profile) {
          if (session.user.email === 'davidhen498@gmail.com') profile.is_admin = true;
          setCurrentUser(profile);
          updateSavedAccounts(profile, session);
          await fetchPosts();
        }
      } else {
        setCurrentUser(null);
      }
    } catch (err) {
      console.error("VixReel Engine Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const updateSavedAccounts = (profile: UserProfile, session: any) => {
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
      alert("Session expired. Account will be removed.");
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
    try {
      let { data: dbProfile } = await supabase.from('profiles').select('*').eq('id', authUser.id).maybeSingle();
      if (dbProfile) return dbProfile as UserProfile;

      const metadata = authUser.user_metadata || {};
      const username = metadata.username || (authUser.phone ? `user_${authUser.phone.slice(-4)}` : `user_${authUser.id.slice(0, 5)}`);
      
      const { data: newProfile, error } = await supabase.from('profiles').upsert({
        id: authUser.id,
        username: username,
        full_name: metadata.full_name || username,
        email: authUser.email || null,
        phone: authUser.phone || null,
        is_verified: authUser.email === 'davidhen498@gmail.com'
      }).select().single();
      
      return error ? null : (newProfile as UserProfile);
    } catch (e) {
      return null;
    }
  };

  const fetchPosts = async () => {
    const { data } = await supabase.from('posts').select('*, user:profiles(*)').order('created_at', { ascending: false });
    if (data) setPosts(data as any);
  };

  const setView = (view: ViewType, explicitUser?: UserProfile) => {
    if (explicitUser) setViewedUser(explicitUser);
    else if (view === 'PROFILE') setViewedUser(currentUser);
    setCurrentView(view);
  };

  if (loading) return (
    <div className="h-screen w-screen bg-black flex flex-col items-center justify-center text-white">
      <div className="w-20 h-20 rounded-[2rem] vix-gradient animate-pulse flex items-center justify-center shadow-[0_0_80px_rgba(255,0,128,0.2)]">
        <span className="logo-font text-4xl">V</span>
      </div>
      <h2 className="logo-font text-3xl vix-text-gradient mt-6">VixReel</h2>
    </div>
  );

  if (!currentUser || isAddingAccount) {
    return (
      <Auth 
        onAuthSuccess={() => { setIsAddingAccount(false); init(); }} 
        onCancelAdd={() => setIsAddingAccount(false)}
        isAddingAccount={isAddingAccount}
      />
    );
  }

  return (
    <div className="bg-black min-h-screen text-white flex overflow-hidden">
      <Sidebar 
        currentView={currentView} 
        setView={setView} 
        onLogout={() => setIsAccountMenuOpen(true)} 
        currentUser={currentUser} 
        isAdminUnlocked={currentUser.is_admin} 
      />

      <main className="flex-1 sm:ml-16 lg:ml-64 pb-20 sm:pb-0 overflow-y-auto h-screen no-scrollbar bg-[radial-gradient(circle_at_top_right,_rgba(255,0,128,0.03)_0%,_transparent_50%)]">
        <div className="container mx-auto max-w-[935px] pt-4 px-4">
          {currentView === 'FEED' && (
            <div className="flex flex-col items-center pb-20 animate-vix-in">
              <div className="w-full flex justify-between items-center mb-6 px-2">
                <h1 className="logo-font text-3xl vix-text-gradient">VixReel</h1>
                <button onClick={() => setIsAccountMenuOpen(true)} className="p-3 bg-zinc-900/50 rounded-full border border-zinc-800 hover:border-zinc-700 transition-all">
                  <Users className="w-5 h-5 text-zinc-400" />
                </button>
              </div>
              <div className="w-full max-w-[470px] space-y-6">
                {posts.map(p => (
                  <Post key={p.id} post={p} currentUserId={currentUser.id} onDelete={(id) => setPosts(prev => prev.filter(x => x.id !== id))} onUpdate={fetchPosts} />
                ))}
              </div>
            </div>
          )}
          {currentView === 'EXPLORE' && <div className="animate-vix-in"><Explore currentUserId={currentUser.id} onSelectUser={(u) => setView('PROFILE', u)} /></div>}
          {currentView === 'PROFILE' && viewedUser && <div className="animate-vix-in"><Profile user={viewedUser} isOwnProfile={viewedUser.id === currentUser.id} onUpdateProfile={(u) => {
              if (viewedUser.id === currentUser.id) setCurrentUser(prev => prev ? {...prev, ...u} : null);
              setViewedUser(prev => prev ? {...prev, ...u} : null);
            }} onMessageUser={(u) => { setInitialChatUser(u); setCurrentView('MESSAGES'); }} onLogout={() => setIsAccountMenuOpen(true)} /></div>}
          
          {/* Create view renders independently of container animation to prevent clipping */}
          {currentView === 'CREATE' && <CreatePost userId={currentUser.id} onClose={() => setCurrentView('FEED')} onPostSuccess={fetchPosts} />}
          
          {currentView === 'SEARCH' && <div className="animate-vix-in"><Search onSelectUser={(u) => setView('PROFILE', u)} /></div>}
          {currentView === 'MESSAGES' && <div className="animate-vix-in"><Messages currentUser={currentUser} initialChatUser={initialChatUser} /></div>}
          {currentView === 'ADMIN' && currentUser.is_admin && <div className="animate-vix-in"><Admin /></div>}
          {currentView === 'NOTIFICATIONS' && <div className="animate-vix-in"><Notifications currentUser={currentUser} onOpenAdmin={() => setCurrentView('ADMIN')} isAdminUnlocked={currentUser.is_admin} /></div>}
        </div>
      </main>

      {/* Account Switching Modal */}
      {isAccountMenuOpen && (
        <div className="fixed inset-0 z-[1000] bg-black/95 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="w-full max-w-sm bg-zinc-950 border border-zinc-900 rounded-[2.5rem] overflow-hidden shadow-2xl animate-vix-in ring-1 ring-white/5">
            <div className="p-6 border-b border-zinc-900 flex justify-between items-center bg-zinc-900/20">
              <h3 className="font-black text-[10px] uppercase tracking-[0.3em] text-zinc-500">Switch Account</h3>
              <button onClick={() => setIsAccountMenuOpen(false)} className="p-2 text-zinc-700 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto max-h-[60vh] no-scrollbar">
              {savedAccounts.map(acc => (
                <div key={acc.id} className={`flex items-center justify-between p-4 rounded-2xl transition-all group border ${acc.id === currentUser.id ? 'bg-zinc-900/40 border-pink-500/20' : 'hover:bg-zinc-900/20 border-transparent'}`}>
                   <div className="flex items-center gap-4 flex-1 cursor-pointer" onClick={() => acc.id !== currentUser.id && switchAccount(acc)}>
                      <div className={`w-12 h-12 rounded-full p-0.5 ${acc.id === currentUser.id ? 'vix-gradient' : 'bg-zinc-800'}`}>
                        <img src={acc.avatar_url || `https://ui-avatars.com/api/?name=${acc.username}`} className="w-full h-full rounded-full object-cover bg-black" />
                      </div>
                      <div className="flex flex-col">
                        <p className="font-bold text-sm text-white">@{acc.username}</p>
                        {acc.id === currentUser.id && <span className="text-[9px] text-pink-500 font-black uppercase tracking-widest mt-0.5 animate-pulse">Active</span>}
                      </div>
                   </div>
                   {acc.id !== currentUser.id ? (
                     <button onClick={(e) => { e.stopPropagation(); removeAccount(acc.id); }} className="p-3 text-zinc-700 hover:text-red-500 transition-all">
                       <Trash2 className="w-4 h-4" />
                     </button>
                   ) : <CheckCircle className="w-4 h-4 text-pink-500" />}
                </div>
              ))}

              <button 
                onClick={() => { setIsAccountMenuOpen(false); setIsAddingAccount(true); }}
                className="w-full flex items-center gap-4 p-4 hover:bg-zinc-900 rounded-2xl transition-all group border border-dashed border-zinc-800 hover:border-pink-500/30"
              >
                <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-600 group-hover:text-pink-500 group-hover:bg-pink-500/5 transition-all">
                  <Plus className="w-6 h-6" />
                </div>
                <span className="font-bold text-sm text-zinc-500 group-hover:text-white">Add Account</span>
              </button>
            </div>
            
            <div className="p-6 border-t border-zinc-900 bg-zinc-900/10">
              <button onClick={handleLogout} className="w-full py-4 text-center text-red-500 font-black text-[11px] uppercase tracking-widest hover:text-red-400 transition-colors">Relinquish Primary Session</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
