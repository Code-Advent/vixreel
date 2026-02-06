
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { UserProfile } from '../types';
import { ChevronRight, Loader2, AlertCircle, Calendar, ShieldCheck, ChevronLeft, CheckCircle2, Sparkles, Zap, Flame } from 'lucide-react';

interface AuthProps {
  onAuthSuccess: (user: UserProfile) => void;
}

type AuthStep = 'LANDING' | 'CREDENTIALS' | 'IDENTITY' | 'POLICY';

const Auth: React.FC<AuthProps> = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [step, setStep] = useState<AuthStep>('LANDING');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (isLogin) {
      await login();
    } else {
      if (step === 'CREDENTIALS') {
        if (!username.trim() || !email.trim() || !password.trim()) { 
          setError("All core credentials required."); 
          return; 
        }
        setStep('IDENTITY');
      } else if (step === 'IDENTITY') {
        if (!dob) { 
          setError("Birth protocol date required for age verification."); 
          return; 
        }
        setStep('POLICY');
      } else {
        await signup();
      }
    }
  };

  const login = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (loginError) throw loginError;
      if (data.user) onAuthSuccess(data.user as any);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const signup = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: signupError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            username: username.trim().toLowerCase(),
            full_name: fullName.trim() || username.trim(),
            date_of_birth: dob
          }
        }
      });
      if (signupError) throw signupError;
      
      if (data.user && !data.session) {
        setError("Verification protocol initiated. Check your inbox.");
        setIsLogin(true);
        setStep('CREDENTIALS');
      } else if (data.user && data.session) {
        onAuthSuccess(data.user as any);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (step === 'LANDING') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6 relative overflow-hidden">
        {/* Animated Background Orbs */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-pink-600/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>
        
        <div className="w-full max-w-xl text-center z-10 space-y-12 animate-vix-in">
          <div className="space-y-4">
            <h1 className="logo-font text-8xl md:text-9xl vix-text-gradient drop-shadow-[0_0_30px_rgba(255,0,128,0.3)]">VixReel</h1>
            <p className="text-zinc-500 font-black uppercase tracking-[0.5em] text-[10px] md:text-xs">The Digital Social Narrative</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button 
              onClick={() => { setIsLogin(true); setStep('CREDENTIALS'); }}
              className="group relative p-1 rounded-3xl overflow-hidden transition-all hover:scale-105 active:scale-95"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-zinc-800 to-zinc-900 group-hover:from-zinc-700 group-hover:to-zinc-800"></div>
              <div className="relative bg-black rounded-[1.4rem] p-8 flex flex-col items-center gap-4">
                <Zap className="w-8 h-8 text-white group-hover:text-pink-500 transition-colors" />
                <span className="font-black uppercase tracking-widest text-xs text-zinc-300">Enter Narrative</span>
                <p className="text-[10px] text-zinc-600 font-medium">Continue your existing story</p>
              </div>
            </button>

            <button 
              onClick={() => { setIsLogin(false); setStep('CREDENTIALS'); }}
              className="group relative p-1 rounded-3xl overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(255,0,128,0.15)]"
            >
              <div className="absolute inset-0 vix-gradient"></div>
              <div className="relative bg-black/90 backdrop-blur-xl rounded-[1.4rem] p-8 flex flex-col items-center gap-4">
                <Flame className="w-8 h-8 text-white group-hover:scale-110 transition-transform" />
                <span className="font-black uppercase tracking-widest text-xs text-white">Join the Void</span>
                <p className="text-[10px] text-zinc-400 font-medium">Begin your journey today</p>
              </div>
            </button>
          </div>

          <div className="pt-12">
            <p className="text-[9px] text-zinc-700 font-black uppercase tracking-[0.2em] max-w-xs mx-auto leading-relaxed">
              Curated for creators who demand aesthetic excellence and narrative depth.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 sm:p-6 overflow-y-auto py-20 relative">
       <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,_#111_0%,_#000_70%)]"></div>
       </div>

      <div className="w-full max-w-md animate-vix-in z-10">
        <button 
          onClick={() => setStep('LANDING')} 
          className="mb-8 flex items-center gap-2 text-zinc-600 hover:text-white transition-colors group mx-auto"
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-[10px] font-black uppercase tracking-widest">Return to Gateway</span>
        </button>

        <div className="bg-zinc-950/80 backdrop-blur-3xl border border-zinc-900 rounded-[3rem] p-6 sm:p-10 shadow-2xl space-y-8 relative overflow-hidden border-t-white/5">
          <div className="text-center space-y-2">
            <h1 className="logo-font text-5xl font-bold vix-text-gradient">VixReel</h1>
            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.3em]">
              {isLogin ? 'Access Identity' : `Create Narrative • Phase ${step === 'CREDENTIALS' ? '1' : step === 'IDENTITY' ? '2' : '3'}`}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {isLogin ? (
              <div className="space-y-4 animate-vix-in">
                <input 
                  type="email" 
                  placeholder="Email" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  className="w-full bg-black border border-zinc-800 rounded-2xl px-6 py-4 text-sm outline-none focus:border-pink-500/50 transition-all text-white placeholder:text-zinc-700" 
                  required 
                />
                <input 
                  type="password" 
                  placeholder="Password" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  className="w-full bg-black border border-zinc-800 rounded-2xl px-6 py-4 text-sm outline-none focus:border-pink-500/50 transition-all text-white placeholder:text-zinc-700" 
                  required 
                />
              </div>
            ) : (
              <>
                {step === 'CREDENTIALS' && (
                  <div className="space-y-4 animate-vix-in">
                    <input 
                      type="text" 
                      placeholder="@username (Handle)" 
                      value={username} 
                      onChange={e => setUsername(e.target.value)} 
                      className="w-full bg-black border border-zinc-800 rounded-2xl px-6 py-4 text-sm outline-none focus:border-pink-500/50 transition-all text-white placeholder:text-zinc-700" 
                      required 
                    />
                    <input 
                      type="email" 
                      placeholder="Email Address" 
                      value={email} 
                      onChange={e => setEmail(e.target.value)} 
                      className="w-full bg-black border border-zinc-800 rounded-2xl px-6 py-4 text-sm outline-none focus:border-pink-500/50 transition-all text-white placeholder:text-zinc-700" 
                      required 
                    />
                    <input 
                      type="password" 
                      placeholder="Security Password" 
                      value={password} 
                      onChange={e => setPassword(e.target.value)} 
                      className="w-full bg-black border border-zinc-800 rounded-2xl px-6 py-4 text-sm outline-none focus:border-pink-500/50 transition-all text-white placeholder:text-zinc-700" 
                      required 
                    />
                  </div>
                )}

                {step === 'IDENTITY' && (
                  <div className="space-y-4 animate-vix-in">
                    <button type="button" onClick={() => setStep('CREDENTIALS')} className="flex items-center gap-1 text-[10px] font-black uppercase text-zinc-500 mb-2 hover:text-white transition-colors"><ChevronLeft className="w-3 h-3"/> Credentials</button>
                    <input 
                      type="text" 
                      placeholder="Full Narrative Name" 
                      value={fullName} 
                      onChange={e => setFullName(e.target.value)} 
                      className="w-full bg-black border border-zinc-800 rounded-2xl px-6 py-4 text-sm outline-none focus:border-pink-500/50 transition-all text-white placeholder:text-zinc-700" 
                    />
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-zinc-600 ml-2 tracking-widest">Date of Birth Protocol</label>
                      <div className="relative">
                        <Calendar className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <input 
                          type="date" 
                          value={dob} 
                          onChange={e => setDob(e.target.value)} 
                          className="w-full bg-black border border-zinc-800 rounded-2xl px-14 py-4 text-sm outline-none focus:border-pink-500/50 transition-all text-zinc-300" 
                          required 
                        />
                      </div>
                    </div>
                  </div>
                )}

                {step === 'POLICY' && (
                  <div className="space-y-4 animate-vix-in">
                    <button type="button" onClick={() => setStep('IDENTITY')} className="flex items-center gap-1 text-[10px] font-black uppercase text-zinc-500 mb-2 hover:text-white transition-colors"><ChevronLeft className="w-3 h-3"/> Identity Details</button>
                    <div className="bg-black/60 border border-zinc-900 rounded-[2rem] p-6 h-64 overflow-y-auto no-scrollbar text-[10px] leading-relaxed text-zinc-500 space-y-6 font-medium">
                      <div className="space-y-2">
                        <p className="text-white font-black uppercase tracking-[0.2em] text-[11px] mb-2 border-b border-zinc-900 pb-2 flex items-center gap-2"><Sparkles className="w-4 h-4 text-pink-500" /> VixReel Narrative Manifesto</p>
                        <p className="italic">By proceeding, you agree to the following multidimensional laws of the VixReel network.</p>
                      </div>
                      <section className="space-y-2">
                        <p className="text-zinc-300 font-bold uppercase tracking-wider">I. Content Injectors</p>
                        <p>Injectors are solely responsible for the visual artifacts they transmit. All artifacts must be original or licensed narratives. Artifacts containing harmful stimuli, void-propaganda, or unsolicited commercial broadcasts will be terminated.</p>
                      </section>
                      <section className="space-y-2">
                        <p className="text-zinc-300 font-bold uppercase tracking-wider">II. Behavioral Standards</p>
                        <p>Harassment, cyber-stalking, or the use of automated injection-bots to inflate appreciation metrics is strictly prohibited. We maintain a zero-tolerance policy for narrative theft or identity mimics.</p>
                      </section>
                      <section className="space-y-2">
                        <p className="text-zinc-300 font-bold uppercase tracking-wider">III. Privacy & Encryption</p>
                        <p>Your identity parameters are encrypted via SHA-512 protocol. We do not distribute your narrative metadata to third-party advert-cores without rhythmic consent.</p>
                      </section>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-pink-500/5 border border-pink-500/10 rounded-2xl">
                      <CheckCircle2 className="w-6 h-6 text-pink-500 shrink-0" />
                      <span className="text-[9px] font-bold text-zinc-400 leading-tight">I have reviewed the long-form protocol and accept all terms of narrative creation and network interaction.</span>
                    </div>
                  </div>
                )}
              </>
            )}

            <button type="submit" disabled={loading} className="w-full vix-gradient py-5 rounded-[2rem] text-white font-black uppercase tracking-widest text-[10px] shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 group">
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isLogin ? (
                'Sync Identity'
              ) : step === 'POLICY' ? (
                'Establish Protocol'
              ) : (
                'Next Phase'
              )}
              {!loading && <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
            </button>
          </form>

          {error && (
            <div className="flex gap-2 text-red-500 text-[10px] font-black uppercase items-center bg-red-500/5 p-4 rounded-2xl border border-red-500/20 animate-vix-in">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}

          <div className="text-center">
            <button 
              type="button"
              onClick={() => { setIsLogin(!isLogin); setStep('CREDENTIALS'); setError(null); }} 
              className="text-[10px] font-black uppercase tracking-widest text-zinc-600 hover:text-white transition-colors"
            >
              {isLogin ? "Need a new core?" : "Already sync'd with VixReel?"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
