
import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { UserProfile } from '../types';
import { 
  Loader2, 
  User,
  Camera,
  Smartphone,
  Mail,
  Fingerprint,
  ChevronRight,
  ShieldCheck,
  Zap,
  Lock,
  ArrowRight
} from 'lucide-react';

interface AuthProps {
  onAuthSuccess: (user: UserProfile) => void;
  onCancelAdd?: () => void;
  isAddingAccount?: boolean;
}

type AuthMode = 'LOGIN' | 'SIGNUP';
type AuthStep = 'DETAILS' | 'VERIFY' | 'AVATAR';
type AuthMethod = 'PHONE' | 'EMAIL';

const Auth: React.FC<AuthProps> = ({ onAuthSuccess, onCancelAdd, isAddingAccount }) => {
  const [mode, setMode] = useState<AuthMode>('LOGIN');
  const [step, setStep] = useState<AuthStep>('DETAILS');
  const [authMethod, setAuthMethod] = useState<AuthMethod>('PHONE'); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  
  const otpInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 'VERIFY' && otpInputRef.current) {
      otpInputRef.current.focus();
    }
  }, [step]);

  const formatPhone = (val: string) => {
    let cleaned = val.replace(/\D/g, '');
    return cleaned ? `+${cleaned}` : '';
  };

  const handleInitialAction = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      if (authMethod === 'PHONE') {
        const formattedPhone = formatPhone(phone);
        if (!formattedPhone || formattedPhone.length < 10) throw new Error("Enter valid phone (+1...)");
        const { error: otpErr } = await supabase.auth.signInWithOtp({ phone: formattedPhone });
        if (otpErr) throw otpErr;
        setStep('VERIFY');
      } else {
        if (mode === 'LOGIN') {
          const { data, error: loginErr } = await supabase.auth.signInWithPassword({ email, password });
          if (loginErr) throw loginErr;
          if (data.user) {
            const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).maybeSingle();
            if (profile) onAuthSuccess(profile as any);
            else setStep('AVATAR');
          }
        } else {
          const { data, error: signUpErr } = await supabase.auth.signUp({ 
            email, password, options: { data: { username: email.split('@')[0] } }
          });
          if (signUpErr) throw signUpErr;
          setStep('AVATAR');
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySignal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length < 6) return;
    setLoading(true);
    setError(null);
    try {
      const formattedPhone = formatPhone(phone);
      const { data, error: verifyErr } = await supabase.auth.verifyOtp({
        phone: formattedPhone, token: otpCode, type: 'sms',
      });
      if (verifyErr) throw verifyErr;
      if (data.user) {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).maybeSingle();
        if (profile) onAuthSuccess(profile as any);
        else setStep('AVATAR');
      }
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };

  const handleFinalizeIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) { setError("Username required"); return; }
    setLoading(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error("No session");
      const { data: profile, error: dbErr } = await supabase.from('profiles').upsert({
        id: authUser.id,
        username: username.toLowerCase().trim(),
        avatar_url: avatarUrl || `https://ui-avatars.com/api/?name=${username}`,
        email: authUser.email,
        phone: authUser.phone
      }).select().single();
      if (dbErr) throw dbErr;
      onAuthSuccess(profile as any);
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };

  const renderDetails = () => (
    <form onSubmit={handleInitialAction} className="w-full space-y-8 animate-vix-in">
      <div className="flex bg-zinc-900/50 p-1 rounded-2xl border border-zinc-800 shadow-2xl">
        <button 
          type="button" 
          onClick={() => setAuthMethod('PHONE')} 
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${authMethod === 'PHONE' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-600'}`}
        >
          <Smartphone className="w-4 h-4" /> Phone
        </button>
        <button 
          type="button" 
          onClick={() => setAuthMethod('EMAIL')} 
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${authMethod === 'EMAIL' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-600'}`}
        >
          <Mail className="w-4 h-4" /> Email
        </button>
      </div>

      <div className="space-y-4">
        <div className="group relative">
          <div className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-700 group-focus-within:text-pink-500 transition-colors">
            {authMethod === 'PHONE' ? <Smartphone className="w-5 h-5" /> : <Mail className="w-5 h-5" />}
          </div>
          <input 
            type={authMethod === 'EMAIL' ? 'email' : 'tel'} 
            placeholder={authMethod === 'EMAIL' ? 'Identity Email' : 'Phone (e.g. +1...)'} 
            value={authMethod === 'EMAIL' ? email : phone} 
            onChange={e => authMethod === 'EMAIL' ? setEmail(e.target.value) : setPhone(e.target.value)} 
            className="w-full bg-zinc-950 border border-zinc-900 rounded-2xl py-5 pl-16 pr-6 text-sm text-white outline-none focus:border-pink-500/50 transition-all shadow-inner" 
            required 
          />
        </div>
        {authMethod === 'EMAIL' && (
          <div className="group relative">
            <div className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-700 group-focus-within:text-pink-500 transition-colors">
              <Lock className="w-5 h-5" />
            </div>
            <input 
              type="password" 
              placeholder="Secure Password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              className="w-full bg-zinc-950 border border-zinc-900 rounded-2xl py-5 pl-16 pr-6 text-sm text-white outline-none focus:border-pink-500/50 transition-all shadow-inner" 
              required 
            />
          </div>
        )}
      </div>

      <button type="submit" disabled={loading} className="w-full vix-gradient py-5 rounded-[2rem] text-white font-black uppercase tracking-[0.2em] text-[11px] shadow-[0_20px_40px_rgba(255,0,128,0.2)] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3">
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
          <>{mode === 'LOGIN' ? 'Access Void' : 'Begin Narrative'} <ArrowRight className="w-4 h-4" /></>
        )}
      </button>
    </form>
  );

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 vix-gradient opacity-50"></div>
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-pink-500/10 blur-[150px] rounded-full"></div>
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-500/10 blur-[150px] rounded-full"></div>

      <div className="w-full max-w-[480px] z-10 space-y-6">
        <div className="bg-[#050505] border border-zinc-900 rounded-[4rem] p-10 sm:p-16 flex flex-col items-center shadow-2xl ring-1 ring-white/5 relative">
          <div className="mb-12 text-center space-y-4">
             <h1 className="logo-font text-6xl vix-text-gradient drop-shadow-2xl">VixReel</h1>
             <div className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.4em] text-zinc-700">
                <Zap className="w-3 h-3 text-pink-500 fill-current" /> Social Narrative Protocol
             </div>
          </div>

          <div className="w-full mb-10 flex justify-center gap-10">
            <button onClick={() => setMode('LOGIN')} className={`text-[11px] font-black uppercase tracking-widest pb-2 border-b-2 transition-all ${mode === 'LOGIN' ? 'text-white border-pink-500' : 'text-zinc-700 border-transparent hover:text-zinc-400'}`}>Login</button>
            <button onClick={() => setMode('SIGNUP')} className={`text-[11px] font-black uppercase tracking-widest pb-2 border-b-2 transition-all ${mode === 'SIGNUP' ? 'text-white border-pink-500' : 'text-zinc-700 border-transparent hover:text-zinc-400'}`}>Sign Up</button>
          </div>

          {step === 'DETAILS' && renderDetails()}
          
          {step === 'VERIFY' && (
            <div className="w-full space-y-10 animate-vix-in text-center">
              <div className="space-y-2">
                <h3 className="text-white font-black text-2xl uppercase tracking-tight">Identity Check</h3>
                <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Verify your signal</p>
              </div>
              <div className="relative">
                <input 
                  ref={otpInputRef}
                  type="text" 
                  placeholder="••••••" 
                  value={otpCode} 
                  onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))} 
                  className="w-full bg-zinc-950 border border-zinc-900 rounded-3xl py-8 text-center text-5xl font-black text-white outline-none focus:border-pink-500/50 transition-all tracking-[0.5em] shadow-inner" 
                  maxLength={6} 
                />
              </div>
              <button onClick={handleVerifySignal} disabled={loading || otpCode.length < 6} className="w-full vix-gradient py-6 rounded-[2rem] text-white font-black uppercase tracking-[0.2em] text-[12px] shadow-2xl active:scale-95 transition-all">
                {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : 'Enter Void'}
              </button>
              <button onClick={() => setStep('DETAILS')} className="text-[10px] text-zinc-700 font-bold uppercase tracking-[0.3em] hover:text-white transition-colors">Resend or Change Method</button>
            </div>
          )}

          {step === 'AVATAR' && (
            <form onSubmit={handleFinalizeIdentity} className="w-full space-y-10 animate-vix-in text-center">
              <div className="space-y-2">
                <h3 className="text-white font-black text-2xl uppercase tracking-tight">Choose Handle</h3>
                <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Define your identity</p>
              </div>
              <div className="relative w-36 h-36 mx-auto group cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
                <div className="w-full h-full rounded-full border-4 border-zinc-900 overflow-hidden bg-zinc-950 flex items-center justify-center shadow-2xl transition-all group-hover:border-pink-500/30">
                  {avatarUrl ? <img src={avatarUrl} className="w-full h-full object-cover" /> : <Camera className="w-10 h-10 text-zinc-800 group-hover:text-pink-500 transition-colors" />}
                </div>
                <div className="absolute bottom-1 right-1 bg-pink-500 rounded-full p-2 border-4 border-[#050505] shadow-lg">
                  <User className="w-4 h-4 text-white" />
                </div>
                <input ref={avatarInputRef} type="file" className="hidden" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) setAvatarUrl(URL.createObjectURL(f)); }} />
              </div>
              <input 
                type="text" 
                placeholder="@handle" 
                value={username} 
                onChange={e => setUsername(e.target.value)} 
                className="w-full bg-zinc-950 border border-zinc-900 rounded-2xl py-5 text-center text-lg font-black text-white outline-none focus:border-pink-500/50 transition-all" 
                required 
              />
              <button type="submit" disabled={loading} className="w-full vix-gradient py-6 rounded-[2.5rem] text-white font-black uppercase tracking-widest text-[12px] shadow-2xl shadow-pink-500/20">
                {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : 'Activate Protocol'}
              </button>
            </form>
          )}

          {error && <div className="mt-8 text-red-500 text-[9px] font-black uppercase tracking-[0.2em] bg-red-500/5 p-4 rounded-xl border border-red-500/10 w-full text-center animate-shake">{error}</div>}
        </div>

        <div className="flex items-center justify-center gap-4 text-[10px] text-zinc-700 font-black uppercase tracking-[0.4em]">
           <ShieldCheck className="w-4 h-4 text-green-500" /> Secure Encryption Active
        </div>
      </div>
    </div>
  );
};

export default Auth;
