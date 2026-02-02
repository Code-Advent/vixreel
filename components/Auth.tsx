
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { UserProfile } from '../types';
import { ShieldCheck, ChevronRight, FileText, Loader2, Calendar, CheckCircle, AlertCircle, Lock } from 'lucide-react';

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
          email: email.trim(),
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
        if (signupStep === 1) {
           if (!username.trim() || !email.trim() || !password || !fullName.trim()) {
             throw new Error("Missing system credentials.");
           }
           setSignupStep(2);
           setLoading(false);
           return;
        }
        
        if (signupStep === 2) {
           if (!dobDay || !dobMonth || !dobYear) {
             throw new Error("Identity age verification required.");
           }
           setSignupStep(3);
           setLoading(false);
           return;
        }

        // Step 3: Accept & Create
        const dobFormatted = `${dobYear}-${dobMonth.padStart(2, '0')}-${dobDay.padStart(2, '0')}`;
        const cleanUsername = username.toLowerCase().trim().replace(/[^a-z0-9_]/g, '');
        
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              username: cleanUsername,
              full_name: fullName.trim(),
              date_of_birth: dobFormatted,
            }
          }
        });
        
        if (signUpError) {
          if (signUpError.message.includes("Database error")) {
             throw new Error("Connection failed. Try a different username/handle.");
          }
          throw signUpError;
        }
        
        if (data.user) {
          // If a session exists (auto-confirm is on), immediately enter the app
          if (data.session) {
            onAuthSuccess({
              id: data.user.id,
              email: data.user.email || '',
              username: cleanUsername,
              full_name: fullName.trim(),
            });
          } else {
            // If confirmation is required, we still proceed as if success but tell the user to check email
            alert(`Account created! @${cleanUsername} is ready. Redirecting to sign in interface...`);
            setIsLogin(true);
            setSignupStep(1);
          }
        }
      }
    } catch (err: any) {
      setError(err.message || "Network protocol error.");
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
  const years = Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - 13 - i);

  if (!hasStarted) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-radial-gradient from-pink-500/10 to-transparent opacity-40 blur-[100px]" />
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
      <div className="w-full max-w-[420px] space-y-4 animate-vix-in">
        <div className="bg-zinc-900/40 backdrop-blur-2xl border border-stone-800/60 p-10 flex flex-col items-center rounded-[2.5rem] shadow-2xl relative overflow-hidden">
          <h2 className="logo-font text-6xl mb-6 font-bold vix-text-gradient text-center w-full cursor-pointer" onClick={() => setHasStarted(false)}>VixReel</h2>
          
          <div className="text-center mb-10 w-full">
            <h3 className="text-2xl font-bold tracking-tight text-white">
              {isLogin ? 'Welcome Back' : signupStep === 1 ? 'Create Account' : signupStep === 2 ? 'Date of Birth' : 'Protocol Access'}
            </h3>
            <p className="text-sm text-stone-500 mt-2 font-medium">
              {isLogin ? 'Sign in to your premium feed' : 'Join the global network of high-fidelity creators'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="w-full space-y-4">
            {isLogin ? (
              <>
                <div className="space-y-4">
                  <input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-black/40 border border-zinc-800 text-sm px-5 py-4 rounded-2xl focus:border-pink-500/60 outline-none transition-all placeholder:text-stone-600 text-white" required />
                  <input type="password" placeholder="Secure Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-black/40 border border-zinc-800 text-sm px-5 py-4 rounded-2xl focus:border-pink-500/60 outline-none transition-all placeholder:text-stone-600 text-white" required />
                </div>
              </>
            ) : signupStep === 1 ? (
              <>
                <div className="space-y-3">
                  <input type="text" placeholder="Full Identity Name" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full bg-black/40 border border-zinc-800 text-sm px-5 py-4 rounded-2xl focus:border-pink-500/60 outline-none transition-all text-white placeholder:text-stone-600" required />
                  <input type="text" placeholder="@handle (Unique Identifier)" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full bg-black/40 border border-zinc-800 text-sm px-5 py-4 rounded-2xl focus:border-pink-500/60 outline-none transition-all text-white placeholder:text-stone-600" required minLength={3} />
                  <input type="email" placeholder="Electronic Mail" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-black/40 border border-zinc-800 text-sm px-5 py-4 rounded-2xl focus:border-pink-500/60 outline-none transition-all text-white placeholder:text-stone-600" required />
                  <input type="password" placeholder="Access Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-black/40 border border-zinc-800 text-sm px-5 py-4 rounded-2xl focus:border-pink-500/60 outline-none transition-all text-white placeholder:text-stone-600" required />
                </div>
              </>
            ) : signupStep === 2 ? (
              <div className="space-y-6">
                <div className="flex items-center gap-3 text-stone-500 text-[10px] font-black uppercase tracking-widest bg-black/40 p-5 rounded-3xl border border-zinc-800/50">
                  <Calendar className="w-5 h-5 text-pink-500" /> Confirm your chronological identity
                </div>
                <div className="flex gap-2">
                  <select value={dobDay} onChange={e => setDobDay(e.target.value)} className="flex-1 bg-black/60 border border-zinc-800 text-xs px-4 py-4 rounded-2xl outline-none focus:border-pink-500 text-white appearance-none text-center font-bold" required>
                    <option value="">DAY</option>
                    {days.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <select value={dobMonth} onChange={e => setDobMonth(e.target.value)} className="flex-1 bg-black/60 border border-zinc-800 text-xs px-4 py-4 rounded-2xl outline-none focus:border-pink-500 text-white appearance-none text-center font-bold" required>
                    <option value="">MONTH</option>
                    {months.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
                  </select>
                  <select value={dobYear} onChange={e => setDobYear(e.target.value)} className="flex-1 bg-black/60 border border-zinc-800 text-xs px-4 py-4 rounded-2xl outline-none focus:border-pink-500 text-white appearance-none text-center font-bold" required>
                    <option value="">YEAR</option>
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
            ) : (
              <div className="space-y-5 max-h-[320px] overflow-y-auto no-scrollbar p-6 bg-black/60 rounded-[2rem] text-[11px] text-zinc-400 leading-relaxed border border-zinc-800/50 animate-in slide-in-from-bottom duration-500">
                <div className="font-black text-white mb-3 uppercase tracking-widest flex items-center gap-3 border-b border-zinc-800/50 pb-3">
                   <Lock className="w-4 h-4 text-pink-500" /> VixReel Encryption Standards
                </div>
                <p>By entering this network, you acknowledge that VixReel utilizes end-to-end encryption for all personal communications. Visual artifacts (Reels and Stories) are served via a high-fidelity edge network for maximum resolution.</p>
                
                <div className="font-black text-white mb-3 uppercase tracking-widest flex items-center gap-3 border-b border-zinc-800/50 pb-3 mt-6">
                   <ShieldCheck className="w-4 h-4 text-pink-500" /> Integrity Protocol
                </div>
                <ul className="list-disc pl-5 space-y-3">
                  <li className="font-medium"> Zero tolerance for explicit, uncredited, or harmful digital artifacts.</li>
                  <li className="font-medium"> Harassment and cyber-bullying trigger immediate account termination.</li>
                  <li className="font-medium"> Intellectual property must be respected; attribution is the default.</li>
                </ul>
                
                <div className="font-black text-white mb-3 uppercase tracking-widest mt-8 border-b border-zinc-800/50 pb-3">Violation Penalty</div>
                <p>Confirmed violations will lead to a permanent blacklist of your hardware identifier across the VixReel network. There is no appeal protocol.</p>
              </div>
            )}
            
            <button type="submit" disabled={loading} className="w-full vix-gradient hover:opacity-95 active:scale-[0.98] transition-all text-white font-black uppercase tracking-[0.25em] py-5 rounded-2xl text-[10px] mt-8 shadow-2xl disabled:opacity-50">
              {loading ? (
                <div className="flex items-center justify-center gap-3"><Loader2 className="w-4 h-4 animate-spin" /> ESTABLISHING LINK...</div>
              ) : isLogin ? (
                'Sync Interface'
              ) : signupStep === 3 ? (
                'Accept Protocol & Create'
              ) : (
                'Proceed'
              )}
            </button>
            
            {!isLogin && signupStep > 1 && (
              <button type="button" onClick={() => setSignupStep(prev => prev - 1)} className="w-full text-zinc-600 text-[9px] font-black uppercase tracking-[0.3em] mt-5 hover:text-zinc-400 transition-colors">Abort Step</button>
            )}
          </form>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] mt-8 p-4 rounded-2xl w-full text-center font-black uppercase tracking-widest flex items-center justify-center gap-3 animate-in shake duration-500">
               <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}
        </div>

        <div className="bg-zinc-900/40 backdrop-blur-2xl border border-stone-800/60 p-6 text-center rounded-[2rem]">
          <p className="text-xs text-stone-500 font-bold">
            {isLogin ? "NEW TO THE NETWORK?" : "ALREADY INTEGRATED?"}{' '}
            <button onClick={() => { setIsLogin(!isLogin); setSignupStep(1); setError(null); }} className="vix-text-gradient font-black uppercase tracking-widest text-[10px] hover:underline ml-2">
              {isLogin ? 'Initialize Account' : 'Return to Login'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
