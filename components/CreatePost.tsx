
import React, { useState } from 'react';
import { Image as ImageIcon, X, Wand2, Loader2, Video as VideoIcon, CheckCircle2 } from 'lucide-react';
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
      if (selectedFile.size > 50 * 1024 * 1024) { // 50MB limit
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
      // 1. Upload to Supabase Storage
      const { data: uploadData, error: upErr } = await supabase.storage
        .from('posts')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (upErr) {
        if (upErr.message === "Failed to fetch") {
          throw new Error("Connection failed. Ensure the 'posts' storage bucket is Public.");
        }
        throw upErr;
      }
      
      setProgress(60);

      // 2. Get Public URL
      const { data: { publicUrl } } = supabase.storage.from('posts').getPublicUrl(filePath);
      
      setProgress(80);

      // 3. Insert Database Record
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
      console.error("VixReel Upload Error Log:", err);
      alert("Transmission Failure: " + (err.message || "An internal error occurred during syncing."));
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-0 sm:p-4 md:p-10 overflow-hidden">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-4xl h-full sm:h-auto sm:max-h-[85vh] sm:rounded-[3rem] overflow-hidden flex flex-col md:flex-row shadow-[0_0_150px_rgba(0,0,0,1)] animate-vix-in">
        {/* Left Side / Top: Media Preview */}
        <div className="flex-1 bg-black flex items-center justify-center relative border-b md:border-b-0 md:border-r border-zinc-800/50 overflow-hidden min-h-[300px] md:min-h-0">
          {preview ? (
            <div className="w-full h-full relative group">
              {mediaType === 'video' ? (
                <video src={preview} controls className="w-full h-full object-contain" />
              ) : (
                <img src={preview} className="w-full h-full object-contain" alt="Preview" />
              )}
              <button 
                onClick={() => {setFile(null); setPreview(null);}} 
                className="absolute top-4 right-4 sm:top-6 sm:right-6 bg-black/60 backdrop-blur-xl p-3 rounded-full hover:bg-zinc-800 transition-all border border-white/10"
              >
                <X className="w-5 h-5 text-white" />
              </button>
              {isPosting && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm transition-all z-20">
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 text-pink-500 animate-spin" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white">Syncing Artifact... {progress}%</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <label className="text-center cursor-pointer p-8 flex flex-col items-center gap-6 group w-full h-full justify-center">
              <div className="w-20 h-20 rounded-[2rem] bg-zinc-900 flex items-center justify-center group-hover:bg-zinc-800 transition-all border border-zinc-800 border-dashed group-hover:border-zinc-600">
                <ImageIcon className="w-8 h-8 text-zinc-700 group-hover:text-zinc-500 transition-colors" />
              </div>
              <div className="space-y-2">
                <p className="font-black uppercase tracking-[0.4em] text-[10px] text-zinc-500">Inject Digital Artifact</p>
                <p className="text-zinc-800 text-[9px] font-black uppercase tracking-widest">Supports MP4 / JPG up to 50MB</p>
              </div>
              <div className="vix-gradient px-10 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-pink-500/10 active:scale-95 transition-all">Browse System</div>
              <input type="file" className="hidden" accept="image/*,video/*" onChange={handleFileChange} />
              <button onClick={(e) => { e.preventDefault(); onClose(); }} className="md:hidden mt-4 text-[9px] font-black text-zinc-700 uppercase tracking-widest hover:text-white transition-colors">Dismiss</button>
            </label>
          )}
        </div>
        
        {/* Right Side / Bottom: Metadata */}
        <div className="w-full md:w-80 flex flex-col bg-zinc-950/60 backdrop-blur-xl shrink-0 overflow-y-auto no-scrollbar">
           <div className="p-5 sm:p-7 border-b border-zinc-900 flex justify-between items-center sticky top-0 bg-zinc-950 z-10">
              <h2 className="font-black uppercase text-[9px] tracking-[0.3em] text-zinc-600">Sync Metadata</h2>
              <div className="flex items-center gap-4">
                 <button 
                  onClick={handlePost} 
                  disabled={!file || isPosting} 
                  className="vix-text-gradient font-black text-xs tracking-[0.3em] uppercase disabled:opacity-20 hover:scale-105 transition-all flex items-center gap-2"
                 >
                  {isPosting ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                  {isPosting ? 'LINKING' : 'TRANSMIT'}
                 </button>
                 <button onClick={onClose} className="md:hidden p-1.5 bg-zinc-900 rounded-lg"><X className="w-4 h-4 text-zinc-500" /></button>
              </div>
           </div>
           
           <div className="flex-1 p-5 sm:p-7 space-y-6 sm:space-y-8">
              <div className="relative">
                <label className="text-[9px] font-black uppercase text-zinc-800 block mb-3 tracking-[0.25em]">Narrative Protocol</label>
                <textarea 
                  value={caption} 
                  onChange={e => setCaption(e.target.value)}
                  className="w-full h-32 md:h-44 bg-black/60 border border-zinc-900 rounded-3xl p-5 text-sm outline-none resize-none focus:border-zinc-700 transition-all text-white placeholder:text-zinc-900 font-medium"
                  placeholder="Describe your story..."
                />
                <button 
                  onClick={handleGenerateAICaption} 
                  disabled={isGeneratingCaption}
                  className="absolute bottom-4 right-4 p-2.5 bg-zinc-900 rounded-2xl text-purple-400 border border-zinc-800 hover:border-purple-500/40 transition-all disabled:opacity-50"
                  title="Generate AI Narrative"
                >
                  {isGeneratingCaption ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                </button>
              </div>
              
              <div className="p-5 bg-black/40 border border-zinc-900 rounded-[2rem] space-y-4">
                 <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-zinc-700">
                    <span>Class</span>
                    <span className="text-white bg-zinc-800 px-2 py-0.5 rounded text-[8px]">{mediaType.toUpperCase()}</span>
                 </div>
                 <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-zinc-700">
                    <span>Protocol</span>
                    <span className="text-pink-500">VIX-STORY-1.0</span>
                 </div>
                 <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-zinc-700">
                    <span>Status</span>
                    <span className="text-green-500 animate-pulse">OPTIMIZED</span>
                 </div>
              </div>

              <button onClick={onClose} className="hidden md:block w-full text-[9px] font-black text-zinc-800 uppercase tracking-widest hover:text-zinc-600 transition-colors py-4">Discard Artifact</button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default CreatePost;
