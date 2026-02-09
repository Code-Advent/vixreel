
import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { UserProfile } from '../types';
import { 
  Loader2, 
  ArrowLeft,
  User,
  Camera,
  Smartphone,
  Mail,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ChevronRight,
  Info
} from 'lucide-react';
import { sanitizeFilename } from '../lib/utils';

interface AuthProps {
  onAuthSuccess: (user: UserProfile) => void;
  onCancelAdd?: () => void;
  isAddingAccount?: boolean;
}

type AuthMode = 'LOGIN' | 'SIGNUP' | 'FIND_ACCOUNT' | 'RESET_PASSWORD';
type AuthStep = 'DETAILS' | 'VERIFY' | 'AVATAR';
type AuthMethod = 'EMAIL' | 'PHONE';

const Auth: React.FC<AuthProps> = ({ onAuthSuccess, onCancelAdd, isAddingAccount }) => {
  const [mode, setMode] = useState<AuthMode>('LOGIN');
  const [step, setStep] = useState<AuthStep>('DETAILS');
  const [authMethod, setAuthMethod] = useState<AuthMethod>('PHONE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const otpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 'VERIFY' && otpInputRef.current) {
      otpInputRef.current.focus();
    }
  }, [step]);

  const toggleMode = (newMode: AuthMode) => {
    setError(null);
    setSuccessMsg(null);
    setStep('DETAILS');
    setMode(newMode);
    setOtpCode('');
  };

  const formatPhone = (val: string) => {
    let cleaned = val.replace(/\s+/g, '');
    if (cleaned && !cleaned.startsWith('+')) {
      return `+${cleaned}`;
    }
    return cleaned;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const formattedPhone = formatPhone(phone);
      const loginData = authMethod === 'EMAIL' 
        ? { email, password } 
        : { phone: formattedPhone, password };

      const { data, error: loginErr } = await supabase.auth.signInWithPassword(loginData);
      
      if (loginErr) {
        if (loginErr.message.toLowerCase().includes("confirmed") || loginErr.message.toLowerCase().includes("verify")) {
          setError("Identity verification required.");
          if (authMethod === 'PHONE') setStep('VERIFY');
          return;
        }
        throw loginErr;
      }
      if (data.user) onAuthSuccess(data.user as any);
    } catch (err: any) {
      setError(err.message || "Credential synchronization failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (step === 'DETAILS') {
      if (!username.trim()) { setError("Username required."); return; }
      if (password.length < 6) { setError("Password too short."); return; }
      
      setLoading(true);
      try {
        const formattedPhone = formatPhone(phone);
        const options = { 
          data: { 
            username: username.toLowerCase().trim(), 
            full_name: fullName.trim() || username.trim() 
          } 
        };
        
        const signupData: any = authMethod === 'EMAIL' 
          ? { email, password, options } 
          : { phone: formattedPhone, password, options };

        const { data, error: signError } = await supabase.auth.signUp(signupData);
        
        if (signError) throw signError;

        if (authMethod === 'PHONE') {
          setStep('VERIFY');
          setSuccessMsg("Verification signal dispatched.");
        } else {
          // For email, we might need confirmation, but for now we transition to avatar
          setStep('AVATAR');
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleFindAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const formattedPhone = formatPhone(phone);
      const otpParams: { email?: string; phone?: string } = {};
      if (authMethod === 'PHONE') {
        if (!phone) throw new Error("Phone identity required.");
        otpParams.phone = formattedPhone;
      } else {
        if (!email) throw new Error("Email identity required.");
        otpParams.email = email;
      }

      const { error: otpErr } = await supabase.auth.signInWithOtp(otpParams);
      if (otpErr) throw otpErr;
      setStep('VERIFY');
      setSuccessMsg("Recovery frequency established.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length < 6) return;
    setLoading(true);
    setError(null);
    try {
      const formattedPhone = formatPhone(phone);
      const type = mode === 'SIGNUP' ? 'signup' : 'sms';
      const verifyPayload: any = { token: otpCode, type };
      
      if (authMethod === 'PHONE') verifyPayload.phone = formattedPhone;
      else verifyPayload.email = email;

      const { error: verifyErr } = await supabase.auth.verifyOtp(verifyPayload);
      if (verifyErr) throw verifyErr;

      if (mode === 'FIND_ACCOUNT') {
        setMode('RESET_PASSWORD');
        setStep('DETAILS');
      } else {
        setStep('AVATAR');
      }
    } catch (err: any) {
      setError("Verification sequence failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) { setError("Min 6 chars."); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setSuccessMsg("Access key synchronized.");
      setTimeout(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) onAuthSuccess(session.user as any);
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFinalize = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        if (avatarFile) {
          const fileName = `${session.user.id}-${Date.now()}-${sanitizeFilename(avatarFile.name)}`;
          await supabase.storage.from('avatars').upload(`avatars/${fileName}`, avatarFile);
          const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(`avatars/${fileName}`);
          await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', session.user.id);
        }
        onAuthSuccess(session.user as any);
      }
    } catch (err: any) {
      setError("Identity finalization failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 relative overflow-y-auto selection:bg-pink-500/30 font-sans">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-pink-500/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full"></div>
      </div>

      {isAddingAccount && (
        <button onClick={onCancelAdd} className="absolute top-8 left-8 text-zinc-600 hover:text-white flex items-center gap-2 font-bold text-[10px] uppercase tracking-[0.2em] transition-all group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back
        </button>
      )}

      <div className="w-full max-w-[400px] space-y-6 z-10 animate-vix-in">
        <div className="bg-[#050505] border border-zinc-900 rounded-[2.5rem] p-10 flex flex-col items-center shadow-2xl relative overflow-hidden ring-1 ring-white/5">
          <div className="absolute top-0 left-0 w-full h-1 vix-gradient"></div>
          
          <div className="flex flex-col items-center mb-10">
            <h1 className="logo-font text-5xl vix-text-gradient mb-2">VixReel</h1>
            <div className="flex items-center gap-2 text-[9px] text-zinc-600 font-black uppercase tracking-[0.3em]">
              <ShieldCheck className="w-3 h-3" /> Encrypted Grid Access
            </div>
          </div>

          {/* Progress Indicator for Signup */}
          {mode === 'SIGNUP' && (
            <div className="w-full flex justify-between mb-8 px-4">
              <div className={`h-1 flex-1 rounded-full transition-all duration-500 ${step === 'DETAILS' || step === 'VERIFY' || step === 'AVATAR' ? 'vix-gradient' : 'bg-zinc-900'}`}></div>
              <div className="w-4"></div>
              <div className={`h-1 flex-1 rounded-full transition-all duration-500 ${step === 'VERIFY' || step === 'AVATAR' ? 'vix-gradient' : 'bg-zinc-900'}`}></div>
              <div className="w-4"></div>
              <div className={`h-1 flex-1 rounded-full transition-all duration-500 ${step === 'AVATAR' ? 'vix-gradient' : 'bg-zinc-900'}`}></div>
            </div>
          )}

          {mode === 'LOGIN' && step === 'DETAILS' && (
            <form onSubmit={handleLogin} className="w-full space-y-4">
              <div className="flex bg-zinc-900/50 p-1.5 rounded-2xl border border-zinc-800/50 mb-2">
                 <button type="button" onClick={() => setAuthMethod('PHONE')} className={`flex-1 flex items-center justify-center gap-2 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${authMethod === 'PHONE' ? 'bg-zinc-800 text-white shadow-xl ring-1 ring-white/5' : 'text-zinc-600 hover:text-zinc-400'}`}>
                   <Smartphone className="w-3.5 h-3.5" /> Phone
                 </button>
                 <button type="button" onClick={() => setAuthMethod('EMAIL')} className={`flex-1 flex items-center justify-center gap-2 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${authMethod === 'EMAIL' ? 'bg-zinc-800 text-white shadow-xl ring-1 ring-white/5' : 'text-zinc-600 hover:text-zinc-400'}`}>
                   <Mail className="w-3.5 h-3.5" /> Email
                 </button>
              </div>
              
              <div className="relative group">
                <input 
                  type={authMethod === 'EMAIL' ? 'email' : 'tel'} 
                  placeholder={authMethod === 'EMAIL' ? 'Email Address' : 'Phone (+1...)'} 
                  value={authMethod === 'EMAIL' ? email : phone} 
                  onChange={e => authMethod === 'EMAIL' ? setEmail(e.target.value) : setPhone(e.target.value)} 
                  className="vix-input" 
                  required 
                />
              </div>

              <div className="relative group">
                <input 
                  type="password" 
                  placeholder="Password" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  className="vix-input" 
                  required 
                />
              </div>
              
              <button type="submit" disabled={loading} className="vix-btn-primary mt-4 flex items-center justify-center gap-3">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Authorize <ChevronRight className="w-4 h-4" /></>}
              </button>
              
              <button type="button" onClick={() => toggleMode('FIND_ACCOUNT')} className="w-full text-center text-[9px] text-zinc-600 hover:text-pink-500 font-bold uppercase mt-6 tracking-[0.2em] transition-colors">Recover Identity?</button>
            </form>
          )}

          {mode === 'SIGNUP' && step === 'DETAILS' && (
            <form onSubmit={handleSignup} className="w-full space-y-4">
              <div className="grid grid-cols-1 gap-4 mb-2">
                <input type="text" placeholder="Unique Handle" value={username} onChange={e => setUsername(e.target.value)} className="vix-input" required />
                <input type="text" placeholder="Display Name" value={fullName} onChange={e => setFullName(e.target.value)} className="vix-input" />
              </div>

              <div className="flex bg-zinc-900/50 p-1.5 rounded-2xl border border-zinc-800/50 mb-2">
                 <button type="button" onClick={() => setAuthMethod('PHONE')} className={`flex-1 flex items-center justify-center gap-2 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${authMethod === 'PHONE' ? 'bg-zinc-800 text-white shadow-xl ring-1 ring-white/5' : 'text-zinc-600'}`}>
                   <Smartphone className="w-3.5 h-3.5" /> Phone
                 </button>
                 <button type="button" onClick={() => setAuthMethod('EMAIL')} className={`flex-1 flex items-center justify-center gap-2 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${authMethod === 'EMAIL' ? 'bg-zinc-800 text-white shadow-xl ring-1 ring-white/5' : 'text-zinc-600'}`}>
                   <Mail className="w-3.5 h-3.5" /> Email
                 </button>
              </div>

              <input 
                type={authMethod === 'EMAIL' ? 'email' : 'tel'} 
                placeholder={authMethod === 'EMAIL' ? 'Email' : 'Phone (+1...)'} 
                value={authMethod === 'EMAIL' ? email : phone} 
                onChange={e => authMethod === 'EMAIL' ? setEmail(e.target.value) : setPhone(e.target.value)} 
                className="vix-input" 
                required 
              />
              
              <input type="password" placeholder="Secure Password" value={password} onChange={e => setPassword(e.target.value)} className="vix-input" required />
              
              <button type="submit" disabled={loading} className="vix-btn-primary mt-4">
                {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Create Identity'}
              </button>
              
              <p className="text-[8px] text-zinc-600 text-center mt-4 leading-relaxed uppercase tracking-tighter">
                By initializing, you accept the <span className="text-zinc-400">Grid Protocols</span> and <span className="text-zinc-400">Data Policy</span>.
              </p>
            </form>
          )}

          {mode === 'FIND_ACCOUNT' && step === 'DETAILS' && (
            <form onSubmit={handleFindAccount} className="w-full space-y-6 text-center">
              <div className="space-y-2">
                <h3 className="text-white font-black text-lg uppercase tracking-tight">Identity Recovery</h3>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Transmit reset pulse to verified source</p>
              </div>
              <div className="flex bg-zinc-900/50 p-1.5 rounded-2xl border border-zinc-800/50">
                 <button type="button" onClick={() => setAuthMethod('PHONE')} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl ${authMethod === 'PHONE' ? 'bg-zinc-800 text-white shadow-xl ring-1 ring-white/5' : 'text-zinc-600'}`}>Phone</button>
                 <button type="button" onClick={() => setAuthMethod('EMAIL')} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl ${authMethod === 'EMAIL' ? 'bg-zinc-800 text-white shadow-xl ring-1 ring-white/5' : 'text-zinc-600'}`}>Email</button>
              </div>
              <input type={authMethod === 'EMAIL' ? 'email' : 'tel'} placeholder={authMethod === 'EMAIL' ? 'Email address' : 'Phone (+1...)'} value={authMethod === 'EMAIL' ? email : phone} onChange={e => authMethod === 'EMAIL' ? setEmail(e.target.value) : setPhone(e.target.value)} className="vix-input" required />
              <button type="submit" disabled={loading} className="vix-btn-primary">
                {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Dispatch Signal'}
              </button>
              <button type="button" onClick={() => toggleMode('LOGIN')} className="text-[9px] text-zinc-700 font-black uppercase tracking-[0.3em] hover:text-white transition-colors">Abort Sequence</button>
            </form>
          )}

          {mode === 'RESET_PASSWORD' && (
            <form onSubmit={handleResetPassword} className="w-full space-y-6 text-center">
              <h3 className="text-white font-black text-lg uppercase">New Access Key</h3>
              <input type="password" placeholder="Enter new password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="vix-input text-center" required />
              <button type="submit" disabled={loading} className="vix-btn-primary">Synchronize Pulse</button>
            </form>
          )}

          {step === 'VERIFY' && (
            <form onSubmit={handleVerifyOtp} className="w-full space-y-8 text-center">
              <div className="space-y-2">
                <h3 className="text-white font-black text-xl uppercase tracking-widest">Verification</h3>
                <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Signal transmitted to {authMethod === 'PHONE' ? phone : email}</p>
              </div>
              
              <div className="relative">
                <input 
                  ref={otpInputRef}
                  type="text" 
                  placeholder="000000" 
                  value={otpCode} 
                  onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))} 
                  className="w-full bg-zinc-900/50 border border-zinc-800 rounded-3xl py-8 text-center text-4xl tracking-[0.4em] font-black text-white outline-none focus:border-pink-500/50 transition-all shadow-inner" 
                  maxLength={6} 
                  required 
                />
              </div>
              
              <div className="space-y-4">
                <button type="submit" disabled={loading || otpCode.length < 6} className="vix-btn-primary disabled:opacity-20 flex items-center justify-center gap-3">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : <>Establish Connection <CheckCircle2 className="w-4 h-4" /></>}
                </button>
                <div className="text-[9px] text-zinc-700 font-bold uppercase tracking-[0.2em]">
                  No signal received? <button type="button" onClick={() => step === 'VERIFY' && handleFindAccount({ preventDefault: () => {} } as any)} className="text-pink-500 hover:underline">Re-dispatch</button>
                </div>
              </div>
            </form>
          )}

          {step === 'AVATAR' && (
            <form onSubmit={handleFinalize} className="w-full space-y-8 text-center">
              <div className="space-y-2">
                <h3 className="text-white font-black text-xl uppercase tracking-tighter">Identity Fragment</h3>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Personalize your visual presence</p>
              </div>
              
              <div className="relative w-40 h-40 mx-auto">
                <div className="w-full h-full rounded-full border-[6px] border-zinc-900 flex items-center justify-center overflow-hidden bg-zinc-950 shadow-2xl relative group ring-2 ring-pink-500/20">
                  {avatarUrl ? (
                    <img src={avatarUrl} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-16 h-16 text-zinc-800" />
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all cursor-pointer" onClick={() => document.getElementById('avatar-upload')?.click()}>
                    <div className="flex flex-col items-center gap-2">
                      <Camera className="w-8 h-8 text-white" />
                      <span className="text-[8px] font-black uppercase tracking-widest">Update</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <label className="block w-full py-5 bg-zinc-900/50 rounded-2xl text-[10px] font-black uppercase text-zinc-500 border border-zinc-800/50 cursor-pointer hover:bg-zinc-800 transition-all hover:text-white">
                  Capture Identity Visual
                  <input id="avatar-upload" type="file" className="hidden" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) { setAvatarFile(f); setAvatarUrl(URL.createObjectURL(f)); } }}/>
                </label>
                
                <button type="submit" disabled={loading} className="vix-btn-primary">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Enter VixReel'}
                </button>
                
                <button type="button" onClick={() => onAuthSuccess({} as any)} className="text-[9px] text-zinc-700 font-bold uppercase hover:text-white transition-colors">Skip for now</button>
              </div>
            </form>
          )}

          {error && (
            <div className="mt-8 flex items-start gap-4 text-red-500 text-[10px] font-black uppercase tracking-widest bg-red-500/5 p-5 rounded-2xl border border-red-500/10 w-full animate-in fade-in slide-in-from-top-4">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="flex-1 leading-relaxed">{error}</span>
            </div>
          )}
          
          {successMsg && (
            <div className="mt-8 flex items-start gap-4 text-green-500 text-[10px] font-black uppercase tracking-widest bg-green-500/5 p-5 rounded-2xl border border-green-500/10 w-full animate-in fade-in slide-in-from-top-4">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="flex-1 leading-relaxed">{successMsg}</span>
            </div>
          )}
        </div>

        <div className="bg-[#050505] border border-zinc-900 rounded-[2rem] p-6 text-center shadow-xl ring-1 ring-white/5">
          <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-[0.1em]">
            {mode === 'LOGIN' ? "New to the grid?" : "Already recognized?"}{' '}
            <button 
              onClick={() => toggleMode(mode === 'LOGIN' ? 'SIGNUP' : 'LOGIN')} 
              className="text-pink-500 hover:text-white transition-colors font-black ml-1"
            >
              {mode === 'LOGIN' ? 'INITIALIZE' : 'AUTHENTICATE'}
            </button>
          </p>
        </div>

        {/* Support Section */}
        <div className="flex items-center justify-center gap-6 pt-4 opacity-40">
           <div className="flex items-center gap-1.5 cursor-pointer hover:opacity-100 transition-opacity">
              <Info className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Protocol Support</span>
           </div>
           <div className="w-1 h-1 rounded-full bg-zinc-800"></div>
           <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">v2.8.5 STABLE</span>
        </div>
      </div>
      
      <style>{`
        .vix-input { 
          width: 100%; 
          background: #09090b; 
          border: 1px solid #18181b; 
          border-radius: 1.25rem; 
          padding: 1.25rem 1.5rem; 
          font-size: 0.875rem; 
          color: white; 
          outline: none; 
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: inset 0 2px 10px rgba(0,0,0,0.4);
        }
        .vix-input:focus { 
          border-color: #ff0080; 
          box-shadow: 0 0 30px rgba(255,0,128,0.1), inset 0 2px 10px rgba(0,0,0,0.5);
          background: #0c0c0e;
        }
        .vix-btn-primary { 
          width: 100%; 
          background: #ff0080; 
          padding: 1.35rem; 
          border-radius: 1.5rem; 
          font-size: 0.75rem; 
          font-weight: 900; 
          color: white; 
          text-transform: uppercase; 
          letter-spacing: 0.3em; 
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 10px 40px rgba(255,0,128,0.3);
          border: 1px solid rgba(255,255,255,0.1);
        }
        .vix-btn-primary:hover:not(:disabled) {
          transform: translateY(-3px);
          box-shadow: 0 15px 50px rgba(255,0,128,0.4);
          background: #ff1a8c;
          filter: brightness(1.1);
        }
        .vix-btn-primary:active:not(:disabled) {
          transform: translateY(-1px);
        }
        .vix-btn-primary:disabled {
          opacity: 0.4;
          cursor: not-allowed;
          filter: grayscale(1);
        }
      `}</style>
    </div>
  );
};

export default Auth;
