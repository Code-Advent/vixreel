
import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { UserProfile, AccountSession } from '../types';
import { 
  Loader2, 
  User,
  Camera,
  Smartphone,
  Mail,
  ShieldCheck,
  Zap,
  Lock,
  ArrowRight,
  Search,
  ArrowLeft,
  Key,
  CheckCircle2,
  RefreshCw,
  Plus,
  Trash2,
  ChevronRight,
  LogOut
} from 'lucide-react';
import VerificationBadge from './VerificationBadge';

interface AuthProps {
  onAuthSuccess: (user: UserProfile) => void;
  onCancelAdd?: () => void;
  isAddingAccount?: boolean;
}

type AuthMode = 'PICKER' | 'LOGIN' | 'SIGNUP' | 'FIND_ACCOUNT';
type AuthStep = 'DETAILS' | 'VERIFY' | 'AVATAR' | 'RESULT';
type AuthMethod = 'PHONE' | 'EMAIL';

const Auth: React.FC<AuthProps> = ({ onAuthSuccess, onCancelAdd, isAddingAccount }) => {
  const [savedAccounts, setSavedAccounts] = useState<AccountSession[]>(() => {
    const saved = localStorage.getItem('vixreel_saved_accounts');
    return saved ? JSON.parse(saved) : [];
  });

  const [mode, setMode] = useState<AuthMode>(isAddingAccount ? 'LOGIN' : (savedAccounts.length > 0 ? 'PICKER' : 'LOGIN'));
  const [step, setStep] = useState<AuthStep>('DETAILS');
  const [authMethod, setAuthMethod] = useState<AuthMethod>('PHONE'); 
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [foundProfile, setFoundProfile] = useState<UserProfile | null>(null);
  
  const otpInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 'VERIFY' && otpInputRef.current) {
      otpInputRef.current.focus();
    }
  }, [step]);

  const removeAccount = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = savedAccounts.filter(acc => acc.id !== id);
    setSavedAccounts(updated);
    localStorage.setItem('vixreel_saved_accounts', JSON.stringify(updated));
    if (updated.length === 0) setMode('LOGIN');
  };

  const switchAccount = async (account: AccountSession) => {
    setLoading(true);
    setError(null);
    try {
      const { error: sessionErr } = await supabase.auth.setSession({
        access_token: account.session_data.access_token,
        refresh_token: account.session_data.refresh_token
      });
      
      if (sessionErr) throw sessionErr;

      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error("Narrative session expired.");

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', authUser.id).maybeSingle();
      if (profile) onAuthSuccess(profile as any);
      else throw new Error("Identity profile mismatch.");
    } catch (err: any) {
      setError("Session expired. Please log in manually.");
      const updated = savedAccounts.filter(acc => acc.id !== account.id);
      setSavedAccounts(updated);
      localStorage.setItem('vixreel_saved_accounts', JSON.stringify(updated));
      setMode('LOGIN');
    } finally {
      setLoading(false);
    }
  };

  const formatPhone = (val: string) => {
    let cleaned = val.replace(/\D/g, '');
    return cleaned ? `+${cleaned}` : '';
  };

  const handleInitialAction = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    
    try {
      if (authMethod === 'PHONE') {
        const formattedPhone = formatPhone(phone);
        if (!formattedPhone || formattedPhone.length < 10) throw new Error("Enter valid phone (+1...)");
        const { error: otpErr } = await supabase.auth.signInWithOtp({ phone: formattedPhone });
        if (otpErr) throw otpErr;
        setStep('VERIFY');
      } else {
        if (mode === 'LOGIN') {
          const { data, error: loginErr } = await supabase.auth.signInWithPassword({ 
            email: email.trim(), 
            password 
          });
          if (loginErr) throw loginErr;
          if (data.user) {
            const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).maybeSingle();
            if (profile) onAuthSuccess(profile as any);
            else setStep('AVATAR');
          }
        } else {
          const { data, error: signUpErr } = await supabase.auth.signUp({ 
            email: email.trim(), 
            password, 
            options: { data: { username: email.split('@')[0] } }
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

  const handleFindAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const searchEmail = email.trim();
      if (!searchEmail) throw new Error("Email is required for lookup.");

      const { data, error: findErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', searchEmail)
        .maybeSingle();
      
      if (findErr) throw findErr;
      if (!data) throw new Error("No account found with this email signal.");
      
      setFoundProfile(data as UserProfile);
      setStep('RESULT');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendRecoveryCode = async (isResend = false) => {
    const targetEmail = foundProfile?.email || email.trim();
    if (!targetEmail) {
      setError("Target email missing.");
      return;
    }

    if (isResend) setResending(true);
    else setLoading(true);
    
    setError(null);
    setSuccessMsg(null);
    
    try {
      const { error: otpErr } = await supabase.auth.signInWithOtp({ 
        email: targetEmail,
        options: { shouldCreateUser: false }
      });
      
      if (otpErr) throw otpErr;
      
      setAuthMethod('EMAIL');
      setStep('VERIFY');
      setSuccessMsg("Access code transmitted via SMTP.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setResending(false);
    }
  };

  const handleVerifySignal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length < 6) return;
    setLoading(true);
    setError(null);
    try {
      const targetEmail = foundProfile?.email || email.trim();
      
      let verifyParams: any = {
        token: otpCode,
        type: authMethod === 'EMAIL' ? 'email' : 'sms',
      };
      
      if (authMethod === 'PHONE') {
        verifyParams.phone = formatPhone(phone);
      } else {
        verifyParams.email = targetEmail;
      }

      const { data, error: verifyErr } = await supabase.auth.verifyOtp(verifyParams);
      if (verifyErr) throw verifyErr;
      
      if (data.user) {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).maybeSingle();
        if (profile) onAuthSuccess(profile as any);
        else setStep('AVATAR');
      }
    } catch (err: any) { 
      setError(err.message); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleFinalizeIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) { setError("Username required"); return; }
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      let authUser = session?.user;

      if (!authUser) {
        const { data: { user: verifiedUser }, error: userError } = await supabase.auth.getUser();
        if (userError || !verifiedUser) throw new Error("No active session found. Please re-authenticate.");
        authUser = verifiedUser;
      }

      const activeUid = authUser.id;
      let finalAvatarUrl = `https://ui-avatars.com/api/?name=${username}`;

      if (avatarFile) {
        const ext = avatarFile.name.split('.').pop() || 'png';
        const filePath = `${activeUid}/avatar-${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarFile, { upsert: true });
        
        if (!uploadErr) {
          const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);
          finalAvatarUrl = publicUrl;
        }
      }
      
      const { data: profile, error: dbErr } = await supabase.from('profiles').upsert({
        id: activeUid,
        username: username.toLowerCase().trim(),
        avatar_url: finalAvatarUrl,
        email: authUser.email,
        phone: authUser.phone,
        updated_at: new Date().toISOString()
      }).select().single();
      
      if (dbErr) throw dbErr;
      onAuthSuccess(profile as any);
    } catch (err: any) { 
      setError(err.message); 
    } finally { 
      setLoading(false); 
    }
  };

  const renderPicker = () => (
    <div className="w-full space-y-10 animate-vix-in">
      <div className="space-y-3 text-center">
        <h3 className="text-[var(--vix-text)] font-black text-2xl uppercase tracking-tight">Identity Registry</h3>
        <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Select your narrative protocol</p>
      </div>

      <div className="space-y-4 max-h-[300px] overflow-y-auto no-scrollbar pr-2">
        {savedAccounts.map(acc => (
          <div 
            key={acc.id}
            onClick={() => switchAccount(acc)}
            className="group flex items-center justify-between p-6 bg-[var(--vix-bg)] border border-[var(--vix-border)] rounded-[2.5rem] hover:bg-[var(--vix-secondary)] hover:border-pink-500/30 cursor-pointer transition-all shadow-xl active:scale-[0.98]"
          >
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-full vix-gradient p-0.5 shadow-lg group-hover:scale-105 transition-transform">
                 <img src={acc.avatar_url || `https://ui-avatars.com/api/?name=${acc.username}`} className="w-full h-full rounded-full object-cover border-4 border-[var(--vix-bg)]" />
              </div>
              <div className="flex flex-col">
                 <span className="font-black text-lg text-[var(--vix-text)]">@{acc.username}</span>
                 <span className="text-[9px] text-zinc-700 font-black uppercase tracking-widest mt-1">Saved Session</span>
              </div>
            </div>
            <button 
              onClick={(e) => removeAccount(e, acc.id)}
              className="p-3 bg-[var(--vix-secondary)] rounded-2xl text-zinc-800 hover:text-red-500 hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/20"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="space-y-4 pt-4">
        <button 
          onClick={() => setMode('LOGIN')}
          className="w-full py-5 rounded-[2rem] border border-[var(--vix-border)] text-[var(--vix-text)] font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-3 hover:bg-[var(--vix-secondary)] transition-all"
        >
          <Plus className="w-4 h-4" /> Add Narrative
        </button>
        {isAddingAccount && (
          <button 
            onClick={onCancelAdd}
            className="w-full py-3 text-zinc-700 font-black uppercase tracking-widest text-[10px] hover:text-[var(--vix-text)] transition-all"
          >
            Relinquish Add
          </button>
        )}
      </div>
    </div>
  );

  const renderDetails = () => (
    <form onSubmit={handleInitialAction} className="w-full space-y-8 animate-vix-in">
      {savedAccounts.length > 0 && !isAddingAccount && (
        <button 
          type="button" 
          onClick={() => setMode('PICKER')}
          className="w-full py-3 text-[10px] font-black uppercase tracking-widest text-zinc-700 hover:text-pink-500 transition-colors flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Use Saved Identity
        </button>
      )}

      <div className="flex bg-[var(--vix-secondary)]/50 p-1 rounded-2xl border border-[var(--vix-border)] shadow-2xl">
        <button 
          type="button" 
          onClick={() => { setAuthMethod('PHONE'); setError(null); }} 
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${authMethod === 'PHONE' ? 'bg-[var(--vix-secondary)] text-[var(--vix-text)] shadow-lg' : 'text-zinc-600'}`}
        >
          <Smartphone className="w-4 h-4" /> Phone
        </button>
        <button 
          type="button" 
          onClick={() => { setAuthMethod('EMAIL'); setError(null); }} 
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${authMethod === 'EMAIL' ? 'bg-[var(--vix-secondary)] text-[var(--vix-text)] shadow-lg' : 'text-zinc-600'}`}
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
            className="w-full bg-[var(--vix-bg)] border border-[var(--vix-border)] rounded-2xl py-5 pl-16 pr-6 text-sm text-[var(--vix-text)] outline-none focus:border-pink-500/50 transition-all shadow-inner" 
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
              placeholder={mode === 'LOGIN' ? "Secure Password" : "Create Password"} 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              className="w-full bg-[var(--vix-bg)] border border-[var(--vix-border)] rounded-2xl py-5 pl-16 pr-6 text-sm text-[var(--vix-text)] outline-none focus:border-pink-500/50 transition-all shadow-inner" 
              required 
            />
          </div>
        )}
      </div>

      <div className="flex justify-between items-center px-2">
        {mode === 'LOGIN' && (
          <button 
            type="button"
            onClick={() => { setMode('FIND_ACCOUNT'); setStep('DETAILS'); setError(null); setSuccessMsg(null); }}
            className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest hover:text-[var(--vix-text)] transition-colors"
          >
            Recover Identity
          </button>
        )}
      </div>

      <button type="submit" disabled={loading} className="w-full vix-gradient py-5 rounded-[2rem] text-white font-black uppercase tracking-[0.2em] text-[11px] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3">
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
          <>{mode === 'LOGIN' ? 'Access Void' : 'Begin Narrative'} <ArrowRight className="w-4 h-4" /></>
        )}
      </button>
    </form>
  );

  return (
    <div className="min-h-screen bg-[var(--vix-bg)] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 vix-gradient opacity-50"></div>
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-pink-500/10 blur-[150px] rounded-full"></div>
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-500/10 blur-[150px] rounded-full"></div>

      <div className="w-full max-w-[480px] z-10 space-y-6">
        <div className="bg-[var(--vix-card)] border border-[var(--vix-border)] rounded-[4rem] p-10 sm:p-16 flex flex-col items-center shadow-2xl ring-1 ring-white/5 relative">
          <div className="mb-12 text-center space-y-4">
             <h1 className="logo-font text-6xl vix-text-gradient drop-shadow-2xl">VixReel</h1>
             <div className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.4em] text-zinc-700">
                <Zap className="w-3 h-3 text-pink-500 fill-current" /> Social Narrative Protocol
             </div>
          </div>

          {mode === 'PICKER' ? renderPicker() : (
            <>
              {mode !== 'FIND_ACCOUNT' && mode !== 'PICKER' && (
                <div className="w-full mb-10 flex justify-center gap-10">
                  <button onClick={() => { setMode('LOGIN'); setStep('DETAILS'); setError(null); }} className={`text-[11px] font-black uppercase tracking-widest pb-2 border-b-2 transition-all ${mode === 'LOGIN' ? 'text-[var(--vix-text)] border-pink-500' : 'text-zinc-700 border-transparent hover:text-zinc-400'}`}>Login</button>
                  <button onClick={() => { setMode('SIGNUP'); setStep('DETAILS'); setError(null); }} className={`text-[11px] font-black uppercase tracking-widest pb-2 border-b-2 transition-all ${mode === 'SIGNUP' ? 'text-[var(--vix-text)] border-pink-500' : 'text-zinc-700 border-transparent hover:text-zinc-400'}`}>Sign Up</button>
                </div>
              )}

              {mode === 'FIND_ACCOUNT' && step === 'DETAILS' && (
                <div className="w-full space-y-8 animate-vix-in">
                  <div className="flex items-center gap-4 mb-4">
                    <button onClick={() => { setMode('LOGIN'); setStep('DETAILS'); setError(null); }} className="p-3 bg-[var(--vix-secondary)] rounded-2xl text-zinc-500 hover:text-[var(--vix-text)] transition-all"><ArrowLeft className="w-4 h-4" /></button>
                    <h3 className="text-[var(--vix-text)] font-black text-xl uppercase tracking-tight">Recover Session</h3>
                  </div>
                  <form onSubmit={handleFindAccount} className="space-y-6">
                    <div className="group relative">
                      <div className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-700 group-focus-within:text-pink-500 transition-colors"><Mail className="w-5 h-5" /></div>
                      <input 
                        type="email" 
                        placeholder="Identity Email" 
                        value={email} 
                        onChange={e => setEmail(e.target.value)} 
                        className="w-full bg-[var(--vix-bg)] border border-[var(--vix-border)] rounded-2xl py-5 pl-16 pr-6 text-sm text-[var(--vix-text)] outline-none focus:border-pink-500/50 transition-all shadow-inner" 
                        required 
                      />
                    </div>
                    <button type="submit" disabled={loading} className="w-full vix-gradient py-5 rounded-[2rem] text-white font-black uppercase tracking-[0.2em] text-[11px] shadow-2xl flex items-center justify-center gap-3">
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Search className="w-4 h-4" /> Locate Account</>}
                    </button>
                  </form>
                </div>
              )}

              {mode === 'FIND_ACCOUNT' && step === 'RESULT' && foundProfile && (
                <div className="w-full space-y-10 animate-vix-in text-center">
                  <div className="space-y-4">
                    <h3 className="text-[var(--vix-text)] font-black text-2xl uppercase tracking-tight">Account Found</h3>
                    <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">We located your identity signal</p>
                  </div>
                  <div className="bg-[var(--vix-bg)] border border-[var(--vix-border)] rounded-[3rem] p-8 space-y-6 shadow-2xl ring-1 ring-white/5">
                    <div className="relative w-24 h-24 mx-auto">
                       <img src={foundProfile.avatar_url || `https://ui-avatars.com/api/?name=${foundProfile.username}`} className="w-full h-full rounded-full border-4 border-[var(--vix-border)] object-cover shadow-2xl" />
                       {foundProfile.is_verified && (
                         <div className="absolute -bottom-1 -right-1">
                            <VerificationBadge size="w-6 h-6" />
                         </div>
                       )}
                    </div>
                    <div className="space-y-1">
                       <p className="text-xl font-black text-[var(--vix-text)]">@{foundProfile.username}</p>
                       <p className="text-[10px] text-zinc-700 font-black uppercase tracking-widest">{foundProfile.full_name || 'Individual Creator'}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <button onClick={() => handleSendRecoveryCode()} disabled={loading} className="w-full vix-gradient py-5 rounded-[2rem] text-white font-black uppercase tracking-widest text-[11px] shadow-2xl flex items-center justify-center gap-3">
                       {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Key className="w-4 h-4" /> Send Access Code</>}
                    </button>
                    <button onClick={() => setStep('DETAILS')} className="text-[10px] text-zinc-700 font-bold uppercase tracking-widest hover:text-[var(--vix-text)] transition-all">Not your account?</button>
                  </div>
                </div>
              )}

              {step === 'DETAILS' && mode !== 'FIND_ACCOUNT' && renderDetails()}
              
              {step === 'VERIFY' && (
                <div className="w-full space-y-10 animate-vix-in text-center">
                  <div className="space-y-2">
                    <h3 className="text-[var(--vix-text)] font-black text-2xl uppercase tracking-tight">Identity Check</h3>
                    <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Verify your {authMethod === 'EMAIL' ? 'email' : 'phone'} signal</p>
                  </div>
                  <div className="relative">
                    <input 
                      ref={otpInputRef}
                      type="text" 
                      placeholder="••••••" 
                      value={otpCode} 
                      onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))} 
                      className="w-full bg-[var(--vix-bg)] border border-[var(--vix-border)] rounded-3xl py-8 text-center text-5xl font-black text-[var(--vix-text)] outline-none focus:border-pink-500/50 transition-all tracking-[0.5em] shadow-inner" 
                      maxLength={6} 
                    />
                  </div>
                  <div className="space-y-4">
                    <button onClick={handleVerifySignal} disabled={loading || otpCode.length < 6} className="w-full vix-gradient py-6 rounded-[2rem] text-white font-black uppercase tracking-[0.2em] text-[12px] shadow-2xl active:scale-95 transition-all">
                      {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : 'Enter Void'}
                    </button>
                    <div className="flex items-center justify-center gap-6">
                      <button 
                        onClick={() => handleSendRecoveryCode(true)} 
                        disabled={resending}
                        className="text-[10px] text-zinc-700 font-bold uppercase tracking-[0.3em] hover:text-[var(--vix-text)] transition-colors flex items-center gap-2"
                      >
                        {resending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        Resend Code
                      </button>
                      <button onClick={() => { setStep('DETAILS'); setError(null); setSuccessMsg(null); }} className="text-[10px] text-zinc-700 font-bold uppercase tracking-[0.3em] hover:text-[var(--vix-text)] transition-colors">Change Method</button>
                    </div>
                  </div>
                </div>
              )}

              {step === 'AVATAR' && (
                <form onSubmit={handleFinalizeIdentity} className="w-full space-y-10 animate-vix-in text-center">
                  <div className="space-y-2">
                    <h3 className="text-[var(--vix-text)] font-black text-2xl uppercase tracking-tight">Finalize Narrative</h3>
                    <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Choose your handle</p>
                  </div>
                  <div className="relative w-36 h-36 mx-auto group cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
                    <div className="w-full h-full rounded-full border-4 border-[var(--vix-border)] overflow-hidden bg-[var(--vix-bg)] flex items-center justify-center shadow-2xl transition-all group-hover:border-pink-500/30">
                      {avatarUrl ? <img src={avatarUrl} className="w-full h-full object-cover" /> : <Camera className="w-10 h-10 text-zinc-800 group-hover:text-pink-500 transition-colors" />}
                    </div>
                    <div className="absolute bottom-1 right-1 bg-pink-500 rounded-full p-2 border-4 border-[var(--vix-card)] shadow-lg">
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <input ref={avatarInputRef} type="file" className="hidden" accept="image/*" onChange={e => { 
                      const f = e.target.files?.[0]; 
                      if (f) { 
                        setAvatarFile(f); 
                        setAvatarUrl(URL.createObjectURL(f)); 
                      } 
                    }} />
                  </div>
                  <input 
                    type="text" 
                    placeholder="@handle" 
                    value={username} 
                    onChange={e => setUsername(e.target.value)} 
                    className="w-full bg-[var(--vix-bg)] border border-[var(--vix-border)] rounded-2xl py-5 text-center text-lg font-black text-[var(--vix-text)] outline-none focus:border-pink-500/50 transition-all" 
                    required 
                  />
                  <button type="submit" disabled={loading} className="w-full vix-gradient py-6 rounded-[2.5rem] text-white font-black uppercase tracking-widest text-[12px] shadow-2xl shadow-pink-500/20">
                    {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : 'Activate Protocol'}
                  </button>
                </form>
              )}
            </>
          )}

          {successMsg && (
            <div className="mt-8 text-green-500 text-[9px] font-black uppercase tracking-[0.2em] bg-green-500/5 p-4 rounded-xl border border-green-500/10 w-full text-center flex items-center justify-center gap-2">
              <CheckCircle2 className="w-3 h-3" /> {successMsg}
            </div>
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
