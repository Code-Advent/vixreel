
import React, { useState } from 'react';
import { Image as ImageIcon, X, Wand2, Loader2, Video as VideoIcon, CheckCircle2, ChevronLeft, Film, Send } from 'lucide-react';
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
         alert("Physical artifact exceeds 50MB protocol limit. Compression required.");
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
      const prompt = caption ? `Enhance this VixReel narrative: ${caption}` : "Create a premium elite aesthetic caption for a high-end visual artifact.";
      const aiCaption = await generateAIText(prompt);
      setCaption(aiCaption);
    } finally {
      setIsGeneratingCaption(false);
    }
  };

  const handlePost = async () => {
    if (!file || isPosting) return;
    setIsPosting(true);
    setProgress(10);
    
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
      setProgress(80);

      const { error: dbErr } = await supabase.from('posts').insert({
        user_id: userId,
        media_url: publicUrl,
        media_type: mediaType,
        caption: caption
      });

      if (dbErr) throw dbErr;
      setProgress(100);
      onPostSuccess();
      setTimeout(onClose, 400);
    } catch (err: any) {
      console.error("Transmission Failure:", err);
      alert("Transmission Failure: " + (err.message || "Sync error."));
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-0 sm:p-4 overflow-hidden">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-4xl h-full sm:h-auto sm:max-h-[85vh] sm:rounded-[2.5rem] flex flex-col md:flex-row shadow-[0_0_100px_rgba(0,0,0,1)] animate-vix-in relative overflow-hidden">
        
        {/* Header (Top Bar) */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800 bg-zinc-900 z-50 shrink-0">
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
          <span className="font-black text-[10px] uppercase tracking-[0.3em] text-zinc-500">New Artifact</span>
          <button 
            onClick={handlePost} 
            disabled={!file || isPosting} 
            className="flex items-center gap-2 bg-white text-black px-6 py-2.5 rounded-full font-black text-[10px] tracking-[0.1em] uppercase disabled:opacity-20 hover:bg-pink-500 hover:text-white transition-all shadow-lg"
          >
            {isPosting ? 'Linking...' : 'Transmit'} <Send className="w-3 h-3 ml-1" />
          </button>
        </div>

        {/* Main Content Pane */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
          
          {/* Media Viewport (Left/Top) */}
          <div className="flex-1 bg-black flex items-center justify-center relative border-b md:border-b-0 md:border-r border-zinc-800 min-h-[350px]">
            {preview ? (
              <div className="w-full h-full relative flex items-center justify-center bg-zinc-950 p-2">
                {mediaType === 'video' ? (
                  <video src={preview} controls className="max-w-full max-h-full object-contain rounded-xl" />
                ) : (
                  <img src={preview} className="max-w-full max-h-full object-contain rounded-xl" alt="Preview" />
                )}
                
                {!isPosting && (
                  <button 
                    onClick={() => {setFile(null); setPreview(null);}} 
                    className="absolute top-6 right-6 bg-black/80 p-2.5 rounded-full hover:bg-zinc-800 transition-all border border-white/10 z-30 shadow-2xl"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                )}

                {isPosting && (
                  <div className="absolute inset-0 bg-black/85 flex items-center justify-center backdrop-blur-xl z-40 text-center p-10">
                    <div className="space-y-6 w-full max-w-xs">
                      <div className="w-20 h-20 rounded-[1.5rem] vix-gradient flex items-center justify-center animate-pulse shadow-2xl mx-auto border border-white/10">
                        <Loader2 className="w-8 h-8 text-white animate-spin" />
                      </div>
                      <div className="space-y-4">
                         <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/80">Injecting Artifact Core: {progress}%</span>
                         <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden shadow-inner">
                            <div className="h-full vix-gradient transition-all duration-300 shadow-[0_0_20px_rgba(255,0,128,0.6)]" style={{ width: `${progress}%` }}></div>
                         </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <label className="text-center cursor-pointer p-12 flex flex-col items-center gap-8 group w-full h-full justify-center hover:bg-zinc-800/20 transition-colors">
                <div className="w-24 h-24 rounded-[2.5rem] bg-zinc-800 border-2 border-zinc-700 border-dashed group-hover:border-pink-500/50 flex items-center justify-center transition-all duration-500 group-hover:rotate-12">
                  <ImageIcon className="w-10 h-10 text-zinc-600 group-hover:text-pink-500 transition-colors" />
                </div>
                <div className="space-y-3">
                  <p className="font-black uppercase tracking-[0.3em] text-[11px] text-zinc-500 group-hover:text-zinc-300 transition-colors">Initialize Visual Artifact</p>
                  <div className="vix-gradient px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-2xl shadow-pink-500/20 group-hover:scale-110 transition-transform">Access Vault</div>
                </div>
                <input type="file" className="hidden" accept="image/*,video/*" onChange={handleFileChange} />
              </label>
            )}
          </div>
          
          {/* Controls & Metadata (Right/Bottom) */}
          <div className="w-full md:w-[350px] lg:w-[400px] bg-zinc-900 p-8 space-y-8 flex flex-col overflow-y-auto no-scrollbar border-l border-zinc-800">
            <div className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Narrative Protocol</label>
                {caption.length > 0 && <span className="text-[9px] font-bold text-zinc-700">{caption.length} Characters</span>}
              </div>
              <div className="relative group">
                <textarea 
                  value={caption} 
                  onChange={e => setCaption(e.target.value)}
                  className="w-full h-40 md:h-72 bg-black border border-zinc-800 rounded-[2rem] p-6 text-[13px] outline-none resize-none focus:border-pink-500/30 transition-all text-white placeholder:text-zinc-800 font-medium leading-relaxed shadow-inner"
                  placeholder="Inscribe your narrative manifesto..."
                />
                <button 
                  onClick={handleGenerateAICaption} 
                  disabled={isGeneratingCaption || !file}
                  className="absolute bottom-5 right-5 p-3 bg-zinc-900 rounded-2xl text-purple-400 border border-zinc-800 hover:border-purple-500 hover:bg-zinc-800 transition-all disabled:opacity-30 shadow-2xl active:scale-95 group-hover:shadow-purple-500/10"
                  title="Generate AI Perspective"
                >
                  {isGeneratingCaption ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
            
            <div className="p-6 bg-black/40 border border-zinc-800 rounded-[2rem] space-y-5">
               <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                  <span>Artifact Class</span>
                  <span className="text-white bg-zinc-800 px-3 py-1 rounded-full border border-white/5">{mediaType.toUpperCase()}</span>
               </div>
               <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                  <span>Privacy Protocol</span>
                  <span className="text-zinc-400">NETWORK-GLOBAL</span>
               </div>
               <div className="pt-2 border-t border-zinc-800/50">
                 <div className="flex items-center gap-3 text-[10px] font-bold text-zinc-600 uppercase tracking-tighter italic">
                   <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                   Connection Secure • Encrypted Link
                 </div>
               </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default CreatePost;
