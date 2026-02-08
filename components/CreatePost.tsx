
import React, { useState, useRef } from 'react';
import { X, Wand2, Loader2, Send, Film, ShieldCheck, Upload, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { generateAIText } from '../services/geminiService';
import { sanitizeFilename } from '../lib/utils';

interface CreatePostProps {
  userId: string;
  onClose: () => void;
  onPostSuccess: () => void;
}

const CreatePost: React.FC<CreatePostProps> = ({ userId, onClose, onPostSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 50 * 1024 * 1024) {
         alert("Physical artifact exceeds 50MB protocol limit. Please optimize.");
         return;
      }
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
      setMediaType(selectedFile.type.startsWith('video') ? 'video' : 'image');
    }
  };

  const handleGenerateAICaption = async () => {
    if (isGeneratingCaption) return;
    setIsGeneratingCaption(true);
    try {
      const prompt = caption ? `Enhance this VixReel narrative: ${caption}` : "Create an elite cinematic caption for a high-end social visual.";
      const aiCaption = await generateAIText(prompt);
      setCaption(aiCaption);
    } finally { setIsGeneratingCaption(false); }
  };

  const handlePost = async () => {
    if (!file || isPosting) return;
    setIsPosting(true);
    setProgress(10);
    
    const safeFilename = sanitizeFilename(file.name);
    const fileName = `${userId}-${Date.now()}-${safeFilename}`;
    const filePath = `feed/${fileName}`;
    
    try {
      const { error: upErr } = await supabase.storage.from('posts').upload(filePath, file);
      if (upErr) throw upErr;
      setProgress(70);

      const { data: { publicUrl } } = supabase.storage.from('posts').getPublicUrl(filePath);
      const { error: dbErr } = await supabase.from('posts').insert({
        user_id: userId, media_url: publicUrl, media_type: mediaType, caption: caption
      });
      if (dbErr) throw dbErr;

      setProgress(100);
      onPostSuccess();
      setTimeout(onClose, 500);
    } catch (err: any) {
      alert("Transmission Error: " + (err.message || "Sync failure."));
    } finally { setIsPosting(false); }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center animate-vix-in">
      {/* Top Header Controls (Universal) */}
      <div className="w-full flex items-center justify-between p-6 bg-black border-b border-zinc-900 shrink-0">
        <button onClick={onClose} className="p-3 text-zinc-500 hover:text-white transition-colors bg-zinc-900/50 rounded-full">
          <X className="w-6 h-6" />
        </button>
        <span className="font-black text-[11px] uppercase tracking-[0.4em] text-white">Grid Injection</span>
        <button 
          onClick={handlePost} 
          disabled={!file || isPosting} 
          className="vix-gradient px-8 py-3 rounded-full text-white font-black text-[12px] uppercase tracking-widest disabled:opacity-20 shadow-lg shadow-pink-500/20"
        >
          {isPosting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Share'}
        </button>
      </div>

      <div className="w-full flex-1 flex flex-col md:flex-row relative overflow-hidden">
        {/* Posting Overlay */}
        {isPosting && (
          <div className="absolute inset-0 z-[10000] bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center p-12 text-center">
             <div className="relative w-32 h-32 mb-10">
                <div className="absolute inset-0 vix-gradient rounded-full blur-2xl opacity-20 animate-pulse"></div>
                <div className="absolute inset-0 border-2 border-white/10 rounded-full"></div>
                <div className="absolute inset-0 border-2 border-pink-500 rounded-full border-t-transparent animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center"><Film className="w-10 h-10 text-white" /></div>
             </div>
             <div className="space-y-4 w-full max-w-sm">
                <h3 className="text-xl font-black uppercase tracking-[0.4em] text-white">Transmitting Signal</h3>
                <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden mt-4">
                   <div className="h-full vix-gradient transition-all duration-500" style={{ width: `${progress}%` }}></div>
                </div>
             </div>
          </div>
        )}

        {/* Media Zone: Massive Focus */}
        <div className="flex-1 bg-zinc-950 flex flex-col items-center justify-center relative p-4 sm:p-12 overflow-y-auto no-scrollbar">
          {preview ? (
            <div className="w-full h-full flex items-center justify-center relative">
               {mediaType === 'video' ? (
                 <video src={preview} controls={!isPosting} className="max-w-full max-h-[70vh] object-contain rounded-3xl shadow-2xl border border-white/5" />
               ) : (
                 <img src={preview} className="max-w-full max-h-[70vh] object-contain rounded-3xl shadow-2xl border border-white/5" alt="Artifact" />
               )}
               {!isPosting && (
                 <button onClick={() => {setFile(null); setPreview(null);}} className="absolute top-4 right-4 bg-black/80 p-4 rounded-full text-white backdrop-blur-md hover:bg-red-500 transition-all border border-white/10 shadow-2xl">
                    <X className="w-5 h-5" />
                 </button>
               )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center space-y-12 animate-vix-in w-full max-w-md">
              <div 
                className="relative group cursor-pointer" 
                onClick={() => fileInputRef.current?.click()}
              >
                 <div className="w-48 h-48 sm:w-64 sm:h-64 rounded-[4rem] sm:rounded-[6rem] bg-zinc-900 flex items-center justify-center border border-zinc-800 shadow-[0_0_80px_rgba(0,0,0,0.8)] transition-all duration-700 group-hover:scale-105 group-hover:rotate-3">
                    <Film className="w-20 h-20 sm:w-28 sm:h-28 text-zinc-800 group-hover:text-pink-500 transition-colors" />
                 </div>
                 <div className="absolute -bottom-4 -right-4 bg-white p-8 rounded-full shadow-2xl animate-bounce">
                    <Upload className="w-8 h-8 text-black" />
                 </div>
              </div>

              <div className="space-y-6 w-full">
                 <h2 className="text-3xl font-black uppercase tracking-[0.4em] text-white">Grid Hub</h2>
                 <p className="text-[11px] text-zinc-600 font-bold uppercase tracking-[0.5em] leading-relaxed px-4">Initialize a visual artifact to enter the narrative grid.</p>
                 <button 
                  onClick={() => fileInputRef.current?.click()} 
                  className="w-full py-6 bg-white rounded-[2.5rem] text-black font-black uppercase tracking-[0.3em] text-[14px] shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-4 hover:bg-zinc-200"
                 >
                    <Sparkles className="w-5 h-5" /> Open Vault
                 </button>
              </div>
              <input ref={fileInputRef} type="file" className="hidden" accept="image/*,video/*" onChange={handleFileChange} />
            </div>
          )}
        </div>

        {/* Metadata Zone */}
        <div className={`w-full md:w-[450px] bg-black flex flex-col border-l border-zinc-900 shrink-0 ${!preview ? 'hidden md:flex opacity-20 pointer-events-none' : 'flex'}`}>
           <div className="flex-1 overflow-y-auto no-scrollbar p-8 space-y-12 pb-32">
              <div className="space-y-6">
                 <div className="flex justify-between items-center px-2">
                    <label className="text-[11px] font-black uppercase text-zinc-600 tracking-widest">Description Protocol</label>
                    <span className="text-[9px] font-bold text-zinc-800">{caption.length}/2200</span>
                 </div>
                 <div className="relative group">
                    <textarea 
                       value={caption} 
                       onChange={e => setCaption(e.target.value)}
                       className="w-full h-40 md:h-64 bg-zinc-900/40 border border-zinc-900 rounded-[2.5rem] p-8 text-[15px] outline-none resize-none focus:border-pink-500/30 transition-all text-white placeholder:text-zinc-800 font-medium"
                       placeholder="Inscribe your narrative..."
                    />
                    <button 
                       onClick={handleGenerateAICaption} 
                       disabled={isGeneratingCaption || !file}
                       className="absolute bottom-6 right-6 p-4 bg-zinc-900 border border-zinc-800 rounded-2xl text-pink-500 hover:scale-110 active:scale-90 transition-all shadow-2xl disabled:opacity-20"
                    >
                       {isGeneratingCaption ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
                    </button>
                 </div>
              </div>

              <div className="flex items-center gap-5 p-6 bg-zinc-900/20 border border-zinc-900 rounded-[2.5rem]">
                 <div className="w-12 h-12 rounded-2xl bg-zinc-900 flex items-center justify-center shrink-0 border border-zinc-800">
                    <ShieldCheck className="w-6 h-6 text-zinc-600" />
                 </div>
                 <div>
                   <h4 className="text-[11px] font-black uppercase text-white tracking-widest mb-1">Safety Core</h4>
                   <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-tighter">Automated narrative verification active</p>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default CreatePost;
