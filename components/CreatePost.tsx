
import React, { useState, useRef } from 'react';
// Added ChevronRight to imports
import { X, Wand2, Loader2, Image as ImageIcon, Video, UploadCloud, ChevronRight } from 'lucide-react';
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 50 * 1024 * 1024) {
         alert("Max 50MB allowed.");
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
      const prompt = caption ? `Enhance: ${caption}` : "Write a cool short Instagram caption.";
      const aiCaption = await generateAIText(prompt);
      setCaption(aiCaption);
    } finally { setIsGeneratingCaption(false); }
  };

  const handlePost = async () => {
    if (!file || isPosting) return;
    setIsPosting(true);
    const safeFilename = sanitizeFilename(file.name);
    const fileName = `${userId}-${Date.now()}-${safeFilename}`;
    const filePath = `feed/${fileName}`;
    try {
      await supabase.storage.from('posts').upload(filePath, file);
      const { data: { publicUrl } } = supabase.storage.from('posts').getPublicUrl(filePath);
      await supabase.from('posts').insert({
        user_id: userId, media_url: publicUrl, media_type: mediaType, caption: caption
      });
      onPostSuccess();
      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally { setIsPosting(false); }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center animate-vix-in overflow-y-auto no-scrollbar">
      {/* Header */}
      <div className="w-full flex items-center justify-between p-6 bg-black border-b border-zinc-900 sticky top-0 z-50">
        <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white"><X className="w-6 h-6" /></button>
        <span className="font-bold text-sm uppercase tracking-widest text-white">New Creation</span>
        <button onClick={handlePost} disabled={!file || isPosting} className="vix-gradient px-8 py-2 rounded-full text-white font-bold text-xs uppercase disabled:opacity-20 shadow-lg shadow-pink-500/20">
          {isPosting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Share'}
        </button>
      </div>

      <div className="w-full max-w-5xl flex-1 flex flex-col md:flex-row overflow-visible p-6 sm:p-12 gap-12">
        {/* Upload Area */}
        <div className="flex-1 bg-zinc-950 flex flex-col items-center justify-center rounded-[3rem] border border-zinc-900 min-h-[400px] relative p-8 shadow-2xl">
          {preview ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-8">
               <div className="relative max-h-[60vh] flex items-center justify-center w-full">
                  {mediaType === 'video' ? (
                    <video src={preview} controls className="max-w-full max-h-[50vh] rounded-2xl shadow-2xl border border-zinc-800" />
                  ) : (
                    <img src={preview} className="max-w-full max-h-[50vh] rounded-2xl shadow-2xl object-contain border border-zinc-800" alt="Preview" />
                  )}
                  <button onClick={() => {setFile(null); setPreview(null);}} className="absolute -top-4 -right-4 bg-zinc-900 p-3 rounded-full text-white border border-zinc-800 shadow-xl hover:bg-red-500 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
               </div>
               <button onClick={() => fileInputRef.current?.click()} className="px-6 py-2 rounded-full border border-zinc-800 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-all">Replace Media</button>
            </div>
          ) : (
            <div className="text-center space-y-10 flex flex-col items-center animate-vix-in">
               <div className="w-40 h-40 rounded-[4rem] bg-zinc-900/50 flex items-center justify-center border border-zinc-800 shadow-2xl group transition-all hover:scale-105 duration-500">
                  <UploadCloud className="w-16 h-16 text-zinc-800 group-hover:text-pink-500 transition-colors" />
               </div>
               <div className="space-y-6">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-black text-white uppercase tracking-tight">Select Artifact</h2>
                    <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-black max-w-xs">High Resolution Photo or Video (max 50MB)</p>
                  </div>
                  <button 
                    onClick={() => fileInputRef.current?.click()} 
                    className="vix-gradient px-14 py-5 rounded-[2rem] font-black text-[11px] uppercase tracking-widest text-white shadow-2xl shadow-pink-500/30 active:scale-95 transition-all hover:scale-105"
                  >
                    CHOOSE FROM DEVICE
                  </button>
               </div>
            </div>
          )}
          <input ref={fileInputRef} type="file" className="hidden" accept="image/*,video/*" onChange={handleFileChange} />
        </div>

        {/* Sidebar Controls */}
        <div className="w-full md:w-96 flex flex-col gap-8">
          <div className="bg-zinc-950 border border-zinc-900 rounded-[3rem] p-10 space-y-8 shadow-2xl">
            <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-600">Narrative Details</h3>
            <textarea 
              value={caption} 
              onChange={e => setCaption(e.target.value)} 
              className="w-full h-48 bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 text-sm text-white outline-none resize-none focus:border-pink-500/30 transition-all shadow-inner placeholder:text-zinc-700" 
              placeholder="What's the story behind this artifact?" 
            />
            <button 
              onClick={handleGenerateAICaption} 
              disabled={isGeneratingCaption} 
              className="w-full py-5 border border-zinc-800 rounded-2xl flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:bg-zinc-900 hover:text-white transition-all group"
            >
              {isGeneratingCaption ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <><Wand2 className="w-4 h-4 group-hover:text-pink-500" /> AI Caption Engine</>
              )}
            </button>
          </div>

          <div className="bg-zinc-950 border border-zinc-900 rounded-[2.5rem] p-8 flex items-center justify-between shadow-xl">
             <div className="flex items-center gap-4">
                <div className="p-3 bg-zinc-900 rounded-2xl"><ImageIcon className="w-4 h-4 text-zinc-600" /></div>
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Post Settings</span>
             </div>
             <ChevronRight className="w-4 h-4 text-zinc-800" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreatePost;
