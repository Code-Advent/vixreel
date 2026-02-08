
import React, { useState, useRef } from 'react';
import { X, Wand2, Loader2, Send, Film, ShieldCheck, Upload, Sparkles, Image as ImageIcon } from 'lucide-react';
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
         alert("File is too large (max 50MB).");
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
      const prompt = caption ? `Make this caption better: ${caption}` : "Write a cool caption for a new photo.";
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
      onClose();
    } catch (err: any) {
      alert("Error sharing post: " + err.message);
    } finally { setIsPosting(false); }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center animate-vix-in">
      {/* Header */}
      <div className="w-full flex items-center justify-between p-6 bg-black border-b border-zinc-900">
        <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white">
          <X className="w-6 h-6" />
        </button>
        <span className="font-bold text-sm uppercase tracking-widest text-white">New Post</span>
        <button 
          onClick={handlePost} 
          disabled={!file || isPosting} 
          className="vix-gradient px-8 py-2 rounded-full text-white font-bold text-xs uppercase disabled:opacity-20"
        >
          {isPosting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Share'}
        </button>
      </div>

      <div className="w-full max-w-4xl flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Upload/Preview Zone */}
        <div className="flex-1 bg-zinc-950 flex flex-col items-center justify-center p-6 border-b md:border-b-0 md:border-r border-zinc-900 relative">
          {preview ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-4">
               <div className="relative w-full max-h-[60vh] flex items-center justify-center">
                  {mediaType === 'video' ? (
                    <video src={preview} controls className="max-w-full max-h-full rounded-2xl shadow-2xl" />
                  ) : (
                    <img src={preview} className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain" alt="Preview" />
                  )}
                  <button onClick={() => {setFile(null); setPreview(null);}} className="absolute top-2 right-2 bg-black/70 p-2 rounded-full text-white">
                    <X className="w-4 h-4" />
                  </button>
               </div>
               <button 
                 onClick={() => fileInputRef.current?.click()}
                 className="text-xs font-bold text-zinc-500 hover:text-white transition-colors"
               >
                 Change Photo/Video
               </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center space-y-8 py-12">
               <div className="w-40 h-40 rounded-[3rem] bg-zinc-900 flex items-center justify-center border border-zinc-800">
                  <ImageIcon className="w-16 h-16 text-zinc-800" />
               </div>
               <div className="space-y-4">
                  <h2 className="text-2xl font-bold text-white">Upload Your Post</h2>
                  <p className="text-xs text-zinc-500 max-w-xs mx-auto">Share your best photos or videos with your followers.</p>
                  <button 
                    onClick={() => fileInputRef.current?.click()} 
                    className="vix-gradient px-10 py-4 rounded-2xl text-white font-bold text-sm shadow-xl active:scale-95 transition-all"
                  >
                    Select Photo or Video
                  </button>
               </div>
               <input ref={fileInputRef} type="file" className="hidden" accept="image/*,video/*" onChange={handleFileChange} />
            </div>
          )}
        </div>

        {/* Caption Zone */}
        <div className={`w-full md:w-[400px] bg-black p-8 space-y-8 ${!file ? 'opacity-20 pointer-events-none' : ''}`}>
           <div className="space-y-4">
              <label className="text-[10px] font-bold uppercase text-zinc-500 tracking-widest">Write a caption</label>
              <div className="relative group">
                 <textarea 
                    value={caption} 
                    onChange={e => setCaption(e.target.value)}
                    className="w-full h-40 bg-zinc-900/50 border border-zinc-900 rounded-2xl p-6 text-sm outline-none focus:border-pink-500/30 text-white resize-none"
                    placeholder="Write something interesting..."
                 />
                 <button 
                    onClick={handleGenerateAICaption} 
                    disabled={isGeneratingCaption || !file}
                    className="absolute bottom-4 right-4 p-3 bg-zinc-800 rounded-xl text-pink-500 hover:scale-110 active:scale-90 transition-all shadow-lg"
                    title="AI Magic"
                 >
                    {isGeneratingCaption ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                 </button>
              </div>
           </div>

           <div className="p-5 bg-zinc-900/30 border border-zinc-900 rounded-2xl flex items-center gap-4">
              <ShieldCheck className="w-5 h-5 text-zinc-600" />
              <div className="text-[10px] text-zinc-500 font-bold uppercase">Safe for sharing</div>
           </div>
        </div>
      </div>
      
      {/* Upload Progress Overlay */}
      {isPosting && (
        <div className="absolute inset-0 z-[10000] bg-black/90 flex flex-col items-center justify-center p-8 text-center backdrop-blur-sm">
           <Loader2 className="w-12 h-12 text-pink-500 animate-spin mb-6" />
           <h3 className="text-xl font-bold text-white mb-2">Posting...</h3>
           <div className="w-full max-w-xs h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full vix-gradient transition-all duration-300" style={{ width: `${progress}%` }}></div>
           </div>
        </div>
      )}
    </div>
  );
};

export default CreatePost;
