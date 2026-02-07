
import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { UserProfile } from '../types';
import { 
  ChevronRight, 
  Loader2, 
  AlertCircle, 
  Calendar, 
  ShieldCheck, 
  ChevronLeft, 
  CheckCircle2, 
  Sparkles, 
  Zap, 
  Flame, 
  Camera, 
  Upload, 
  User,
  X
} from 'lucide-react';
import { sanitizeFilename } from '../lib/utils';

interface AuthProps {
  onAuthSuccess: (user: UserProfile) => void;
}

type AuthStep = 'LANDING' | 'CREDENTIALS' | 'IDENTITY' | 'AVATAR' | 'POLICY';

const Auth: React.FC<AuthProps> = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [step, setStep] = useState<AuthStep>('LANDING');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  // Camera State
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
      setError("Camera access denied. Please upload an artifact instead.");
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
        setStep('AVATAR');
      } else if (step === 'AVATAR') {
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
      // Step 1: Auth Signup
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
      
      if (data.user) {
        // Step 2: Avatar Upload if exists
        let finalAvatarUrl = null;
        if (avatarFile) {
          const fileName = `${data.user.id}-${Date.now()}-${sanitizeFilename(avatarFile.name)}`;
          const { error: upErr } = await supabase.storage.from('avatars').upload(`avatars/${fileName}`, avatarFile);
          if (!upErr) {
            const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(`avatars/${fileName}`);
            finalAvatarUrl = publicUrl;
            // Update profile with avatar
            await supabase.from('profiles').update({ avatar_url: finalAvatarUrl }).eq('id', data.user.id);
          }
        }

        if (!data.session) {
          setError("Verification protocol initiated. Check your inbox.");
          setIsLogin(true);
          setStep('CREDENTIALS');
        } else {
          onAuthSuccess(data.user as any);
        }
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
        {/* Animated Background Elements */}
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-pink-600/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-purple-600/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-[30%] left-[40%] w-[20%] h-[20%] bg-blue-600/5 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '4s' }}></div>
        
        <div className="w-full max-w-xl text-center z-10 space-y-12 animate-vix-in">
          <div className="space-y-4">
            <h1 className="logo-font text-8xl md:text-9xl vix-text-gradient drop-shadow-[0_0_30px_rgba(255,0,128,0.4)] transition-all hover:scale-105 cursor-default select-none">VixReel</h1>
            <p className="text-zinc-500 font-black uppercase tracking-[0.5em] text-[10px] md:text-xs">The Digital Social Narrative</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-4">
            <button 
              onClick={() => { setIsLogin(true); setStep('CREDENTIALS'); }}
              className="group relative p-[1px] rounded-3xl overflow-hidden transition-all hover:scale-105 active:scale-95"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-zinc-800 to-zinc-900 group-hover:from-zinc-700 group-hover:to-zinc-800 transition-colors"></div>
              <div className="relative bg-black rounded-[1.45rem] p-10 flex flex-col items-center gap-5 border border-white/5">
                <Zap className="w-10 h-10 text-zinc-400 group-hover:text-pink-500 transition-all duration-300 group-hover:drop-shadow-[0_0_8px_#ff0080]" />
                <div className="space-y-1">
                  <span className="font-black uppercase tracking-widest text-xs text-white">Enter Narrative</span>
                  <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-tighter">Existing Identity Sync</p>
                </div>
              </div>
            </button>

            <button 
              onClick={() => { setIsLogin(false); setStep('CREDENTIALS'); }}
              className="group relative p-[1px] rounded-3xl overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-[0_0_40px_rgba(255,0,128,0.2)]"
            >
              <div className="absolute inset-0 vix-gradient animate-gradient-slow"></div>
              <div className="relative bg-black/90 backdrop-blur-3xl rounded-[1.45rem] p-10 flex flex-col items-center gap-5 border border-white/10">
                <Flame className="w-10 h-10 text-white group-hover:scale-110 transition-transform duration-500 group-hover:drop-shadow-[0_0_12px_#ff0080]" />
                <div className="space-y-1">
                  <span className="font-black uppercase tracking-widest text-xs text-white">Join the Void</span>
                  <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-tighter">Initialize New Protocol</p>
                </div>
              </div>
            </button>
          </div>

          <div className="pt-8 opacity-40 hover:opacity-100 transition-opacity">
            <p className="text-[8px] text-zinc-700 font-black uppercase tracking-[0.3em] max-w-xs mx-auto leading-relaxed">
              V.09 • Encrypted Social Grid • Est. 2025
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 sm:p-6 overflow-y-auto py-20 relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,_#0a0a0a_0%,_#000_80%)]"></div>
      </div>

      <div className="w-full max-w-md animate-vix-in z-10">
        <button 
          onClick={() => setStep('LANDING')} 
          className="mb-10 flex items-center gap-2 text-zinc-600 hover:text-white transition-all group mx-auto"
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-[10px] font-black uppercase tracking-widest">Abort Transmission</span>
        </button>

        <div className="bg-zinc-950/40 backdrop-blur-3xl border border-zinc-900/50 rounded-[3rem] p-8 sm:p-12 shadow-[0_0_100px_rgba(0,0,0,1)] space-y-8 relative overflow-hidden border-t-white/10">
          <div className="text-center space-y-3">
            <h1 className="logo-font text-5xl font-bold vix-text-gradient drop-shadow-lg">VixReel</h1>
            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.4em]">
              {isLogin ? 'Identity Linkage' : `Onboarding Phase ${step === 'CREDENTIALS' ? '1' : step === 'IDENTITY' ? '2' : step === 'AVATAR' ? '3' : '4'}`}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-5">
            {isLogin ? (
              <div className="space-y-4 animate-vix-in">
                <input 
                  type="email" 
                  placeholder="Email" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  className="w-full bg-black/60 border border-zinc-800/80 rounded-2xl px-6 py-5 text-sm outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/20 transition-all text-white placeholder:text-zinc-700" 
                  required 
                />
                <input 
                  type="password" 
                  placeholder="Access Key" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  className="w-full bg-black/60 border border-zinc-800/80 rounded-2xl px-6 py-5 text-sm outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/20 transition-all text-white placeholder:text-zinc-700 font-mono" 
                  required 
                />
              </div>
            ) : (
              <>
                {step === 'CREDENTIALS' && (
                  <div className="space-y-4 animate-vix-in">
                    <input 
                      type="text" 
                      placeholder="@handle (Identity)" 
                      value={username} 
                      onChange={e => setUsername(e.target.value)} 
                      className="w-full bg-black border border-zinc-800 rounded-2xl px-6 py-5 text-sm outline-none focus:border-pink-500/50 transition-all text-white placeholder:text-zinc-700" 
                      required 
                    />
                    <input 
                      type="email" 
                      placeholder="Email Protocol" 
                      value={email} 
                      onChange={e => setEmail(e.target.value)} 
                      className="w-full bg-black border border-zinc-800 rounded-2xl px-6 py-5 text-sm outline-none focus:border-pink-500/50 transition-all text-white placeholder:text-zinc-700" 
                      required 
                    />
                    <input 
                      type="password" 
                      placeholder="Security Signature" 
                      value={password} 
                      onChange={e => setPassword(e.target.value)} 
                      className="w-full bg-black border border-zinc-800 rounded-2xl px-6 py-5 text-sm outline-none focus:border-pink-500/50 transition-all text-white placeholder:text-zinc-700" 
                      required 
                    />
                  </div>
                )}

                {step === 'IDENTITY' && (
                  <div className="space-y-5 animate-vix-in">
                    <button type="button" onClick={() => setStep('CREDENTIALS')} className="flex items-center gap-1 text-[10px] font-black uppercase text-zinc-500 mb-2 hover:text-white transition-colors"><ChevronLeft className="w-3 h-3"/> Credentials Sync</button>
                    <input 
                      type="text" 
                      placeholder="Legal Narrative Name" 
                      value={fullName} 
                      onChange={e => setFullName(e.target.value)} 
                      className="w-full bg-black border border-zinc-800 rounded-2xl px-6 py-5 text-sm outline-none focus:border-pink-500/50 transition-all text-white placeholder:text-zinc-700" 
                    />
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-zinc-600 ml-2 tracking-[0.2em]">DOB Protocol</label>
                      <div className="relative">
                        <Calendar className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                        <input 
                          type="date" 
                          value={dob} 
                          onChange={e => setDob(e.target.value)} 
                          className="w-full bg-black border border-zinc-800 rounded-2xl px-14 py-5 text-sm outline-none focus:border-pink-500/50 transition-all text-zinc-400" 
                          required 
                        />
                      </div>
                    </div>
                  </div>
                )}

                {step === 'AVATAR' && (
                  <div className="space-y-6 animate-vix-in flex flex-col items-center">
                    <button type="button" onClick={() => setStep('IDENTITY')} className="self-start flex items-center gap-1 text-[10px] font-black uppercase text-zinc-500 mb-2 hover:text-white transition-colors"><ChevronLeft className="w-3 h-3"/> Identity Details</button>
                    
                    <div className="relative w-40 h-40 group">
                      <div className={`w-full h-full rounded-full border-2 border-dashed border-zinc-800 p-2 flex items-center justify-center overflow-hidden transition-all duration-500 ${avatarUrl ? 'border-pink-500 shadow-[0_0_20px_rgba(255,0,128,0.2)]' : ''}`}>
                        {avatarUrl ? (
                          <img src={avatarUrl} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <div className="text-center space-y-2">
                            <User className="w-10 h-10 text-zinc-800 mx-auto" />
                            <p className="text-[8px] font-black uppercase text-zinc-600">Visual Identification</p>
                          </div>
                        )}
                      </div>
                      
                      {avatarUrl && (
                        <button 
                          type="button" 
                          onClick={() => { setAvatarUrl(null); setAvatarFile(null); }}
                          className="absolute -top-1 -right-1 bg-black border border-zinc-800 p-1.5 rounded-full text-zinc-500 hover:text-white transition-all shadow-xl"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    <div className="w-full grid grid-cols-2 gap-3">
                      <button 
                        type="button" 
                        onClick={startCamera}
                        className="flex flex-col items-center gap-2 p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl hover:bg-zinc-800 hover:border-zinc-700 transition-all group"
                      >
                        <Camera className="w-5 h-5 text-zinc-500 group-hover:text-white transition-colors" />
                        <span className="text-[9px] font-black uppercase tracking-widest">Capture</span>
                      </button>
                      
                      <label className="flex flex-col items-center gap-2 p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl hover:bg-zinc-800 hover:border-zinc-700 transition-all group cursor-pointer">
                        <Upload className="w-5 h-5 text-zinc-500 group-hover:text-white transition-colors" />
                        <span className="text-[9px] font-black uppercase tracking-widest">Upload</span>
                        <input type="file" className="hidden" accept="image/*" onChange={handleFileSelect} />
                      </label>
                    </div>

                    {showCamera && (
                      <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-6 backdrop-blur-3xl animate-vix-in">
                        <div className="relative w-full max-w-sm aspect-square rounded-full overflow-hidden border-4 border-zinc-900 shadow-[0_0_60px_rgba(255,0,128,0.3)]">
                          <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                          <div className="absolute inset-0 border-[40px] border-black/20 pointer-events-none"></div>
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-pink-500/50 rounded-full animate-pulse"></div>
                        </div>
                        <div className="mt-12 flex gap-4">
                          <button type="button" onClick={stopCamera} className="px-8 py-3 bg-zinc-900 rounded-2xl font-black uppercase text-[10px] tracking-widest">Cancel</button>
                          <button type="button" onClick={capturePhoto} className="px-10 py-3 vix-gradient rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl">Capture Identification</button>
                        </div>
                        <canvas ref={canvasRef} className="hidden" />
                      </div>
                    )}
                  </div>
                )}

                {step === 'POLICY' && (
                  <div className="space-y-4 animate-vix-in">
                    <button type="button" onClick={() => setStep('AVATAR')} className="flex items-center gap-1 text-[10px] font-black uppercase text-zinc-500 mb-2 hover:text-white transition-colors"><ChevronLeft className="w-3 h-3"/> Visual ID</button>
                    <div className="bg-black/60 border border-zinc-900/80 rounded-[2.5rem] p-8 h-72 overflow-y-auto no-scrollbar text-[10px] leading-relaxed text-zinc-500 space-y-6 font-medium shadow-inner">
                      <div className="space-y-3">
                        <p className="text-white font-black uppercase tracking-[0.2em] text-[11px] mb-2 border-b border-zinc-900 pb-3 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-pink-500" /> VixReel Protocol Manifesto</p>
                        <p className="italic text-zinc-600">By establishing this protocol, you bind your digital identity to the VixReel social grid.</p>
                      </div>
                      <section className="space-y-2">
                        <p className="text-zinc-300 font-bold uppercase tracking-wider">I. Visual Artifacts</p>
                        <p>All transmitted media must adhere to high-aesthetic standards. Offensive, harmful, or low-resolution artifacts are subject to immediate termination.</p>
                      </section>
                      <section className="space-y-2">
                        <p className="text-zinc-300 font-bold uppercase tracking-wider">II. Identity Integrity</p>
                        <p>One core per identity. Impersonation of other narrators or system administrators is a critical violation of network laws.</p>
                      </section>
                      <section className="space-y-2">
                        <p className="text-zinc-300 font-bold uppercase tracking-wider">III. Data Encrypton</p>
                        <p>Your narrative parameters are yours. We encrypt and shield your signals from third-party advertising cores.</p>
                      </section>
                    </div>
                    <div className="flex items-center gap-4 p-5 bg-pink-500/5 border border-pink-500/10 rounded-[2rem]">
                      <div className="w-6 h-6 rounded-full bg-pink-500/20 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-4 h-4 text-pink-500" />
                      </div>
                      <span className="text-[9px] font-bold text-zinc-500 leading-tight">I accept the terms of narrative creation and agree to uphold the aesthetic standards of the VixReel network.</span>
                    </div>
                  </div>
                )}
              </>
            )}

            <button 
              type="submit" 
              disabled={loading} 
              className="w-full vix-gradient py-5 rounded-[2.5rem] text-white font-black uppercase tracking-widest text-[10px] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 group disabled:opacity-30"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isLogin ? (
                'Synchronize Identity'
              ) : step === 'POLICY' ? (
                'Establish Protocol'
              ) : (
                'Next Phase'
              )}
              {!loading && <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
            </button>
          </form>

          {error && (
            <div className="flex gap-3 text-red-500 text-[10px] font-black uppercase items-center bg-red-500/10 p-5 rounded-[2rem] border border-red-500/20 animate-vix-in">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          <div className="text-center pt-4">
            <button 
              type="button"
              onClick={() => { setIsLogin(!isLogin); setStep('CREDENTIALS'); setError(null); }} 
              className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 hover:text-white transition-all underline underline-offset-8 decoration-zinc-800 hover:decoration-pink-500"
            >
              {isLogin ? "Need a new core?" : "Already established?"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
