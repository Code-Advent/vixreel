
import React, { useState } from 'react';
import { Image as ImageIcon, X, Wand2, Loader2, Video as VideoIcon } from 'lucide-react';
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 50 * 1024 * 1024) { // 50MB limit
         alert("File is too large. Premium storage limit is 50MB.");
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
      const prompt = caption ? `Enhance: ${caption}` : "Create an elite short trendy caption for VixReel.";
      const aiCaption = await generateAIText(prompt);
      setCaption(aiCaption);
    } finally {
      setIsGeneratingCaption(false);
    }
  };

  const handlePost = async () => {
    if (!file || isPosting) return;
    setIsPosting(true);
    
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

      if (upErr) throw upErr;
      
      // 2. Get Public URL
      const { data: { publicUrl } } = supabase.storage.from('posts').getPublicUrl(filePath);
      
      // 3. Insert Database Record
      const { error: dbErr } = await supabase.from('posts').insert({
        user_id: userId,
        media_url: publicUrl,
        media_type: mediaType,
        caption: caption
      });

      if (dbErr) throw dbErr;
      
      onPostSuccess();
      onClose();
    } catch (err: any) {
      console.error("VixReel Upload Error:", err);
      alert("Sharing failed: " + (err.message || "Network error. Please ensure the 'posts' bucket exists."));
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-[3rem] w-full max-w-4xl h-[600px] overflow-hidden flex flex-col md:flex-row shadow-[0_0_100px_rgba(0,0,0,1)] animate-vix-in">
        <div className="flex-1 bg-black flex items-center justify-center relative border-r border-zinc-800/50">
          {preview ? (
            <div className="w-full h-full relative">
              {mediaType === 'video' ? (
                <video src={preview} controls className="w-full h-full object-contain" />
              ) : (
                <img src={preview} className="w-full h-full object-contain" alt="Preview" />
              )}
              <button 
                onClick={() => {setFile(null); setPreview(null);}} 
                className="absolute top-6 right-6 bg-black/60 backdrop-blur-xl p-3 rounded-full hover:bg-zinc-800 transition-colors border border-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <label className="text-center cursor-pointer p-10 flex flex-col items-center gap-6 group">
              <div className="w-24 h-24 rounded-[2rem] bg-zinc-900 flex items-center justify-center group-hover:bg-zinc-800 transition-all border border-zinc-800 border-dashed">
                <ImageIcon className="w-10 h-10 text-zinc-700" />
              </div>
              <div className="space-y-2">
                <p className="font-black uppercase tracking-[0.3em] text-[10px] text-zinc-500">Inject Media Presence</p>
                <p className="text-zinc-700 text-[10px] font-bold">Standard format up to 50MB</p>
              </div>
              <div className="vix-gradient px-10 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-pink-500/10">Browse System</div>
              <input type="file" className="hidden" accept="image/*,video/*" onChange={handleFileChange} />
            </label>
          )}
        </div>
        
        <div className="w-full md:w-80 flex flex-col bg-zinc-950/40">
           <div className="p-6 border-b border-zinc-900 flex justify-between items-center">
              <h2 className="font-black uppercase text-[10px] tracking-widest text-zinc-500">Dialogue Metadata</h2>
              <button 
                onClick={handlePost} 
                disabled={!file || isPosting} 
                className="vix-text-gradient font-black text-xs tracking-[0.2em] uppercase disabled:opacity-20 hover:scale-105 transition-transform"
              >
                {isPosting ? 'SYNCING...' : 'TRANSMIT'}
              </button>
           </div>
           
           <div className="flex-1 p-6 space-y-6">
              <div className="relative">
                <label className="text-[9px] font-black uppercase text-zinc-700 block mb-3 tracking-widest">Narrative Caption</label>
                <textarea 
                  value={caption} 
                  onChange={e => setCaption(e.target.value)}
                  className="w-full h-40 bg-black/40 border border-zinc-900 rounded-2xl p-5 text-sm outline-none resize-none focus:border-pink-500/20 transition-all text-white placeholder:text-zinc-800"
                  placeholder="Tell your story..."
                />
                <button 
                  onClick={handleGenerateAICaption} 
                  className="absolute bottom-4 right-4 p-2.5 bg-zinc-900 rounded-xl text-purple-400 border border-zinc-800 hover:border-purple-500/40 transition-all"
                  title="Generate AI Caption"
                >
                  {isGeneratingCaption ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                </button>
              </div>
              
              <div className="p-5 bg-zinc-900/40 border border-zinc-900 rounded-3xl space-y-3">
                 <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-zinc-600">
                    <span>Artifact Type</span>
                    <span className="text-white">{mediaType.toUpperCase()}</span>
                 </div>
                 <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-zinc-600">
                    <span>Encryption</span>
                    <span className="text-green-500">ACTIVE</span>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default CreatePost;
