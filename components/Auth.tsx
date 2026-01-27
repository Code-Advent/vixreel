
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { UserProfile } from '../types';
import { Sparkles, Camera, Play, Users, ShieldCheck } from 'lucide-react';

interface AuthProps {
  onAuthSuccess: (user: UserProfile) => void;
}

const Auth: React.FC<AuthProps> = ({ onAuthSuccess }) => {
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
          // Profile is handled by the database trigger and fetched by App init
          onAuthSuccess({
            id: data.user.id,
            email: data.user.email || '',
            username: data.user.user_metadata.username || email.split('@')[0],
          });
        }
      } else {
        if (!username || username.length < 3) {
          throw new Error("Username must be at least 3 characters.");
        }

        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: username.toLowerCase().trim(),
              full_name: fullName,
            }
          }
        });
        if (signUpError) throw signUpError;
        if (data.user) {
          alert(`Welcome to the family! Account created for @${username}. Please check your email for a verification link, then log in to start sharing.`);
          setIsLogin(true);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col lg:flex-row items-center justify-center p-4 lg:p-0">
      {/* Left Side: Cinematic Branding & Features (Desktop Only) */}
      <div className="hidden lg:flex flex-col justify-center items-start max-w-xl p-16 space-y-10 animate-in fade-in slide-in-from-left duration-1000">
        <h1 className="logo-font text-8xl font-bold vix-text-gradient tracking-tight">VixReel</h1>
        <p className="text-2xl text-stone-400 font-light leading-relaxed max-w-md">
          The next generation of <span className="text-white font-medium">visual storytelling</span>. 
          Share your world in cinematic reels and high-fidelity photos.
        </p>
        
        <div className="grid grid-cols-1 gap-8 mt-4">
          <div className="flex items-center gap-5 text-stone-300 group">
            <div className="p-4 bg-zinc-900 rounded-2xl border border-zinc-800 group-hover:border-pink-500/50 transition-colors shadow-lg shadow-pink-500/5">
              <Play className="w-6 h-6 text-pink-500" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Cinematic Reels</h3>
              <p className="text-sm text-stone-500">Short-form video perfected for your creative vision.</p>
            </div>
          </div>
          <div className="flex items-center gap-5 text-stone-300 group">
            <div className="p-4 bg-zinc-900 rounded-2xl border border-zinc-800 group-hover:border-purple-500/50 transition-colors shadow-lg shadow-purple-500/5">
              <Sparkles className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <h3 className="font-bold text-lg">AI-Powered Magic</h3>
              <p className="text-sm text-stone-500">Let Gemini craft the perfect trend-setting captions for you.</p>
            </div>
          </div>
          <div className="flex items-center gap-5 text-stone-300 group">
            <div className="p-4 bg-zinc-900 rounded-2xl border border-zinc-800 group-hover:border-blue-500/50 transition-colors shadow-lg shadow-blue-500/5">
              <ShieldCheck className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Verified Authenticity</h3>
              <p className="text-sm text-stone-500">A community built on verified creators and real connections.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side: Elegant Auth Form */}
      <div className="w-full max-w-[420px] lg:ml-8 space-y-4 animate-in fade-in slide-in-from-right duration-1000">
        <div className="bg-zinc-900/40 backdrop-blur-2xl border border-stone-800/60 p-10 flex flex-col items-center rounded-[2.5rem] shadow-2xl shadow-purple-900/10">
          <h2 className="lg:hidden logo-font text-6xl mb-10 font-bold vix-text-gradient text-center w-full">VixReel</h2>
          
          <div className="text-center mb-10">
            <h3 className="text-2xl font-bold tracking-tight">{isLogin ? 'Welcome Back' : 'Create Account'}</h3>
            <p className="text-sm text-stone-500 mt-2 font-medium">
              {isLogin ? 'Sign in to your premium feed' : 'Join the elite community of creators'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="w-full space-y-4">
            {!isLogin && (
              <>
                <div className="space-y-1.5">
                  <input
                    type="text"
                    placeholder="Full Name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-black/40 border border-zinc-800 text-sm px-5 py-4 rounded-2xl focus:border-purple-500/60 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all placeholder:text-stone-600"
                    required
                  />
                </div>
                <div className="relative space-y-1.5">
                  <input
                    type="text"
                    placeholder="Choose Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
                    className="w-full bg-black/40 border border-zinc-800 text-sm px-5 py-4 rounded-2xl focus:border-purple-500/60 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all placeholder:text-stone-600"
                    required
                    minLength={3}
                  />
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
                    <span className="text-[9px] text-stone-600 font-bold uppercase tracking-wider">@handle</span>
                  </div>
                </div>
              </>
            )}
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black/40 border border-zinc-800 text-sm px-5 py-4 rounded-2xl focus:border-purple-500/60 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all placeholder:text-stone-600"
              required
            />
            <input
              type="password"
              placeholder="Secure Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black/40 border border-zinc-800 text-sm px-5 py-4 rounded-2xl focus:border-purple-500/60 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all placeholder:text-stone-600"
              required
            />
            
            <button
              type="submit"
              disabled={loading}
              className="w-full vix-gradient hover:opacity-95 active:scale-[0.98] transition-all text-white font-bold py-4.5 rounded-2xl text-sm mt-8 shadow-2xl shadow-pink-500/25 disabled:opacity-50 disabled:scale-100 py-4 flex items-center justify-center"
            >
              {loading ? (
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  <span className="tracking-wide">PREPARING FEED...</span>
                </div>
              ) : (
                <span className="tracking-wider">{isLogin ? 'ENTER VIXREEL' : 'START JOURNEY'}</span>
              )}
            </button>
          </form>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] mt-6 p-3.5 rounded-xl w-full text-center font-medium animate-in slide-in-from-top-2 duration-300">
              {error}
            </div>
          )}

          {isLogin && (
            <button className="text-stone-500 font-bold text-[10px] mt-8 tracking-widest uppercase hover:text-stone-300 transition-colors">
              Request access recovery
            </button>
          )}
        </div>

        <div className="bg-zinc-900/40 backdrop-blur-2xl border border-stone-800/60 p-6 text-center rounded-[2rem]">
          <p className="text-sm text-stone-400">
            {isLogin ? "New to the platform?" : "Already part of the elite?"}{' '}
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError(null);
              }}
              className="vix-text-gradient font-bold hover:underline ml-1"
            >
              {isLogin ? 'Join VixReel' : 'Log In'}
            </button>
          </p>
        </div>

        <div className="text-center pt-2">
          <p className="text-[9px] text-zinc-700 uppercase tracking-[0.2em] font-black mb-5">Native Experience</p>
          <div className="flex justify-center gap-4">
            <div className="flex-1 py-3 bg-zinc-950/80 rounded-2xl flex items-center justify-center text-[10px] text-zinc-500 font-black tracking-widest border border-zinc-900 hover:border-zinc-800 hover:text-zinc-300 cursor-pointer transition-all shadow-xl">
              APP STORE
            </div>
            <div className="flex-1 py-3 bg-zinc-950/80 rounded-2xl flex items-center justify-center text-[10px] text-zinc-500 font-black tracking-widest border border-zinc-900 hover:border-zinc-800 hover:text-zinc-300 cursor-pointer transition-all shadow-xl">
              GOOGLE PLAY
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
