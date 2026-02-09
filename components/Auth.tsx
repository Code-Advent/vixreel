
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
  Info,
  Fingerprint,
  Zap
} from 'lucide-react';
import { sanitizeFilename } from '../lib/utils';

interface AuthProps {
  onAuthSuccess: (user: UserProfile) => void;
  onCancelAdd?: () => void;
  isAddingAccount?: boolean;
}

type AuthMode = 'LOGIN' | 'SIGNUP' | 'FIND_ACCOUNT' | 'RESET_PASSWORD';
type AuthStep = 'DETAILS' | 'VERIFY' | 'AVATAR';
type AuthMethod = 'PHONE' | 'EMAIL';

const Auth: React.FC<AuthProps> = ({ onAuthSuccess, onCancelAdd, isAddingAccount }) => {
  const [mode, setMode] = useState<AuthMode>('LOGIN');
  const [step, setStep] = useState<AuthStep>('DETAILS');
  const [authMethod, setAuthMethod] = useState<AuthMethod>('PHONE'); // Defaulting to Phone as requested
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
    let cleaned = val.replace(/\D/g, '');
    if (cleaned && !val.startsWith('+')) {
      return `+${cleaned}`;
    }
    return val.startsWith('+') ? `+${cleaned}` : `+${cleaned}`;
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
          setError("Direct verification required. Transmitting signal...");
          if (authMethod === 'PHONE') {
             // For phone verification, we can trigger an OTP if password login requires it
             await supabase.auth.signInWithOtp({ phone: formattedPhone });
             setStep('VERIFY');
          }
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
      if (!username.trim()) { setError("Username handle required."); return; }
      if (password.length < 6) { setError("Security key too short (min 6)."); return; }
      
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
          setSuccessMsg("Verification code sent directly to your device.");
        } else {
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
        if (!phone) throw new Error("Phone number required to find account.");
        otpParams.phone = formattedPhone;
      } else {
        if (!email) throw new Error("Email required to find account.");
        otpParams.email = email;
      }

      const { error: otpErr } = await supabase.auth.signInWithOtp(otpParams);
      if (otpErr) throw otpErr;
      
      setStep('VERIFY');
      setSuccessMsg(`Recovery code sent directly to ${authMethod === 'PHONE' ? 'phone' : 'email'}.`);
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
      setError("The verification code entered is incorrect or expired.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) { setError("Min 6 characters required."); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setSuccessMsg("Access key updated. Entering grid...");
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
      setError("Identity synchronization failure.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-y-auto selection:bg-pink-500/30">
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-pink-600/10 blur-[150px] rounded-full animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-700/10 blur-[150px] rounded-full"></div>
      </div>

      {isAddingAccount && (
        <button onClick={onCancelAdd} className="absolute top-8 left-8 text-zinc-600 hover:text-white flex items-center gap-2 font-bold text-[10px] uppercase tracking-[0.2em] transition-all group z-50">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back
        </button>
      )}

      <div className="w-full max-w-[420px] space-y-6 z-10 animate-vix-in">
        <div className="bg-[#050505] border border-zinc-900 rounded-[3rem] p-8 sm:p-12 flex flex-col items-center shadow-[0_0_100px_rgba(255,0,128,0.05)] relative overflow-hidden ring-1 ring-white/5">
          <div className="absolute top-0 left-0 w-full h-1.5 vix-gradient"></div>
          
          <div className="flex flex-col items-center mb-10 text-center">
            <h1 className="logo-font text-6xl vix-text-gradient mb-2 drop-shadow-2xl">VixReel</h1>
            <div className="flex items-center gap-2 text-[9px] text-zinc-500 font-black uppercase tracking-[0.4em]">
              <Fingerprint className="w-3.5 h-3.5 text-pink-500" /> Secure Social Network
            </div>
          </div>

          {/* Flow Stepper for Onboarding */}
          {mode === 'SIGNUP' && (
            <div className="w-full flex justify-between mb-10 px-6">
              <div className={`h-1 flex-1 rounded-full transition-all duration-700 ${step === 'DETAILS' || step === 'VERIFY' || step === 'AVATAR' ? 'bg-pink-500 shadow-[0_0_10px_#ff0080]' : 'bg-zinc-900'}`}></div>
              <div className="w-4"></div>
              <div className={`h-1 flex-1 rounded-full transition-all duration-700 ${step === 'VERIFY' || step === 'AVATAR' ? 'bg-pink-500 shadow-[0_0_10px_#ff0080]' : 'bg-zinc-900'}`}></div>
              <div className="w-4"></div>
              <div className={`h-1 flex-1 rounded-full transition-all duration-700 ${step === 'AVATAR' ? 'bg-pink-500 shadow-[0_0_10px_#ff0080]' : 'bg-zinc-900'}`}></div>
            </div>
          )}

          {mode === 'LOGIN' && step === 'DETAILS' && (
            <form onSubmit={handleLogin} className="w-full space-y-4">
              <div className="flex bg-zinc-900/40 p-1.5 rounded-2xl border border-zinc-800/50 mb-4 backdrop-blur-md">
                 <button type="button" onClick={() => setAuthMethod('PHONE')} className={`flex-1 flex items-center justify-center gap-2 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${authMethod === 'PHONE' ? 'bg-zinc-800 text-white shadow-2xl ring-1 ring-white/10' : 'text-zinc-600 hover:text-zinc-400'}`}>
                   <Smartphone className="w-4 h-4" /> Phone
                 </button>
                 <button type="button" onClick={() => setAuthMethod('EMAIL')} className={`flex-1 flex items-center justify-center gap-2 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${authMethod === 'EMAIL' ? 'bg-zinc-800 text-white shadow-2xl ring-1 ring-white/10' : 'text-zinc-600 hover:text-zinc-400'}`}>
                   <Mail className="w-4 h-4" /> Email
                 </button>
              </div>
              
              <div className="space-y-4">
                <input 
                  type={authMethod === 'EMAIL' ? 'email' : 'tel'} 
                  placeholder={authMethod === 'EMAIL' ? 'Email Address' : 'Phone Number (+1...)'} 
                  value={authMethod === 'EMAIL' ? email : phone} 
                  onChange={e => authMethod === 'EMAIL' ? setEmail(e.target.value) : setPhone(e.target.value)} 
                  className="vix-input" 
                  required 
                />
                <input 
                  type="password" 
                  placeholder="Access Password" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  className="vix-input" 
                  required 
                />
              </div>
              
              <button type="submit" disabled={loading} className="vix-btn-primary mt-6 flex items-center justify-center gap-3 group">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>AUTHENTICATE <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></>}
              </button>
              
              <button type="button" onClick={() => toggleMode('FIND_ACCOUNT')} className="w-full text-center text-[10px] text-zinc-600 hover:text-pink-500 font-black uppercase mt-8 tracking-[0.3em] transition-colors flex items-center justify-center gap-2">
                <Zap className="w-3 h-3" /> Recover Access?
              </button>
            </form>
          )}

          {mode === 'SIGNUP' && step === 'DETAILS' && (
            <form onSubmit={handleSignup} className="w-full space-y-4">
              <div className="flex bg-zinc-900/40 p-1.5 rounded-2xl border border-zinc-800/50 mb-4">
                 <button type="button" onClick={() => setAuthMethod('PHONE')} className={`flex-1 flex items-center justify-center gap-2 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${authMethod === 'PHONE' ? 'bg-zinc-800 text-white shadow-xl ring-1 ring-white/10' : 'text-zinc-600'}`}>
                   <Smartphone className="w-4 h-4" /> Phone
                 </button>
                 <button type="button" onClick={() => setAuthMethod('EMAIL')} className={`flex-1 flex items-center justify-center gap-2 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${authMethod === 'EMAIL' ? 'bg-zinc-800 text-white shadow-xl ring-1 ring-white/10' : 'text-zinc-600'}`}>
                   <Mail className="w-4 h-4" /> Email
                 </button>
              </div>

              <div className="space-y-4">
                <input type="text" placeholder="Unique @handle" value={username} onChange={e => setUsername(e.target.value)} className="vix-input" required />
                <input 
                  type={authMethod === 'EMAIL' ? 'email' : 'tel'} 
                  placeholder={authMethod === 'EMAIL' ? 'Email Address' : 'Phone Number (+1...)'} 
                  value={authMethod === 'EMAIL' ? email : phone} 
                  onChange={e => authMethod === 'EMAIL' ? setEmail(e.target.value) : setPhone(e.target.value)} 
                  className="vix-input" 
                  required 
                />
                <input type="password" placeholder="Create Secure Key" value={password} onChange={e => setPassword(e.target.value)} className="vix-input" required />
              </div>
              
              <button type="submit" disabled={loading} className="vix-btn-primary mt-6">
                {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'INITIALIZE IDENTITY'}
              </button>
            </form>
          )}

          {mode === 'FIND_ACCOUNT' && step === 'DETAILS' && (
            <form onSubmit={handleFindAccount} className="w-full space-y-8 text-center">
              <div className="space-y-2">
                <h3 className="text-white font-black text-2xl uppercase tracking-tighter">Account Discovery</h3>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest leading-relaxed">Enter your registered details to receive a direct recovery signal.</p>
              </div>
              <div className="flex bg-zinc-900/40 p-1.5 rounded-2xl border border-zinc-800/50">
                 <button type="button" onClick={() => setAuthMethod('PHONE')} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${authMethod === 'PHONE' ? 'bg-zinc-800 text-white' : 'text-zinc-600'}`}>Phone</button>
                 <button type="button" onClick={() => setAuthMethod('EMAIL')} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${authMethod === 'EMAIL' ? 'bg-zinc-800 text-white' : 'text-zinc-600'}`}>Email</button>
              </div>
              <input 
                type={authMethod === 'EMAIL' ? 'email' : 'tel'} 
                placeholder={authMethod === 'EMAIL' ? 'Registered Email' : 'Registered Phone (+1...)'} 
                value={authMethod === 'EMAIL' ? email : phone} 
                onChange={e => authMethod === 'EMAIL' ? setEmail(e.target.value) : setPhone(e.target.value)} 
                className="vix-input" 
                required 
              />
              <button type="submit" disabled={loading} className="vix-btn-primary group">
                {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : <>SEND CODE DIRECTLY <ChevronRight className="w-4 h-4 inline ml-2 group-hover:translate-x-1 transition-transform" /></>}
              </button>
              <button type="button" onClick={() => toggleMode('LOGIN')} className="text-[10px] text-zinc-700 font-black uppercase tracking-[0.4em] hover:text-white transition-all">Cancel Request</button>
            </form>
          )}

          {mode === 'RESET_PASSWORD' && (
            <form onSubmit={handleResetPassword} className="w-full space-y-6 text-center">
              <h3 className="text-white font-black text-xl uppercase tracking-widest">New Access Key</h3>
              <p className="text-[10px] text-zinc-500 font-bold uppercase">Identity confirmed. Secure your account.</p>
              <input type="password" placeholder="Enter new password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="vix-input text-center" required />
              <button type="submit" disabled={loading} className="vix-btn-primary">UPDATE & ENTER GRID</button>
            </form>
          )}

          {step === 'VERIFY' && (
            <form onSubmit={handleVerifyOtp} className="w-full space-y-10 text-center">
              <div className="space-y-3">
                <div className="w-16 h-16 bg-pink-500/10 rounded-3xl flex items-center justify-center mx-auto border border-pink-500/20 shadow-2xl">
                   <Zap className="w-8 h-8 text-pink-500 animate-pulse" />
                </div>
                <h3 className="text-white font-black text-2xl uppercase tracking-tighter">Terminal Verification</h3>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest leading-relaxed">
                  Enter the 6-digit signal sent directly to <span className="text-white font-black">{authMethod === 'PHONE' ? phone : email}</span>
                </p>
              </div>
              
              <div className="relative">
                <input 
                  ref={otpInputRef}
                  type="text" 
                  placeholder="000000" 
                  value={otpCode} 
                  onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))} 
                  className="w-full bg-zinc-900/30 border border-zinc-800 rounded-[2.5rem] py-8 text-center text-5xl tracking-[0.3em] font-black text-white outline-none focus:border-pink-500/50 transition-all shadow-inner placeholder:opacity-20" 
                  maxLength={6} 
                  required 
                />
              </div>
              
              <div className="space-y-6">
                <button type="submit" disabled={loading || otpCode.length < 6} className="vix-btn-primary flex items-center justify-center gap-3">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : <>ESTABLISH LINK <CheckCircle2 className="w-5 h-5" /></>}
                </button>
                <div className="text-[10px] text-zinc-700 font-bold uppercase tracking-[0.2em]">
                  No code received? <button type="button" onClick={() => handleFindAccount({ preventDefault: () => {} } as any)} className="text-pink-500 hover:text-pink-400 font-black ml-1 transition-colors">Resend Code</button>
                </div>
              </div>
            </form>
          )}

          {step === 'AVATAR' && (
            <form onSubmit={handleFinalize} className="w-full space-y-10 text-center">
              <div className="space-y-2">
                <h3 className="text-white font-black text-2xl uppercase tracking-tighter">Identity Fragment</h3>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Personalize your visual artifact</p>
              </div>
              
              <div className="relative w-48 h-48 mx-auto">
                <div className="w-full h-full rounded-full border-[8px] border-zinc-900 flex items-center justify-center overflow-hidden bg-zinc-950 shadow-[0_0_50px_rgba(255,0,128,0.15)] relative group ring-2 ring-white/5">
                  {avatarUrl ? (
                    <img src={avatarUrl} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-20 h-20 text-zinc-800" />
                  )}
                  <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all cursor-pointer backdrop-blur-sm" onClick={() => document.getElementById('avatar-upload')?.click()}>
                    <div className="flex flex-col items-center gap-2">
                      <Camera className="w-10 h-10 text-white" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-white">Capture</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-6">
                <label className="block w-full py-5 bg-zinc-900/30 rounded-2xl text-[10px] font-black uppercase text-zinc-500 border border-zinc-800/50 cursor-pointer hover:bg-zinc-800/50 transition-all hover:text-white hover:border-pink-500/20">
                  CHOOSE VISUAL ARTIFACT
                  <input id="avatar-upload" type="file" className="hidden" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) { setAvatarFile(f); setAvatarUrl(URL.createObjectURL(f)); } }}/>
                </label>
                
                <button type="submit" disabled={loading} className="vix-btn-primary">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'ENTER VIXREEL'}
                </button>
                
                <button type="button" onClick={() => onAuthSuccess({} as any)} className="text-[10px] text-zinc-700 font-bold uppercase hover:text-white transition-all tracking-[0.3em]">Skip Protocol</button>
              </div>
            </form>
          )}

          {error && (
            <div className="mt-8 flex items-start gap-4 text-red-500 text-[10px] font-black uppercase tracking-widest bg-red-500/10 p-5 rounded-2xl border border-red-500/20 w-full animate-in fade-in slide-in-from-top-4">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="flex-1 leading-relaxed">{error}</span>
            </div>
          )}
          
          {successMsg && (
            <div className="mt-8 flex items-start gap-4 text-green-500 text-[10px] font-black uppercase tracking-widest bg-green-500/10 p-5 rounded-2xl border border-green-500/20 w-full animate-in fade-in slide-in-from-top-4">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="flex-1 leading-relaxed">{successMsg}</span>
            </div>
          )}
        </div>

        <div className="bg-[#050505] border border-zinc-900 rounded-[2.5rem] p-7 text-center shadow-xl ring-1 ring-white/5 backdrop-blur-md">
          <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-[0.2em]">
            {mode === 'LOGIN' ? "New to the grid?" : "Already recognized?"}{' '}
            <button 
              onClick={() => toggleMode(mode === 'LOGIN' ? 'SIGNUP' : 'LOGIN')} 
              className="text-pink-500 hover:text-pink-400 transition-colors font-black ml-2 underline decoration-pink-500/30 underline-offset-4"
            >
              {mode === 'LOGIN' ? 'INITIALIZE' : 'AUTHENTICATE'}
            </button>
          </p>
        </div>

        {/* Support Section */}
        <div className="flex items-center justify-center gap-8 pt-4 opacity-30">
           <div className="flex items-center gap-2 cursor-pointer hover:opacity-100 transition-opacity">
              <Info className="w-3.5 h-3.5" />
              <span className="text-[9px] font-black uppercase tracking-widest">Protocol Support</span>
           </div>
           <div className="w-1.5 h-1.5 rounded-full bg-zinc-800"></div>
           <span className="text-[9px] font-black uppercase tracking-widest">v3.0 SECURE</span>
        </div>
      </div>
      
      <style>{`
        .vix-input { 
          width: 100%; 
          background: #09090b; 
          border: 1px solid #18181b; 
          border-radius: 1.5rem; 
          padding: 1.35rem 1.75rem; 
          font-size: 0.875rem; 
          color: white; 
          outline: none; 
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: inset 0 2px 10px rgba(0,0,0,0.4);
        }
        .vix-input:focus { 
          border-color: #ff0080; 
          box-shadow: 0 0 40px rgba(255,0,128,0.1), inset 0 2px 15px rgba(0,0,0,0.5);
          background: #0c0c0e;
          transform: translateY(-1px);
        }
        .vix-btn-primary { 
          width: 100%; 
          background: #ff0080; 
          padding: 1.5rem; 
          border-radius: 1.75rem; 
          font-size: 0.75rem; 
          font-weight: 900; 
          color: white; 
          text-transform: uppercase; 
          letter-spacing: 0.4em; 
          transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 15px 50px rgba(255,0,128,0.25);
          border: 1px solid rgba(255,255,255,0.1);
          cursor: pointer;
        }
        .vix-btn-primary:hover:not(:disabled) {
          transform: translateY(-3px) scale(1.01);
          box-shadow: 0 20px 60px rgba(255,0,128,0.35);
          background: #ff1a8c;
          filter: brightness(1.1);
        }
        .vix-btn-primary:active:not(:disabled) {
          transform: translateY(-1px) scale(0.99);
        }
        .vix-btn-primary:disabled {
          opacity: 0.3;
          cursor: not-allowed;
          filter: grayscale(1);
          transform: none;
        }
      `}</style>
    </div>
  );
};

export default Auth;
