
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { UserProfile } from '../types';
import { Sparkles, Camera, Play, Users, ShieldCheck, ChevronRight } from 'lucide-react';

interface AuthProps {
  onAuthSuccess: (user: UserProfile) => void;
}

const Auth: React.FC<AuthProps> = ({ onAuthSuccess }) => {
  const [hasStarted, setHasStarted] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { data, error: loginError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (loginError) throw loginError;
        if (data.user) {
          onAuthSuccess({
            id: data.user.id,
            email: data.user.email || '',
            username: data.user.user_metadata.username || email.split('@')[0],
          });
        }
      } else {
        const cleanUsername = username.toLowerCase().trim();
        if (!cleanUsername || cleanUsername.length < 3) {
          throw new Error("Username must be at least 3 characters.");
        }

        const { data: existingUser, error: checkError } = await supabase
          .from('profiles')
          .select('username')
          .eq('username', cleanUsername)
          .maybeSingle();

        if (checkError) throw new Error("Connection error during username verification.");
        if (existingUser) {
          throw new Error("This username is already taken. Please choose another.");
        }

        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: cleanUsername,
              full_name: fullName,
            }
          }
        });
        
        if (signUpError) throw signUpError;
        if (data.user) {
          alert(`Welcome to VixReel! Account created for @${cleanUsername}. Please check your email for a verification link, then log in.`);
          setIsLogin(true);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!hasStarted) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-20 grayscale scale-110"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent"></div>
        
        <div className="relative z-10 text-center space-y-12 max-w-2xl animate-in fade-in zoom-in duration-1000">
          <div className="space-y-4">
             <div className="w-24 h-24 mx-auto rounded-[2.5rem] vix-gradient flex items-center justify-center mb-10 shadow-2xl shadow-pink-500/20">
               <span className="text-white font-black text-5xl logo-font">V</span>
             </div>
             <h1 className="logo-font text-8xl font-bold vix-text-gradient tracking-tight">VixReel</h1>
             <p className="text-2xl text-stone-400 font-light leading-relaxed">
               Welcome to the next generation of <span className="text-white font-semibold">visual storytelling</span>.
             </p>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-center gap-6">
            <button 
              onClick={() => { setHasStarted(true); setIsLogin(true); }}
              className="w-full md:w-auto px-12 py-5 bg-white text-black font-black uppercase tracking-[0.2em] rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-xl"
            >
              Sign In
            </button>
            <button 
              onClick={() => { setHasStarted(true); setIsLogin(false); }}
              className="w-full md:w-auto px-12 py-5 border border-white/20 text-white font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-white/5 hover:border-white transition-all group flex items-center justify-center gap-3"
            >
              Start Journey <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          <div className="pt-20 grid grid-cols-3 gap-8 opacity-40">
            <div className="flex flex-col items-center gap-2">
              <Play className="w-6 h-6" />
              <span className="text-[10px] uppercase font-bold tracking-widest">Reels</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Users className="w-6 h-6" />
              <span className="text-[10px] uppercase font-bold tracking-widest">Community</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Sparkles className="w-6 h-6" />
              <span className="text-[10px] uppercase font-bold tracking-widest">AI Tools</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col lg:flex-row items-center justify-center p-4 lg:p-0">
      <div className="hidden lg:flex flex-col justify-center items-start max-w-xl p-16 space-y-10 animate-in fade-in slide-in-from-left duration-1000">
        <h1 className="logo-font text-8xl font-bold vix-text-gradient tracking-tight cursor-pointer" onClick={() => setHasStarted(false)}>VixReel</h1>
        <p className="text-2xl text-stone-400 font-light leading-relaxed max-w-md">
          Join the elite community of <span className="text-white font-medium">content creators</span>. 
          Cinematic reels, premium aesthetics.
        </p>
        
        <div className="grid grid-cols-1 gap-8 mt-4">
          <div className="flex items-center gap-5 text-stone-300 group">
            <div className="p-4 bg-zinc-900 rounded-2xl border border-zinc-800 group-hover:border-pink-500/50 transition-colors shadow-lg">
              <Play className="w-6 h-6 text-pink-500" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Cinematic Reels</h3>
              <p className="text-sm text-stone-500">Short-form video perfected for your vision.</p>
            </div>
          </div>
          <div className="flex items-center gap-5 text-stone-300 group">
            <div className="p-4 bg-zinc-900 rounded-2xl border border-zinc-800 group-hover:border-purple-500/50 transition-colors shadow-lg">
              <Sparkles className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <h3 className="font-bold text-lg">AI Captions</h3>
              <p className="text-sm text-stone-500">Gemini-powered creative metadata.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full max-w-[420px] lg:ml-8 space-y-4 animate-in fade-in slide-in-from-right duration-1000">
        <div className="bg-zinc-900/40 backdrop-blur-2xl border border-stone-800/60 p-10 flex flex-col items-center rounded-[2.5rem] shadow-2xl">
          <h2 className="lg:hidden logo-font text-6xl mb-10 font-bold vix-text-gradient text-center w-full" onClick={() => setHasStarted(false)}>VixReel</h2>
          
          <div className="text-center mb-10">
            <h3 className="text-2xl font-bold tracking-tight">{isLogin ? 'Welcome Back' : 'Create Account'}</h3>
            <p className="text-sm text-stone-500 mt-2 font-medium">
              {isLogin ? 'Sign in to your premium feed' : 'Join the elite community of creators'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="w-full space-y-4">
            {!isLogin && (
              <>
                <input
                  type="text"
                  placeholder="Full Name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-black/40 border border-zinc-800 text-sm px-5 py-4 rounded-2xl focus:border-pink-500/60 outline-none transition-all placeholder:text-stone-600"
                  required
                />
                <input
                  type="text"
                  placeholder="@handle"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
                  className="w-full bg-black/40 border border-zinc-800 text-sm px-5 py-4 rounded-2xl focus:border-pink-500/60 outline-none transition-all placeholder:text-stone-600"
                  required
                  minLength={3}
                />
              </>
            )}
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black/40 border border-zinc-800 text-sm px-5 py-4 rounded-2xl focus:border-pink-500/60 outline-none transition-all placeholder:text-stone-600"
              required
            />
            <input
              type="password"
              placeholder="Secure Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black/40 border border-zinc-800 text-sm px-5 py-4 rounded-2xl focus:border-pink-500/60 outline-none transition-all placeholder:text-stone-600"
              required
            />
            
            <button
              type="submit"
              disabled={loading}
              className="w-full vix-gradient hover:opacity-95 active:scale-[0.98] transition-all text-white font-bold py-4 rounded-2xl text-sm mt-8 shadow-2xl disabled:opacity-50"
            >
              {loading ? 'PREPARING FEED...' : (isLogin ? 'ENTER VIXREEL' : 'START JOURNEY')}
            </button>
          </form>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] mt-6 p-3.5 rounded-xl w-full text-center font-medium animate-in slide-in-from-top-2 duration-300">
              {error}
            </div>
          )}
        </div>

        <div className="bg-zinc-900/40 backdrop-blur-2xl border border-stone-800/60 p-6 text-center rounded-[2rem]">
          <p className="text-sm text-stone-400">
            {isLogin ? "New to the platform?" : "Already part of the community?"}{' '}
            <button
              onClick={() => { setIsLogin(!isLogin); setError(null); }}
              className="vix-text-gradient font-bold hover:underline ml-1"
            >
              {isLogin ? 'Join VixReel' : 'Log In'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
