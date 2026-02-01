
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { UserProfile } from '../types';
import { Sparkles, Camera, Play, Users, ShieldCheck, ChevronRight, Calendar, FileText, CheckCircle } from 'lucide-react';

interface AuthProps {
  onAuthSuccess: (user: UserProfile) => void;
}

const Auth: React.FC<AuthProps> = ({ onAuthSuccess }) => {
  const [hasStarted, setHasStarted] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [signupStep, setSignupStep] = useState(1); // 1: Credentials, 2: DOB, 3: Policies

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  
  const [dobDay, setDobDay] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobYear, setDobYear] = useState('');
  
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
        // Step-based logic handled in separate components but final trigger here
        if (signupStep < 3) {
           setSignupStep(prev => prev + 1);
           setLoading(false);
           return;
        }

        const dob = `${dobYear}-${dobMonth.padStart(2, '0')}-${dobDay.padStart(2, '0')}`;
        const cleanUsername = username.toLowerCase().trim();
        
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: cleanUsername,
              full_name: fullName,
              date_of_birth: dob,
            }
          }
        });
        
        if (signUpError) throw signUpError;
        if (data.user) {
          alert(`Welcome to VixReel! Account created for @${cleanUsername}. You can now log in.`);
          setIsLogin(true);
          setSignupStep(1);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const months = [
    { v: '01', l: 'January' }, { v: '02', l: 'February' }, { v: '03', l: 'March' },
    { v: '04', l: 'April' }, { v: '05', l: 'May' }, { v: '06', l: 'June' },
    { v: '07', l: 'July' }, { v: '08', l: 'August' }, { v: '09', l: 'September' },
    { v: '10', l: 'October' }, { v: '11', l: 'November' }, { v: '12', l: 'December' }
  ];
  const years = Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i);

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
            <button onClick={() => { setHasStarted(true); setIsLogin(true); }} className="w-full md:w-auto px-12 py-5 bg-white text-black font-black uppercase tracking-[0.2em] rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-xl">Sign In</button>
            <button onClick={() => { setHasStarted(true); setIsLogin(false); setSignupStep(1); }} className="w-full md:w-auto px-12 py-5 border border-white/20 text-white font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-white/5 hover:border-white transition-all group flex items-center justify-center gap-3">Start Journey <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-[420px] space-y-4">
        <div className="bg-zinc-900/40 backdrop-blur-2xl border border-stone-800/60 p-10 flex flex-col items-center rounded-[2.5rem] shadow-2xl">
          <h2 className="logo-font text-6xl mb-6 font-bold vix-text-gradient text-center w-full" onClick={() => setHasStarted(false)}>VixReel</h2>
          
          <div className="text-center mb-10 w-full">
            <h3 className="text-2xl font-bold tracking-tight">
              {isLogin ? 'Welcome Back' : signupStep === 1 ? 'Create Account' : signupStep === 2 ? 'Date of Birth' : 'Legal & Privacy'}
            </h3>
            <p className="text-sm text-stone-500 mt-2 font-medium">
              {isLogin ? 'Sign in to your premium feed' : 'Join the elite community of creators'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="w-full space-y-4">
            {isLogin ? (
              <>
                <input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-black/40 border border-zinc-800 text-sm px-5 py-4 rounded-2xl focus:border-pink-500/60 outline-none transition-all placeholder:text-stone-600" required />
                <input type="password" placeholder="Secure Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-black/40 border border-zinc-800 text-sm px-5 py-4 rounded-2xl focus:border-pink-500/60 outline-none transition-all placeholder:text-stone-600" required />
              </>
            ) : signupStep === 1 ? (
              <>
                <input type="text" placeholder="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full bg-black/40 border border-zinc-800 text-sm px-5 py-4 rounded-2xl focus:border-pink-500/60 outline-none transition-all placeholder:text-stone-600" required />
                <input type="text" placeholder="@handle" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full bg-black/40 border border-zinc-800 text-sm px-5 py-4 rounded-2xl focus:border-pink-500/60 outline-none transition-all placeholder:text-stone-600" required minLength={3} />
                <input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-black/40 border border-zinc-800 text-sm px-5 py-4 rounded-2xl focus:border-pink-500/60 outline-none transition-all placeholder:text-stone-600" required />
                <input type="password" placeholder="Secure Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-black/40 border border-zinc-800 text-sm px-5 py-4 rounded-2xl focus:border-pink-500/60 outline-none transition-all placeholder:text-stone-600" required />
              </>
            ) : signupStep === 2 ? (
              <div className="flex gap-2">
                <select value={dobDay} onChange={e => setDobDay(e.target.value)} className="flex-1 bg-black/40 border border-zinc-800 text-sm px-4 py-4 rounded-2xl outline-none focus:border-pink-500" required>
                  <option value="">Day</option>
                  {days.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <select value={dobMonth} onChange={e => setDobMonth(e.target.value)} className="flex-1 bg-black/40 border border-zinc-800 text-sm px-4 py-4 rounded-2xl outline-none focus:border-pink-500" required>
                  <option value="">Month</option>
                  {months.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
                </select>
                <select value={dobYear} onChange={e => setDobYear(e.target.value)} className="flex-1 bg-black/40 border border-zinc-800 text-sm px-4 py-4 rounded-2xl outline-none focus:border-pink-500" required>
                  <option value="">Year</option>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            ) : (
              <div className="space-y-4 max-h-60 overflow-y-auto no-scrollbar p-2 bg-black/20 rounded-2xl text-[10px] text-zinc-400 leading-relaxed border border-zinc-800">
                <div className="font-bold text-white mb-2 uppercase tracking-widest flex items-center gap-2"><FileText className="w-3 h-3" /> Privacy Policy</div>
                <p>We respect your visual data. VixReel uses end-to-end encryption for private messages and ensures your high-fidelity reels are stored on distributed edge networks. We do not sell your biometric data or interaction patterns.</p>
                <div className="font-bold text-white mb-2 uppercase tracking-widest flex items-center gap-2 mt-4"><ShieldCheck className="w-3 h-3" /> Community Rules</div>
                <ul className="list-disc pl-4 space-y-1">
                  <li>No explicit adult content or excessive gore.</li>
                  <li>No harassment or cyber-bullying.</li>
                  <li>Always credit other creators if using their assets.</li>
                  <li>Originality is the cornerstone of VixReel.</li>
                </ul>
                <div className="font-bold text-white mb-2 uppercase tracking-widest mt-4">Violation Policy</div>
                <p>Violations will lead to account suspension. Repeat offenders will be blacklisted from the VixReel edge network forever.</p>
              </div>
            )}
            
            <button type="submit" disabled={loading} className="w-full vix-gradient hover:opacity-95 active:scale-[0.98] transition-all text-white font-bold py-4 rounded-2xl text-sm mt-8 shadow-2xl disabled:opacity-50">
              {loading ? 'PROCESSING...' : isLogin ? 'ENTER VIXREEL' : signupStep === 3 ? 'ACCEPT & CREATE' : 'CONTINUE'}
            </button>
            {!isLogin && signupStep > 1 && (
              <button type="button" onClick={() => setSignupStep(prev => prev - 1)} className="w-full text-zinc-600 text-[10px] font-bold uppercase tracking-widest mt-2">Go Back</button>
            )}
          </form>

          {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] mt-6 p-3.5 rounded-xl w-full text-center font-medium">{error}</div>}
        </div>

        <div className="bg-zinc-900/40 backdrop-blur-2xl border border-stone-800/60 p-6 text-center rounded-[2rem]">
          <p className="text-sm text-stone-400">
            {isLogin ? "New to the platform?" : "Already part of the community?"}{' '}
            <button onClick={() => { setIsLogin(!isLogin); setSignupStep(1); setError(null); }} className="vix-text-gradient font-bold hover:underline ml-1">
              {isLogin ? 'Join VixReel' : 'Log In'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
