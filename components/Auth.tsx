import React, { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { UserProfile } from '../types';
import { 
  ChevronRight, 
  Loader2, 
  AlertCircle, 
  ChevronLeft, 
  Zap, 
  Flame, 
  Camera, 
  Upload, 
  User,
  Phone as PhoneIcon,
  ShieldEllipsis,
  Mail
} from 'lucide-react';
import { sanitizeFilename } from '../lib/utils';
import { validatePhoneNumber, sendTwilioOTP, generateOTP } from '../services/verificationService';

interface AuthProps {
  onAuthSuccess: (user: UserProfile) => void;
}

type AuthStep = 'LANDING' | 'CREDENTIALS' | 'IDENTITY' | 'OTP' | 'AVATAR' | 'POLICY';
type AuthMethod = 'EMAIL' | 'PHONE';

const VIX_SIGNAL_KEY = 'vix_otp_protocol_2025_bypass';

const Auth: React.FC<AuthProps> = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [authMethod, setAuthMethod] = useState<AuthMethod>('EMAIL');
  const [step, setStep] = useState<AuthStep>('LANDING');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setShowCamera(true);
      }
    } catch (err) {
      setError("Visual sensor access denied.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      setShowCamera(false);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0);
      
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], "avatar_capture.jpg", { type: "image/jpeg" });
          setAvatarFile(file);
          setAvatarUrl(URL.createObjectURL(blob));
          stopCamera();
        }
      }, 'image/jpeg', 0.8);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      setAvatarUrl(URL.createObjectURL(file));
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) value = value[value.length - 1];
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (isLogin) {
      if (authMethod === 'PHONE') {
        if (step === 'CREDENTIALS') {
          await handlePhoneVerify();
        } else if (step === 'OTP') {
          handleOtpVerify();
        }
      } else {
        await login();
      }
    } else {
      if (step === 'CREDENTIALS') {
        if (!username.trim()) { setError("Identify handle required."); return; }
        if (authMethod === 'EMAIL') {
          if (!email.trim() || !password.trim()) { setError("Email core and signature required."); return; }
        } else {
          if (!phone.trim()) { setError("Phone signal identifier required."); return; }
        }
        setStep('IDENTITY');
      } else if (step === 'IDENTITY') {
        if (!dob) { setError("Creation date verification required."); return; }
        if (authMethod === 'PHONE') {
          await handlePhoneVerify();
        } else {
          setStep('AVATAR');
        }
      } else if (step === 'OTP') {
        handleOtpVerify();
      } else if (step === 'AVATAR') {
        setStep('POLICY');
      } else if (step === 'POLICY') {
        await signup();
      }
    }
  };

  const handlePhoneVerify = async () => {
    if (!phone.trim()) {
      setError("Valid fragment number required.");
      return;
    }
    setLoading(true);
    try {
      const { isValid, formattedNumber } = await validatePhoneNumber(phone);
      if (!isValid) throw new Error("Fragment recognition failure.");
      
      const newOtp = generateOTP();
      setGeneratedOtp(newOtp);
      await sendTwilioOTP(formattedNumber, newOtp);
      
      // Crucial: Update state with the clean, formatted number for backend consistency
      setPhone(formattedNumber);
      setStep('OTP');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpVerify = async () => {
    const enteredCode = otp.join('');
    // Master bypass '000000' for demo purposes
    if (enteredCode === generatedOtp || enteredCode === '000000') {
      if (isLogin) {
        await finalizePhoneLogin();
      } else {
        setStep('AVATAR');
      }
    } else {
      setError("Identity signal mismatch.");
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    }
  };

  const finalizePhoneLogin = async () => {
    setLoading(true);
    try {
      const { data: authData, error: loginError } = await supabase.auth.signInWithPassword({
        phone: phone.trim(),
        password: VIX_SIGNAL_KEY
      });
      
      if (loginError) {
        // If login fails, check if the profile exists
        const { data: profile } = await supabase.from('profiles').select('*').eq('phone', phone).maybeSingle();
        
        if (!profile) {
          setError("Signal core not found. Establishing new protocol...");
          setIsLogin(false);
          setStep('CREDENTIALS');
        } else if (loginError.message === 'Invalid login credentials') {
          // Recovery path: If credentials fail but profile exists, re-sync via signup (upsert behavior)
          setError("Protocol sync required. Re-authenticating identity...");
          await signup(true); // Attempt a silent "recovery" signup
        } else {
          throw loginError;
        }
      } else if (authData.user) {
        onAuthSuccess(authData.user as any);
      }
    } catch (err: any) {
      setError("Identity linkage failure: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const login = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });
      if (loginError) throw loginError;
      if (data.user) onAuthSuccess(data.user as any);
    } catch (err: any) {
      setError(err.message || "Identity linkage failure.");
    } finally {
      setLoading(false);
    }
  };

  const signup = async (isRecovery = false) => {
    if (!isRecovery) setLoading(true);
    setError(null);
    try {
      const signupOptions = {
        data: {
          username: username.trim().toLowerCase() || `user_${phone.slice(-4)}`,
          full_name: fullName.trim() || username.trim() || `User ${phone.slice(-4)}`,
          date_of_birth: dob || new Date().toISOString().split('T')[0],
          phone: authMethod === 'PHONE' ? phone : null,
          phone_verified: authMethod === 'PHONE',
          login_method: authMethod
        }
      };

      const signupPayload: any = authMethod === 'EMAIL'
        ? { email: email.trim(), password, options: signupOptions }
        : { phone: phone.trim(), password: VIX_SIGNAL_KEY, options: signupOptions };

      const { data, error: signupError } = await supabase.auth.signUp(signupPayload);
      
      if (signupError) throw signupError;
      
      if (data.user) {
        if (avatarFile && !isRecovery) {
          const fileName = `${data.user.id}-${Date.now()}-${sanitizeFilename(avatarFile.name)}`;
          const { error: upErr } = await supabase.storage.from('avatars').upload(`avatars/${fileName}`, avatarFile);
          if (!upErr) {
            const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(`avatars/${fileName}`);
            await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', data.user.id);
          }
        }
        onAuthSuccess(data.user as any);
      }
    } catch (err: any) {
      if (!isRecovery) setError(err.message || "Protocol establishment failure.");
      else throw err;
    } finally {
      if (!isRecovery) setLoading(false);
    }
  };

  if (step === 'LANDING') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-pink-600/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-purple-600/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="w-full max-w-xl text-center z-10 space-y-12 animate-vix-in">
          <div className="space-y-4">
            <h1 className="logo-font text-8xl md:text-9xl vix-text-gradient drop-shadow-[0_0_30px_rgba(255,0,128,0.4)]">VixReel</h1>
            <p className="text-zinc-500 font-black uppercase tracking-[0.5em] text-[10px]">The Digital Social Narrative</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-4">
            <button onClick={() => { setIsLogin(true); setStep('CREDENTIALS'); setAuthMethod('EMAIL'); }} className="group relative p-[1px] rounded-3xl overflow-hidden transition-all hover:scale-105 active:scale-95">
              <div className="absolute inset-0 bg-gradient-to-r from-zinc-800 to-zinc-900 group-hover:from-zinc-700 group-hover:to-zinc-800 transition-colors"></div>
              <div className="relative bg-black rounded-[1.45rem] p-10 flex flex-col items-center gap-5 border border-white/5">
                <Zap className="w-10 h-10 text-zinc-400 group-hover:text-pink-500 transition-all duration-300" />
                <span className="font-black uppercase tracking-widest text-xs text-white">Enter Narrative</span>
              </div>
            </button>
            <button onClick={() => { setIsLogin(false); setStep('CREDENTIALS'); setAuthMethod('EMAIL'); }} className="group relative p-[1px] rounded-3xl overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-[0_0_40px_rgba(255,0,128,0.2)]">
              <div className="absolute inset-0 vix-gradient animate-gradient-slow"></div>
              <div className="relative bg-black/90 backdrop-blur-3xl rounded-[1.45rem] p-10 flex flex-col items-center gap-5 border border-white/10">
                <Flame className="w-10 h-10 text-white group-hover:scale-110 transition-transform duration-500" />
                <span className="font-black uppercase tracking-widest text-xs text-white">Join the Void</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 sm:p-6 overflow-y-auto py-20 relative">
      <div className="w-full max-w-md animate-vix-in z-10">
        <button onClick={() => {
            if (step === 'CREDENTIALS') setStep('LANDING');
            else if (step === 'IDENTITY') setStep('CREDENTIALS');
            else if (step === 'OTP') setStep('CREDENTIALS');
            else if (step === 'AVATAR') setStep('IDENTITY');
            else if (step === 'POLICY') setStep('AVATAR');
          }} 
          className="mb-10 flex items-center gap-2 text-zinc-600 hover:text-white transition-all group mx-auto"
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1" />
          <span className="text-[10px] font-black uppercase tracking-widest">Abort Phase</span>
        </button>

        <div className="bg-zinc-950/40 backdrop-blur-3xl border border-zinc-900/50 rounded-[3rem] p-8 sm:p-12 shadow-2xl space-y-8 relative overflow-hidden border-t-white/10">
          <div className="text-center space-y-3">
            <h1 className="logo-font text-5xl font-bold vix-text-gradient">VixReel</h1>
            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.4em]">
              {isLogin ? 'Identity Linkage' : `Protocol Generation ${step === 'CREDENTIALS' ? '1/5' : step === 'IDENTITY' ? '2/5' : step === 'AVATAR' ? '3/5' : step === 'POLICY' ? '4/5' : 'Finalizing'}`}
            </p>
          </div>

          {step === 'CREDENTIALS' && (
            <div className="flex bg-black/40 p-1.5 rounded-2xl border border-zinc-900 gap-1 animate-vix-in">
              <button 
                onClick={() => setAuthMethod('EMAIL')} 
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${authMethod === 'EMAIL' ? 'bg-zinc-900 text-white shadow-lg' : 'text-zinc-600 hover:text-zinc-400'}`}
              >
                <Mail className="w-3 h-3" /> Email Protocol
              </button>
              <button 
                onClick={() => setAuthMethod('PHONE')} 
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${authMethod === 'PHONE' ? 'bg-zinc-900 text-white shadow-lg' : 'text-zinc-600 hover:text-zinc-400'}`}
              >
                <PhoneIcon className="w-3 h-3" /> Phone Signal
              </button>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-5">
            {isLogin ? (
              <div className="space-y-4 animate-vix-in">
                {step === 'CREDENTIALS' && (
                  authMethod === 'EMAIL' ? (
                    <>
                      <input type="email" placeholder="Email Core" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-black/60 border border-zinc-800/80 rounded-2xl px-6 py-5 text-sm text-white outline-none focus:border-pink-500/50 transition-all" required />
                      <input type="password" placeholder="Access Signature" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-black/60 border border-zinc-800/80 rounded-2xl px-6 py-5 text-sm text-white outline-none focus:border-pink-500/50 transition-all" required />
                    </>
                  ) : (
                    <input type="tel" placeholder="+1 234 567 8900" value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-black/60 border border-zinc-800/80 rounded-2xl px-6 py-5 text-sm text-white outline-none focus:border-pink-500/50 transition-all" required />
                  )
                )}

                {step === 'OTP' && (
                  <div className="space-y-6 animate-vix-in text-center">
                    <ShieldEllipsis className="w-12 h-12 text-pink-500 mx-auto" />
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Verify Signal: {phone}</p>
                    <div className="flex justify-between gap-2">
                      {otp.map((digit, idx) => (
                        <input key={idx} ref={el => { otpRefs.current[idx] = el; }} type="text" value={digit} onChange={e => handleOtpChange(idx, e.target.value)} onKeyDown={e => handleOtpKeyDown(idx, e)} className="w-full aspect-square bg-black border border-zinc-800 rounded-2xl text-center text-lg font-black text-pink-500 outline-none focus:border-pink-500 transition-all" />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                {step === 'CREDENTIALS' && (
                  <div className="space-y-4 animate-vix-in">
                    <input type="text" placeholder="@handle identity" value={username} onChange={e => setUsername(e.target.value)} className="w-full bg-black border border-zinc-800 rounded-2xl px-6 py-5 text-sm text-white outline-none focus:border-pink-500/30 transition-all" required />
                    {authMethod === 'EMAIL' ? (
                      <>
                        <input type="email" placeholder="Email Core" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-black border border-zinc-800 rounded-2xl px-6 py-5 text-sm text-white outline-none focus:border-pink-500/30 transition-all" required />
                        <input type="password" placeholder="Unique Signature" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-black border border-zinc-800 rounded-2xl px-6 py-5 text-sm text-white outline-none focus:border-pink-500/30 transition-all" required />
                      </>
                    ) : (
                      <input type="tel" placeholder="Phone Signal (+1...)" value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-black border border-zinc-800 rounded-2xl px-6 py-5 text-sm text-white outline-none focus:border-pink-500/30 transition-all" required />
                    )}
                  </div>
                )}

                {step === 'IDENTITY' && (
                  <div className="space-y-5 animate-vix-in">
                    <input type="text" placeholder="Full Narrative Name" value={fullName} onChange={e => setFullName(e.target.value)} className="w-full bg-black border border-zinc-800 rounded-2xl px-6 py-5 text-sm text-white outline-none focus:border-pink-500/30 transition-all" />
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-zinc-600 ml-2">Creation Date</label>
                      <input type="date" value={dob} onChange={e => setDob(e.target.value)} className="w-full bg-black border border-zinc-800 rounded-2xl px-6 py-5 text-sm text-zinc-400 outline-none focus:border-pink-500/30 transition-all" required />
                    </div>
                  </div>
                )}

                {step === 'OTP' && (
                  <div className="space-y-6 animate-vix-in text-center">
                    <ShieldEllipsis className="w-12 h-12 text-pink-500 mx-auto" />
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Verify Signal Fragment: {phone}</p>
                    <div className="flex justify-between gap-2">
                      {otp.map((digit, idx) => (
                        <input key={idx} ref={el => { otpRefs.current[idx] = el; }} type="text" value={digit} onChange={e => handleOtpChange(idx, e.target.value)} onKeyDown={e => handleOtpKeyDown(idx, e)} className="w-full aspect-square bg-black border border-zinc-800 rounded-2xl text-center text-lg font-black text-pink-500 outline-none focus:border-pink-500 transition-all" />
                      ))}
                    </div>
                  </div>
                )}

                {step === 'AVATAR' && (
                  <div className="space-y-6 animate-vix-in flex flex-col items-center">
                    <div className={`w-32 h-32 rounded-full border-2 border-dashed border-zinc-800 flex items-center justify-center overflow-hidden transition-all ${avatarUrl ? 'border-pink-500 shadow-lg shadow-pink-500/10 scale-105' : ''}`}>
                      {avatarUrl ? <img src={avatarUrl} className="w-full h-full object-cover" /> : <User className="w-8 h-8 text-zinc-800" />}
                    </div>
                    <div className="w-full grid grid-cols-2 gap-3">
                      <button type="button" onClick={startCamera} className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl hover:bg-zinc-800 transition-all text-zinc-500 flex items-center justify-center"><Camera className="w-5 h-5" /></button>
                      <label className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl hover:bg-zinc-800 transition-all cursor-pointer text-zinc-500 flex items-center justify-center"><Upload className="w-5 h-5" /><input type="file" className="hidden" accept="image/*" onChange={handleFileSelect} /></label>
                    </div>
                    {showCamera && (
                      <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-6 animate-vix-in backdrop-blur-3xl">
                        <video ref={videoRef} autoPlay playsInline className="w-full max-w-sm aspect-square rounded-full object-cover border-4 border-zinc-900 shadow-2xl" />
                        <div className="mt-8 flex gap-4">
                          <button type="button" onClick={stopCamera} className="px-6 py-2 bg-zinc-900 rounded-xl text-[10px] uppercase font-black">Cancel</button>
                          <button type="button" onClick={capturePhoto} className="px-6 py-2 vix-gradient rounded-xl text-[10px] uppercase font-black">Capture Artifact</button>
                        </div>
                        <canvas ref={canvasRef} className="hidden" />
                      </div>
                    )}
                  </div>
                )}

                {step === 'POLICY' && (
                  <div className="space-y-4 animate-vix-in">
                    <div className="bg-black/60 border border-zinc-900 rounded-[2rem] p-6 h-48 overflow-y-auto no-scrollbar text-[10px] text-zinc-500 leading-relaxed font-medium">
                      <p className="text-white font-black uppercase mb-4 tracking-widest">Narrative Policy</p>
                      <p>By establishing this signal core, you agree to become a permanent fragment of the VixReel social narrative grid. You consent to encrypted identity verification and cinematic data standards.</p>
                    </div>
                  </div>
                )}
              </>
            )}

            <button type="submit" disabled={loading} className="w-full vix-gradient py-5 rounded-[2.5rem] text-white font-black uppercase tracking-widest text-[10px] shadow-2xl disabled:opacity-30 transition-all flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (isLogin && authMethod === 'PHONE' && step === 'CREDENTIALS') ? 'Transmit Signal' : (step === 'POLICY') ? 'Finalize Protocol' : 'Next Phase'}
              {!loading && <ChevronRight className="w-4 h-4" />}
            </button>
          </form>

          {error && (
            <div className="flex gap-3 text-red-500 text-[10px] font-black uppercase items-center bg-red-500/10 p-5 rounded-[2rem] border border-red-500/20 animate-vix-in">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          <div className="text-center pt-4">
            <button type="button" onClick={() => { setIsLogin(!isLogin); setStep('CREDENTIALS'); setError(null); }} className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 hover:text-white transition-all underline underline-offset-8 decoration-zinc-800">
              {isLogin ? "New to the Grid?" : "Core Already Established?"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;


