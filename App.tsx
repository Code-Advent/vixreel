
import React, { useState, useEffect } from 'react';
import { Home as HomeIcon, Search as SearchIcon, PlaySquare, PlusSquare, Compass, Users, Heart } from 'lucide-react';
import { supabase } from './lib/supabase';
import { UserProfile, Post as PostType, ViewType } from './types';
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
        await fetchProfile(session.user.id);
        await fetchPosts();
      }
    } catch (err) {
      console.error("Initialization error:", err);
    } finally {
      setTimeout(() => setLoading(false), 800);
    }
  };

  const handleUnlockAdmin = () => {
    const pass = window.prompt("VixReel Security: Enter Admin Access Password:");
    if (pass === 'nulll') {
      setIsAdminUnlocked(true);
      localStorage.setItem('vixreel_admin_unlocked', 'true');
      alert("Access Granted. Secret features unlocked.");
    } else if (pass !== null) {
      alert("Incorrect password.");
    }
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

  const fetchExplorePosts = async () => {
    const { data } = await supabase
      .from('posts')
      .select('*, user:profiles(*)')
      .limit(24)
      .order('created_at', { ascending: false });
    if (data) setExplorePosts(data as any);
  };

  useEffect(() => {
    if (currentView === 'EXPLORE') {
      fetchExplorePosts();
    }
  }, [currentView]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('vixreel_admin_unlocked');
    setCurrentUser(null);
    setIsAdminUnlocked(false);
    window.location.reload();
  };

  const updateProfileState = (updates: Partial<UserProfile>) => {
    if (currentUser) {
      const updatedUser = { ...currentUser, ...updates };
      setCurrentUser(updatedUser);
    }
    if (viewedUser && viewedUser.id === currentUser?.id) setViewedUser({ ...viewedUser, ...updates });
  };

  const handleSelectUser = (user: UserProfile) => {
    setViewedUser(user);
    setCurrentView('PROFILE');
  };

  const handleMessageUser = (user: UserProfile) => {
    setInitialChatUser(user);
    setCurrentView('MESSAGES');
  };

  const handleSidebarViewChange = (view: ViewType) => {
    if (view === 'PROFILE') setViewedUser(currentUser);
    if (view !== 'MESSAGES') setInitialChatUser(null);
    
    if (view === 'ADMIN' && !isAdminUnlocked) {
      handleUnlockAdmin();
      return;
    }
    
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
        <div className="mt-8 flex gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-bounce [animation-delay:-0.3s]"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce [animation-delay:-0.15s]"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce"></div>
        </div>
      </div>
    </div>
  );

  if (!currentUser) return <Auth onAuthSuccess={() => init()} />;

  return (
    <div className="bg-black min-h-screen text-white flex">
      <Sidebar 
        currentView={currentView} 
        setView={handleSidebarViewChange} 
        onLogout={handleLogout} 
        currentUser={currentUser} 
        isAdminUnlocked={isAdminUnlocked}
      />

      <main className="flex-1 lg:ml-64 pb-24 lg:pb-0">
        <div className="container mx-auto max-w-[935px] pt-4 px-4">
          {currentView === 'FEED' && (
            <div className="flex flex-col items-center">
              <Stories currentUser={currentUser} />
              <div className="w-full max-w-[470px] mt-8">
                {posts.length > 0 ? (
                  posts.map(p => <Post key={p.id} post={p} currentUserId={currentUser.id} onDelete={() => fetchPosts()} />)
                ) : (
                  <div className="text-center py-32 space-y-6">
                    <div className="w-24 h-24 rounded-full bg-zinc-900 flex items-center justify-center mx-auto shadow-2xl">
                      <Users className="w-10 h-10 text-zinc-700" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-black tracking-tight text-white">VixReel Feed</h2>
                      <p className="text-zinc-500 mt-2 font-medium">Your creative journey begins here. Share your first moment!</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {currentView === 'SEARCH' && <Search onSelectUser={handleSelectUser} />}

          {currentView === 'PROFILE' && viewedUser && (
            <Profile 
              user={viewedUser} 
              isOwnProfile={viewedUser.id === currentUser.id} 
              onUpdateProfile={updateProfileState} 
              onMessageUser={handleMessageUser}
              onViewProfile={handleSelectUser}
            />
          )}

          {currentView === 'CREATE' && (
            <CreatePost userId={currentUser.id} onClose={() => setCurrentView('FEED')} onPostSuccess={fetchPosts} />
          )}

          {currentView === 'MESSAGES' && <Messages currentUser={currentUser} initialChatUser={initialChatUser} />}
          
          {currentView === 'NOTIFICATIONS' && (
            <Notifications 
              currentUser={currentUser} 
              onOpenAdmin={() => handleSidebarViewChange('ADMIN')} 
              onUnlockAdmin={handleUnlockAdmin}
              isAdminUnlocked={isAdminUnlocked}
            />
          )}

          {currentView === 'ADMIN' && isAdminUnlocked && <Admin />}

          {currentView === 'EXPLORE' && (
            <div className="py-12">
              <div className="flex items-center gap-4 mb-12 px-4 md:px-0">
                 <div className="p-3 bg-zinc-900 rounded-2xl"><Compass className="w-8 h-8 vix-text-gradient" /></div>
                 <div>
                    <h2 className="text-4xl font-black tracking-tighter">DISCOVER</h2>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600">Trending content globally</p>
                 </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-1 md:gap-6">
                {explorePosts.map(post => (
                  <div 
                    key={post.id} 
                    className="aspect-square bg-zinc-900 rounded-2xl overflow-hidden cursor-pointer hover:scale-[0.98] transition-all duration-300 group relative border border-zinc-800 shadow-xl"
                    onClick={() => handleSelectUser(post.user)}
                  >
                    {post.media_type === 'video' ? (
                      <video src={post.media_url} className="w-full h-full object-cover" />
                    ) : (
                      <img src={post.media_url} className="w-full h-full object-cover" />
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                       <PlaySquare className="w-8 h-8 text-white drop-shadow-2xl" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentView === 'REELS' && (
             <div className="flex flex-col items-center justify-center h-[75vh] text-center px-10">
                <div className="relative mb-10">
                  <div className="absolute inset-0 vix-gradient rounded-full blur-[100px] opacity-10 animate-pulse"></div>
                  <PlaySquare className="w-28 h-28 relative vix-text-gradient" />
                </div>
                <h3 className="text-3xl font-black tracking-tight mb-4 uppercase italic">VixReel Reels</h3>
                <p className="text-zinc-500 max-w-sm font-medium leading-relaxed">Experience short-form visual perfection. Immersive reels launching soon.</p>
             </div>
          )}
        </div>
      </main>

      {/* Mobile Nav Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 h-20 bg-black/80 backdrop-blur-2xl border-t border-zinc-900 flex justify-around items-center px-6 z-50">
        <button onClick={() => setCurrentView('FEED')} className="transition-transform active:scale-90"><HomeIcon className={currentView === 'FEED' ? 'text-pink-500' : 'text-zinc-600'} /></button>
        <button onClick={() => setCurrentView('EXPLORE')} className="transition-transform active:scale-90"><SearchIcon className={currentView === 'EXPLORE' ? 'text-pink-500' : 'text-zinc-600'} /></button>
        <button onClick={() => setCurrentView('CREATE')} className="vix-gradient p-3 rounded-2xl shadow-2xl shadow-pink-500/30 active:scale-90"><PlusSquare className="text-white w-6 h-6" /></button>
        <button onClick={() => setCurrentView('NOTIFICATIONS')} className="transition-transform active:scale-90"><Heart className={currentView === 'NOTIFICATIONS' ? 'text-pink-500' : 'text-zinc-600'} /></button>
        <button onClick={() => handleSidebarViewChange('PROFILE')} className="transition-transform active:scale-90">
          <div className="w-9 h-9 rounded-full border border-white/10 overflow-hidden shadow-2xl">
            <img src={currentUser.avatar_url || `https://ui-avatars.com/api/?name=${currentUser.username}`} className="w-full h-full object-cover" />
          </div>
        </button>
      </div>
    </div>
  );
};

export default App;
