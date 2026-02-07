
import React, { useState } from 'react';
import { Image as ImageIcon, X, Wand2, Loader2, Send, Play, Film, ShieldCheck } from 'lucide-react';
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
    } finally {
      setIsGeneratingCaption(false);
    }
  };

  const handlePost = async () => {
    if (!file || isPosting) return;
    setIsPosting(true);
    setProgress(5);
    
    const safeFilename = sanitizeFilename(file.name);
    const fileName = `${userId}-${Date.now()}-${safeFilename}`;
    const filePath = `feed/${fileName}`;
    
    try {
      const { data: uploadData, error: upErr } = await supabase.storage
        .from('posts')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (upErr) throw upErr;
      setProgress(60);

      const { data: { publicUrl } } = supabase.storage.from('posts').getPublicUrl(filePath);
      setProgress(85);

      const { error: dbErr } = await supabase.from('posts').insert({
        user_id: userId,
        media_url: publicUrl,
        media_type: mediaType,
        caption: caption
      });

      if (dbErr) throw dbErr;
      setProgress(100);
      onPostSuccess();
      setTimeout(onClose, 500);
    } catch (err: any) {
      console.error("Injection Failure:", err);
      alert("Transmission Error: " + (err.message || "Sync failure."));
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/98 flex items-center justify-center p-0 sm:p-8 md:p-12 overflow-hidden backdrop-blur-3xl animate-in fade-in duration-500">
      <div className="bg-[#0a0a0a] border border-white/5 w-full max-w-5xl h-full sm:h-auto sm:max-h-[85vh] sm:rounded-[3rem] flex flex-col md:flex-row shadow-[0_50px_100px_rgba(0,0,0,0.8)] relative overflow-hidden ring-1 ring-white/10">
        
        {/* Progress Overlay */}
        {isPosting && (
          <div className="absolute inset-0 z-[100] bg-black/90 backdrop-blur-3xl flex flex-col items-center justify-center p-12 text-center animate-in zoom-in duration-500">
             <div className="relative w-32 h-32 mb-10">
                <div className="absolute inset-0 vix-gradient rounded-full blur-2xl opacity-20 animate-pulse"></div>
                <div className="absolute inset-0 border-2 border-white/10 rounded-full"></div>
                <div className="absolute inset-0 border-2 border-pink-500 rounded-full border-t-transparent animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                   <Film className="w-10 h-10 text-white" />
                </div>
             </div>
             <div className="space-y-4 w-full max-w-sm">
                <h3 className="text-xl font-black uppercase tracking-[0.4em] text-white">Injecting Artifact</h3>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Protocol Upload: {progress}% Complete</p>
                <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
                   <div className="h-full vix-gradient transition-all duration-500" style={{ width: `${progress}%` }}></div>
                </div>
             </div>
          </div>
        )}

        {/* Top Header Controls (Mobile Sticky) */}
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-[#0a0a0a] z-50 shrink-0 md:hidden">
          <button onClick={onClose} className="p-2 text-zinc-500"><X className="w-6 h-6" /></button>
          <span className="font-black text-[10px] uppercase tracking-[0.4em] text-zinc-500">New Artifact</span>
          <button onClick={handlePost} disabled={!file || isPosting} className="vix-gradient px-6 py-2 rounded-full font-black text-[10px] uppercase tracking-widest text-white disabled:opacity-20 shadow-xl shadow-pink-500/10">Share</button>
        </div>

        {/* Media Pane */}
        <div className="flex-1 bg-black flex items-center justify-center relative min-h-[40vh] md:min-h-0 border-r border-white/5 group">
          {preview ? (
            <div className="w-full h-full relative group/media">
               {/* Background Glow */}
               <div className="absolute inset-0 opacity-30 blur-3xl pointer-events-none">
                  <img src={mediaType === 'image' ? preview : ''} className="w-full h-full object-cover" alt="" />
               </div>
               
               <div className="relative h-full w-full flex items-center justify-center p-4">
                  {mediaType === 'video' ? (
                    <div className="relative w-full h-full flex items-center justify-center">
                       <video src={preview} controls={!isPosting} className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl border border-white/10" />
                       {!isPosting && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-4 bg-white/10 rounded-full backdrop-blur-xl opacity-0 group-hover/media:opacity-100 transition-opacity"><Play className="w-8 h-8 text-white fill-current" /></div>}
                    </div>
                  ) : (
                    <img src={preview} className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl border border-white/10" alt="Preview" />
                  )}
                  
                  {!isPosting && (
                    <button 
                      onClick={() => {setFile(null); setPreview(null);}} 
                      className="absolute top-8 right-8 bg-black/60 p-3 rounded-full hover:bg-red-500/80 transition-all border border-white/10 backdrop-blur-md"
                    >
                      <X className="w-5 h-5 text-white" />
                    </button>
                  )}
               </div>
            </div>
          ) : (
            <label className="text-center cursor-pointer p-12 flex flex-col items-center gap-10 group w-full h-full justify-center hover:bg-white/[0.02] transition-colors">
              <div className="relative">
                <div className="w-28 h-28 rounded-[3rem] bg-zinc-900 border border-white/5 flex items-center justify-center transition-all duration-700 group-hover:scale-110 group-hover:rotate-6">
                  <Film className="w-12 h-12 text-zinc-700 group-hover:text-pink-500 transition-colors" />
                </div>
                <div className="absolute -bottom-2 -right-2 bg-pink-500 rounded-2xl p-2.5 shadow-2xl animate-bounce">
                   <ImageIcon className="w-5 h-5 text-white" />
                </div>
              </div>
              <div className="space-y-4">
                <p className="font-black uppercase tracking-[0.5em] text-[12px] text-zinc-500 group-hover:text-white transition-colors">Select Artifact Core</p>
                <div className="vix-gradient px-12 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white shadow-2xl shadow-pink-500/10 active:scale-95 transition-all">Browse Vault</div>
              </div>
              <input type="file" className="hidden" accept="image/*,video/*" onChange={handleFileChange} />
            </label>
          )}
        </div>
        
        {/* Metadata Pane */}
        <div className="w-full md:w-[400px] bg-[#0a0a0a] flex flex-col">
          {/* Desktop Header */}
          <div className="hidden md:flex items-center justify-between p-8 border-b border-white/5">
            <h3 className="font-black text-[10px] uppercase tracking-[0.4em] text-zinc-500">Metadata Protocol</h3>
            <button onClick={onClose} className="text-zinc-700 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar p-8 space-y-10">
            <div className="space-y-4">
               <div className="flex justify-between items-center px-1">
                  <label className="text-[10px] font-black uppercase text-zinc-600 tracking-widest">Narrative Script</label>
                  <span className="text-[9px] font-bold text-zinc-800">{caption.length}/2200</span>
               </div>
               <div className="relative group">
                  <textarea 
                    value={caption} 
                    onChange={e => setCaption(e.target.value)}
                    className="w-full h-48 md:h-64 bg-black/50 border border-white/5 rounded-[2rem] p-6 text-[14px] outline-none resize-none focus:border-pink-500/40 transition-all text-white placeholder:text-zinc-800 font-medium shadow-inner"
                    placeholder="Inscribe the narrative for this injection..."
                  />
                  <button 
                    onClick={handleGenerateAICaption} 
                    disabled={isGeneratingCaption || !file}
                    className="absolute bottom-5 right-5 p-3.5 bg-zinc-900 border border-white/5 rounded-2xl text-pink-400 hover:bg-zinc-800 hover:scale-110 active:scale-90 transition-all disabled:opacity-20 shadow-2xl"
                    title="AI Narrative Assist"
                  >
                    {isGeneratingCaption ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                  </button>
               </div>
            </div>

            <div className="space-y-5">
               <div className="flex items-center gap-4 p-5 bg-white/[0.02] border border-white/5 rounded-[2rem]">
                  <div className="w-10 h-10 rounded-2xl bg-zinc-900 flex items-center justify-center shrink-0 border border-white/5">
                     <ShieldCheck className="w-5 h-5 text-zinc-600" />
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black uppercase text-white tracking-widest mb-1">Safety Protocol</h4>
                    <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-tighter">Automated moderation active</p>
                  </div>
               </div>
               
               <div className="flex items-center justify-between px-2">
                  <span className="text-[10px] font-black uppercase text-zinc-700 tracking-widest">Artifact Class</span>
                  <span className="text-[9px] font-black text-pink-500 uppercase tracking-widest">{file ? mediaType : 'Unassigned'}</span>
               </div>
            </div>
          </div>

          <div className="p-8 border-t border-white/5 bg-black/40 hidden md:block">
            <button 
              onClick={handlePost} 
              disabled={!file || isPosting} 
              className="w-full vix-gradient py-5 rounded-[2rem] text-white font-black uppercase tracking-[0.3em] text-[11px] shadow-2xl shadow-pink-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-20"
            >
              Transmit Signal <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreatePost;
