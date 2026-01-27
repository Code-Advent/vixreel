
import React, { useState, useEffect } from 'react';
import { Home as HomeIcon, Search as SearchIcon, PlaySquare, PlusSquare, Compass, Users, MessageCircle, Heart } from 'lucide-react';
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

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const profile = await fetchProfile(session.user.id);
      if (profile) {
          await fetchPosts();
          const stored = JSON.parse(localStorage.getItem('vixreel_accounts') || '[]');
          const userObj = { id: profile.id, email: session.user.email, username: profile.username, avatar_url: profile.avatar_url };
          const updated = [...stored.filter((s: any) => s.user.id !== profile.id), { session, user: userObj }];
          localStorage.setItem('vixreel_accounts', JSON.stringify(updated));
      }
    }
    setLoading(false);
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
    setCurrentUser(null);
  };

  const updateProfileState = (updates: Partial<UserProfile>) => {
    if (currentUser) {
      const updatedUser = { ...currentUser, ...updates };
      setCurrentUser(updatedUser);
      const stored = JSON.parse(localStorage.getItem('vixreel_accounts') || '[]');
      const updated = stored.map((s: any) => s.user.id === updatedUser.id ? { ...s, user: { ...s.user, ...updates } } : s);
      localStorage.setItem('vixreel_accounts', JSON.stringify(updated));
    }
    if (viewedUser && viewedUser.id === currentUser?.id) setViewedUser({ ...viewedUser, ...updates });
  };

  const handleSelectUser = (user: UserProfile) => {
    setViewedUser(user);
    setCurrentView('PROFILE');
  };

  const handleSidebarViewChange = (view: ViewType) => {
    if (view === 'PROFILE') setViewedUser(currentUser);
    setCurrentView(view);
  };

  if (loading) return (
    <div className="h-screen w-screen bg-black flex items-center justify-center">
      <div className="w-12 h-12 rounded-full border-4 border-zinc-800 border-t-[#ff0080] animate-spin"></div>
    </div>
  );

  if (!currentUser) return <Auth onAuthSuccess={() => init()} />;

  return (
    <div className="bg-black min-h-screen text-white flex">
      <Sidebar currentView={currentView} setView={handleSidebarViewChange} onLogout={handleLogout} />

      <main className="flex-1 lg:ml-64 pb-20 lg:pb-0">
        <div className="container mx-auto max-w-[935px] pt-4 px-4">
          {currentView === 'FEED' && (
            <div className="flex flex-col items-center">
              <Stories currentUser={currentUser} />
              <div className="w-full max-w-[470px] mt-6">
                {posts.length > 0 ? (
                  posts.map(p => <Post key={p.id} post={p} currentUserId={currentUser.id} onDelete={() => fetchPosts()} />)
                ) : (
                  <div className="text-center py-20">
                    <Users className="w-20 h-20 text-zinc-800 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold">Welcome to VixReel</h2>
                    <p className="text-stone-500 mt-2">No posts yet. Start sharing your first Reel!</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {currentView === 'SEARCH' && <Search onSelectUser={handleSelectUser} />}

          {currentView === 'PROFILE' && viewedUser && (
            <Profile user={viewedUser} isOwnProfile={viewedUser.id === currentUser.id} onUpdateProfile={updateProfileState} />
          )}

          {currentView === 'CREATE' && (
            <CreatePost userId={currentUser.id} onClose={() => setCurrentView('FEED')} onPostSuccess={fetchPosts} />
          )}

          {currentView === 'MESSAGES' && <Messages currentUser={currentUser} />}
          
          {currentView === 'NOTIFICATIONS' && <Notifications currentUser={currentUser} onOpenAdmin={() => setCurrentView('ADMIN')} />}

          {currentView === 'ADMIN' && <Admin />}

          {(currentView === 'EXPLORE' || currentView === 'REELS') && (
            <div className="flex flex-col items-center justify-center h-[80vh] text-stone-500">
               <Compass className="w-16 h-16 mb-4 vix-text-gradient animate-pulse" />
               <h3 className="text-2xl font-bold text-white">Feature in Beta</h3>
               <p>We are building the {currentView.toLowerCase()} experience.</p>
            </div>
          )}
        </div>
      </main>

      <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-black border-t border-zinc-800 flex justify-around items-center px-4 z-50">
        <button onClick={() => setCurrentView('FEED')}><HomeIcon className={currentView === 'FEED' ? 'vix-text-gradient' : 'text-stone-400'} /></button>
        <button onClick={() => setCurrentView('SEARCH')}><SearchIcon className={currentView === 'SEARCH' ? 'vix-text-gradient' : 'text-stone-400'} /></button>
        <button onClick={() => setCurrentView('CREATE')}><PlusSquare className={currentView === 'CREATE' ? 'vix-text-gradient' : 'text-stone-400'} /></button>
        <button onClick={() => setCurrentView('NOTIFICATIONS')}><Heart className={currentView === 'NOTIFICATIONS' ? 'vix-text-gradient' : 'text-stone-400'} /></button>
        <button onClick={() => { setViewedUser(currentUser); setCurrentView('PROFILE'); }}>
          <div className={`w-8 h-8 rounded-full p-0.5 ${currentView === 'PROFILE' ? 'vix-gradient' : 'bg-stone-800'}`}>
            <img src={currentUser.avatar_url || `https://ui-avatars.com/api/?name=${currentUser.username}`} className="w-full h-full rounded-full object-cover" />
          </div>
        </button>
      </div>
    </div>
  );
};

export default App;
