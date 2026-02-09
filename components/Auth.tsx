
import React, { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { UserProfile } from '../types';
import { 
  Loader2, 
  Search,
  ArrowLeft,
  KeyRound,
  User,
  Camera
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

  const toggleMode = (newMode: AuthMode) => {
    setError(null);
    setSuccessMsg(null);
    setStep('DETAILS');
    setMode(newMode);
    setOtpCode('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const loginData = authMethod === 'EMAIL' 
        ? { email, password } 
        : { phone, password };

      const { data, error: loginErr } = await supabase.auth.signInWithPassword(loginData);
      
      if (loginErr) {
        if (loginErr.message.includes("confirmed")) {
          setError("Account not verified.");
          if (authMethod === 'PHONE') setStep('VERIFY');
          return;
        }
        throw loginErr;
      }
      if (data.user) onAuthSuccess(data.user as any);
    } catch (err: any) {
      setError(err.message || "Invalid credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (step === 'DETAILS') {
      if (!username.trim()) { setError("Username required."); return; }
      if (password.length < 6) { setError("Password 6+ chars."); return; }
      setLoading(true);
      try {
        const options = { data: { username: username.toLowerCase().trim(), full_name: fullName.trim() || username.trim() } };
        const signupData: any = authMethod === 'EMAIL' ? { email, password, options } : { phone, password, options };
        const { error: signError } = await supabase.auth.signUp(signupData);
        if (signError) throw signError;
        if (authMethod === 'PHONE') setStep('VERIFY');
        else setStep('AVATAR');
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
      // FIX: Ensure ONLY email or phone is sent, not both with empty values
      const otpParams: { email?: string; phone?: string } = {};
      if (authMethod === 'PHONE') {
        if (!phone) throw new Error("Phone number required.");
        otpParams.phone = phone;
      } else {
        if (!email) throw new Error("Email address required.");
        otpParams.email = email;
      }

      const { error: otpErr } = await supabase.auth.signInWithOtp(otpParams);
      if (otpErr) throw otpErr;
      setStep('VERIFY');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const type = mode === 'SIGNUP' ? 'signup' : 'sms';
      const verifyPayload: any = { token: otpCode, type };
      if (authMethod === 'PHONE') verifyPayload.phone = phone;
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
      setError("Invalid code.");
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
      setSuccessMsg("Success! Logging in...");
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
      setError("Setup failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 relative overflow-y-auto">
      {isAddingAccount && (
        <button onClick={onCancelAdd} className="absolute top-8 left-8 text-zinc-600 hover:text-white flex items-center gap-2 font-bold text-xs uppercase tracking-widest"><ArrowLeft className="w-4 h-4" /> Cancel</button>
      )}

      <div className="w-full max-w-[350px] space-y-6 z-10 animate-vix-in">
        <div className="bg-zinc-950 border border-zinc-900 rounded-sm p-10 flex flex-col items-center shadow-2xl">
          <h1 className="logo-font text-5xl vix-text-gradient mb-8">VixReel</h1>

          {mode === 'LOGIN' && step === 'DETAILS' && (
            <form onSubmit={handleLogin} className="w-full space-y-4">
              <div className="flex bg-zinc-900 p-1 rounded-lg">
                 <button type="button" onClick={() => setAuthMethod('PHONE')} className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-md transition-all ${authMethod === 'PHONE' ? 'bg-zinc-800 text-white' : 'text-zinc-600'}`}>Phone</button>
                 <button type="button" onClick={() => setAuthMethod('EMAIL')} className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-md transition-all ${authMethod === 'EMAIL' ? 'bg-zinc-800 text-white' : 'text-zinc-600'}`}>Email</button>
              </div>
              <input type={authMethod === 'EMAIL' ? 'email' : 'tel'} placeholder={authMethod === 'EMAIL' ? 'Email' : 'Phone Number'} value={authMethod === 'EMAIL' ? email : phone} onChange={e => authMethod === 'EMAIL' ? setEmail(e.target.value) : setPhone(e.target.value)} className="vix-input" required />
              <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="vix-input" required />
              <button type="submit" disabled={loading} className="vix-btn-primary mt-2">{loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Log In'}</button>
              <button type="button" onClick={() => toggleMode('FIND_ACCOUNT')} className="w-full text-center text-[10px] text-zinc-600 hover:text-pink-500 font-bold uppercase mt-4 tracking-widest">Find your account</button>
            </form>
          )}

          {mode === 'SIGNUP' && step === 'DETAILS' && (
            <form onSubmit={handleSignup} className="w-full space-y-4">
              <input type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} className="vix-input" required />
              <input type="text" placeholder="Full Name" value={fullName} onChange={e => setFullName(e.target.value)} className="vix-input" />
              <div className="flex bg-zinc-900 p-1 rounded-lg">
                 <button type="button" onClick={() => setAuthMethod('PHONE')} className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-md ${authMethod === 'PHONE' ? 'bg-zinc-800 text-white' : 'text-zinc-600'}`}>Phone</button>
                 <button type="button" onClick={() => setAuthMethod('EMAIL')} className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-md ${authMethod === 'EMAIL' ? 'bg-zinc-800 text-white' : 'text-zinc-600'}`}>Email</button>
              </div>
              <input type={authMethod === 'EMAIL' ? 'email' : 'tel'} placeholder={authMethod === 'EMAIL' ? 'Email' : 'Phone Number'} value={authMethod === 'EMAIL' ? email : phone} onChange={e => authMethod === 'EMAIL' ? setEmail(e.target.value) : setPhone(e.target.value)} className="vix-input" required />
              <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="vix-input" required />
              <button type="submit" disabled={loading} className="vix-btn-primary mt-2">{loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Sign Up'}</button>
            </form>
          )}

          {mode === 'FIND_ACCOUNT' && step === 'DETAILS' && (
            <form onSubmit={handleFindAccount} className="w-full space-y-4 text-center">
              <h3 className="text-white font-bold text-lg mb-2">Account Recovery</h3>
              <div className="flex bg-zinc-900 p-1 rounded-lg mb-2">
                 <button type="button" onClick={() => setAuthMethod('PHONE')} className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-md ${authMethod === 'PHONE' ? 'bg-zinc-800 text-white' : 'text-zinc-600'}`}>Phone</button>
                 <button type="button" onClick={() => setAuthMethod('EMAIL')} className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-md ${authMethod === 'EMAIL' ? 'bg-zinc-800 text-white' : 'text-zinc-600'}`}>Email</button>
              </div>
              <input type={authMethod === 'EMAIL' ? 'email' : 'tel'} placeholder={authMethod === 'EMAIL' ? 'Email address' : 'Phone Number'} value={authMethod === 'EMAIL' ? email : phone} onChange={e => authMethod === 'EMAIL' ? setEmail(e.target.value) : setPhone(e.target.value)} className="vix-input" required />
              <button type="submit" disabled={loading} className="vix-btn-primary mt-2">{loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Send Code'}</button>
              <button type="button" onClick={() => toggleMode('LOGIN')} className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mt-4">Back to Login</button>
            </form>
          )}

          {mode === 'RESET_PASSWORD' && (
            <form onSubmit={handleResetPassword} className="w-full space-y-4 text-center">
              <h3 className="text-white font-bold text-lg">New Password</h3>
              <input type="password" placeholder="Enter new password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="vix-input" required />
              <button type="submit" disabled={loading} className="vix-btn-primary mt-2">Update Password</button>
            </form>
          )}

          {step === 'VERIFY' && (
            <form onSubmit={handleVerifyOtp} className="w-full space-y-4 text-center">
              <h3 className="text-white font-bold text-lg">Verification</h3>
              <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">Code sent to {authMethod === 'PHONE' ? phone : email}</p>
              <input type="text" placeholder="000000" value={otpCode} onChange={e => setOtpCode(e.target.value)} className="vix-input text-center text-2xl tracking-[0.5em] font-black" maxLength={6} required />
              <button type="submit" disabled={loading} className="vix-btn-primary mt-2">Verify</button>
            </form>
          )}

          {step === 'AVATAR' && (
            <form onSubmit={handleFinalize} className="w-full space-y-4 text-center">
              <div className="w-24 h-24 rounded-full border-2 border-zinc-900 mx-auto flex items-center justify-center overflow-hidden bg-zinc-900 shadow-xl">{avatarUrl ? <img src={avatarUrl} className="w-full h-full object-cover" /> : <User className="w-10 h-10 text-zinc-800" />}</div>
              <label className="block w-full py-3 bg-zinc-900 rounded-xl text-[10px] font-black uppercase text-zinc-500 border border-zinc-800 cursor-pointer">Upload Photo<input type="file" className="hidden" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) { setAvatarFile(f); setAvatarUrl(URL.createObjectURL(f)); } }}/></label>
              <button type="submit" disabled={loading} className="vix-btn-primary mt-2">Finish</button>
            </form>
          )}

          {error && <div className="mt-4 text-red-500 text-[10px] font-black uppercase tracking-widest bg-red-500/10 p-3 rounded-lg border border-red-500/20 w-full text-center">{error}</div>}
          {successMsg && <div className="mt-4 text-green-500 text-[10px] font-black uppercase tracking-widest bg-green-500/10 p-3 rounded-lg border border-green-500/20 w-full text-center">{successMsg}</div>}
        </div>

        <div className="bg-zinc-950 border border-zinc-900 rounded-sm p-6 text-center">
          <p className="text-sm text-zinc-500">{mode === 'LOGIN' ? "Don't have an account?" : "Already have an account?"}{' '}<button onClick={() => toggleMode(mode === 'LOGIN' ? 'SIGNUP' : 'LOGIN')} className="text-pink-500 font-bold hover:underline">{mode === 'LOGIN' ? 'Sign up' : 'Log in'}</button></p>
        </div>
      </div>
      <style>{`
        .vix-input { width: 100%; background: #09090b; border: 1px solid #18181b; border-radius: 4px; padding: 12px 14px; font-size: 14px; color: white; outline: none; }
        .vix-input:focus { border-color: #ff0080; }
        .vix-btn-primary { width: 100%; background: #ff0080; padding: 14px; border-radius: 8px; font-size: 12px; font-weight: 900; color: white; text-transform: uppercase; letter-spacing: 0.1em; }
      `}</style>
    </div>
  );
};

export default Auth;
