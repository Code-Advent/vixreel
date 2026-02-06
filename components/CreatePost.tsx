
import React, { useState } from 'react';
import { Image as ImageIcon, X, Wand2, Loader2, Video as VideoIcon, CheckCircle2, ChevronLeft, Film } from 'lucide-react';
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
    <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-0 sm:p-6 md:p-10 overflow-hidden">
      <div className="bg-black sm:bg-zinc-900 border-x sm:border border-zinc-900/50 w-full max-w-5xl h-full sm:h-auto sm:max-h-[90vh] sm:rounded-[2.5rem] flex flex-col md:flex-row shadow-[0_0_150px_rgba(0,0,0,1)] animate-vix-in relative">
        
        {/* Universal Header - Visible always at top on mobile */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800 bg-black/60 z-50 backdrop-blur-xl shrink-0">
          <button onClick={onClose} className="p-2 -m-2 text-zinc-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
          <span className="font-black text-[10px] uppercase tracking-[0.3em] text-zinc-500">Sync Artifact</span>
          <button 
            onClick={handlePost} 
            disabled={!file || isPosting} 
            className="vix-text-gradient font-black text-xs tracking-[0.2em] uppercase disabled:opacity-20 hover:scale-105 transition-all"
          >
            {isPosting ? 'LINKING...' : 'TRANSMIT'}
          </button>
        </div>

        {/* Media Preview Section */}
        <div className="flex-1 bg-black flex items-center justify-center relative border-b md:border-b-0 md:border-r border-zinc-900 overflow-hidden min-h-0">
          {preview ? (
            <div className="w-full h-full relative group flex items-center justify-center bg-zinc-950">
              {mediaType === 'video' ? (
                <video src={preview} controls className="w-full h-full object-contain" />
              ) : (
                <img src={preview} className="w-full h-full object-contain" alt="Preview" />
              )}
              
              {!isPosting && (
                <button 
                  onClick={() => {setFile(null); setPreview(null);}} 
                  className="absolute top-6 right-6 bg-black/60 backdrop-blur-xl p-3 rounded-full hover:bg-zinc-800 transition-all border border-white/10 group-hover:scale-105 z-30"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              )}

              {isPosting && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center backdrop-blur-md transition-all z-40 text-center">
                  <div className="flex flex-col items-center gap-6 p-10">
                    <div className="w-20 h-20 rounded-[2rem] vix-gradient flex items-center justify-center animate-pulse shadow-[0_0_30px_rgba(255,0,128,0.2)]">
                      <Loader2 className="w-10 h-10 text-white animate-spin" />
                    </div>
                    <div className="space-y-4">
                       <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white">Injecting Artifact...</span>
                       <div className="w-48 h-1.5 bg-zinc-800 rounded-full overflow-hidden mx-auto">
                          <div className="h-full vix-gradient transition-all duration-300 shadow-[0_0_10px_rgba(255,0,128,0.5)]" style={{ width: `${progress}%` }}></div>
                       </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <label className="text-center cursor-pointer p-10 flex flex-col items-center gap-8 group w-full h-full justify-center bg-[radial-gradient(circle_at_center,_#111_0%,_#000_70%)]">
              <div className="flex gap-4">
                 <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-[2rem] bg-zinc-900 border border-zinc-800 border-dashed group-hover:border-pink-500/50 flex items-center justify-center transition-all duration-500">
                   <ImageIcon className="w-6 h-6 sm:w-8 sm:h-8 text-zinc-700 group-hover:text-pink-500 transition-colors" />
                 </div>
                 <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-[2rem] bg-zinc-900 border border-zinc-800 border-dashed group-hover:border-purple-500/50 flex items-center justify-center transition-all duration-500">
                   <Film className="w-6 h-6 sm:w-8 sm:h-8 text-zinc-700 group-hover:text-purple-500 transition-colors" />
                 </div>
              </div>
              <div className="space-y-3">
                <p className="font-black uppercase tracking-[0.4em] text-[10px] text-zinc-500 group-hover:text-white transition-colors">Select Visual Artifact</p>
                <div className="vix-gradient px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl active:scale-95 transition-all">Browse System</div>
              </div>
              <input type="file" className="hidden" accept="image/*,video/*" onChange={handleFileChange} />
            </label>
          )}
        </div>
        
        {/* Metadata Panel */}
        <div className="w-full md:w-[380px] flex flex-col bg-zinc-950/60 backdrop-blur-xl shrink-0 overflow-y-auto no-scrollbar">
           <div className="flex-1 p-6 md:p-8 space-y-8 pb-10">
              <div className="relative">
                <label className="text-[10px] font-black uppercase text-zinc-700 block mb-4 tracking-[0.2em]">Narrative Protocol</label>
                <div className="relative">
                  <textarea 
                    value={caption} 
                    onChange={e => setCaption(e.target.value)}
                    className="w-full h-32 md:h-56 bg-black border border-zinc-900 rounded-[2rem] p-6 text-sm outline-none resize-none focus:border-pink-500/20 transition-all text-white placeholder:text-zinc-800 font-medium leading-relaxed"
                    placeholder="Provide a narrative for this artifact..."
                  />
                  <button 
                    onClick={handleGenerateAICaption} 
                    disabled={isGeneratingCaption || !file}
                    className="absolute bottom-5 right-5 p-3 bg-zinc-900 rounded-2xl text-purple-400 border border-zinc-800 hover:border-purple-500/50 transition-all disabled:opacity-30 shadow-xl"
                  >
                    {isGeneratingCaption ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              
              <div className="p-6 bg-black/40 border border-zinc-900/50 rounded-[2.5rem] space-y-4">
                 <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-zinc-700">
                    <span>Artifact Class</span>
                    <span className="text-white px-2 py-0.5 rounded-full bg-zinc-800">{mediaType}</span>
                 </div>
                 <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-zinc-700">
                    <span>Security</span>
                    <span className="text-pink-500">ENCRYPTED</span>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default CreatePost;
