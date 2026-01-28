
import React, { useState } from 'react';
import { Image as ImageIcon, X, Wand2, Loader2 } from 'lucide-react';
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
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
      setMediaType(selectedFile.type.startsWith('video') ? 'video' : 'image');
    }
  };

  const handleGenerateAICaption = async () => {
    if (isGeneratingCaption) return;
    setIsGeneratingCaption(true);
    try {
      const prompt = caption ? `Enhance: ${caption}` : "Short trendy caption for VixReel.";
      const aiCaption = await generateAIText(prompt);
      setCaption(aiCaption);
    } finally {
      setIsGeneratingCaption(false);
    }
  };

  const handlePost = async () => {
    if (!file || isPosting) return;
    setIsPosting(true);
    const fileName = `${userId}-${Date.now()}-${sanitizeFilename(file.name)}`;
    const filePath = `feed/${fileName}`;
    try {
      const { error: upErr } = await supabase.storage.from('posts').upload(filePath, file);
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('posts').getPublicUrl(filePath);
      
      const { error: dbErr } = await supabase.from('posts').insert({
        user_id: userId,
        media_url: publicUrl,
        media_type: mediaType, // Standardized column name
        caption: caption
      });
      if (dbErr) throw dbErr;
      
      onPostSuccess();
      onClose();
    } catch (err: any) {
      alert("Sharing failed: " + err.message);
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-4xl h-[600px] overflow-hidden flex flex-col md:flex-row shadow-2xl animate-vix-in">
        <div className="flex-1 bg-black flex items-center justify-center relative border-r border-zinc-800">
          {preview ? (
            <div className="w-full h-full">
              {mediaType === 'video' ? <video src={preview} controls className="w-full h-full object-contain" /> : <img src={preview} className="w-full h-full object-contain" />}
              <button onClick={() => {setFile(null); setPreview(null);}} className="absolute top-4 right-4 bg-black/50 p-2 rounded-full"><X className="w-4 h-4" /></button>
            </div>
          ) : (
            <label className="text-center cursor-pointer p-10 flex flex-col items-center gap-4">
              <ImageIcon className="w-16 h-16 text-zinc-800 mb-2" />
              <p className="font-bold text-zinc-400">Select Media for VixReel</p>
              <div className="vix-gradient px-8 py-2.5 rounded-full text-xs font-black uppercase tracking-widest shadow-lg shadow-pink-500/20">Computer Access</div>
              <input type="file" className="hidden" accept="image/*,video/*" onChange={handleFileChange} />
            </label>
          )}
        </div>
        <div className="w-full md:w-80 flex flex-col bg-zinc-950">
           <div className="p-4 border-b border-zinc-900 flex justify-between items-center">
              <h2 className="font-black uppercase text-xs tracking-widest text-zinc-500">Metadata</h2>
              <button onClick={handlePost} disabled={!file || isPosting} className="vix-text-gradient font-black text-xs tracking-widest uppercase disabled:opacity-30">
                {isPosting ? 'Sharing...' : 'Share Now'}
              </button>
           </div>
           <div className="flex-1 p-5 space-y-6">
              <div className="relative">
                <textarea 
                  value={caption} 
                  onChange={e => setCaption(e.target.value)}
                  className="w-full h-32 bg-transparent border border-zinc-900 rounded-xl p-4 text-sm outline-none resize-none focus:border-zinc-700"
                  placeholder="Caption your visual story..."
                />
                <button onClick={handleGenerateAICaption} className="absolute bottom-3 right-3 p-2 bg-zinc-900 rounded-lg text-purple-400 border border-zinc-800">
                  {isGeneratingCaption ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                </button>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default CreatePost;
