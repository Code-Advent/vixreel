
import React, { useState } from 'react';
import { Image as ImageIcon, Sparkles, X, Video, Wand2, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { generateAIText } from '../services/geminiService';

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
  const [type, setType] = useState<'image' | 'video'>('image');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
      setType(selectedFile.type.startsWith('video') ? 'video' : 'image');
    }
  };

  const handleGenerateAICaption = async () => {
    if (isGeneratingCaption) return;
    setIsGeneratingCaption(true);
    
    try {
      const prompt = caption 
        ? `Enhance this caption for a VixReel post: "${caption}"` 
        : "Generate a trendy, short, and engaging Instagram-style caption for a beautiful creative photo/video on VixReel.";
      
      const aiCaption = await generateAIText(prompt);
      setCaption(aiCaption);
    } catch (error) {
      console.error("Caption generation failed", error);
    } finally {
      setIsGeneratingCaption(false);
    }
  };

  const handlePost = async () => {
    if (!file || isPosting) return;
    setIsPosting(true);

    // Use specific 'posts' bucket
    const fileName = `${userId}-${Date.now()}-${file.name}`;
    const filePath = `feed/${fileName}`;

    try {
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('posts')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('posts').getPublicUrl(filePath);
      
      const { error: dbError } = await supabase.from('posts').insert({
        user_id: userId,
        media_url: publicUrl,
        media_type: type,
        caption: caption
      });

      if (dbError) throw dbError;

      onPostSuccess();
      onClose();
    } catch (err: any) {
      alert("Error sharing post: " + err.message);
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row h-[90vh] md:h-[600px] shadow-2xl animate-vix-in">
        
        <div className="md:hidden border-b border-zinc-800 p-4 flex justify-between items-center">
          <button onClick={onClose}><X className="w-6 h-6" /></button>
          <h2 className="font-bold">New Post</h2>
          <button 
            onClick={handlePost} 
            disabled={!file || isPosting}
            className="vix-text-gradient font-bold disabled:opacity-50 text-sm"
          >
            {isPosting ? 'Posting...' : 'Share'}
          </button>
        </div>

        <div className="flex-1 bg-black flex items-center justify-center relative overflow-hidden">
          {preview ? (
            <div className="w-full h-full relative group">
              {type === 'video' ? (
                <video src={preview} controls className="w-full h-full object-contain" />
              ) : (
                <img src={preview} className="w-full h-full object-contain" />
              )}
              <button 
                onClick={() => { setFile(null); setPreview(null); }}
                className="absolute top-4 right-4 bg-black/60 p-2 rounded-full hover:bg-black/80 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <label className="text-center cursor-pointer p-10 w-full h-full flex flex-col items-center justify-center hover:bg-zinc-900/40 transition-colors group">
              <div className="w-20 h-20 rounded-full bg-zinc-900 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <ImageIcon className="w-10 h-10 text-zinc-600" />
              </div>
              <p className="text-xl font-bold text-zinc-300">Drag photos and videos here</p>
              <div className="mt-6 px-6 py-2 vix-gradient rounded-full text-sm font-bold shadow-lg shadow-pink-500/20">
                Select from computer
              </div>
              <input type="file" className="hidden" accept="image/*,video/*" onChange={handleFileChange} />
            </label>
          )}
        </div>

        <div className="w-full md:w-80 flex flex-col border-l border-zinc-800">
          <div className="hidden md:flex border-b border-zinc-800 p-4 justify-between items-center bg-zinc-900">
            <h2 className="font-bold text-sm">Create new post</h2>
            <button 
              onClick={handlePost} 
              disabled={!file || isPosting}
              className="vix-text-gradient font-bold disabled:opacity-50 text-sm"
            >
              {isPosting ? 'Posting...' : 'Share'}
            </button>
          </div>

          <div className="flex-1 p-5 space-y-6 overflow-y-auto bg-zinc-900/40">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Caption</label>
              <div className="relative">
                <textarea 
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="What's on your mind?..."
                  className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-2xl p-4 outline-none resize-none text-sm"
                />
                <button 
                  onClick={handleGenerateAICaption}
                  disabled={isGeneratingCaption}
                  className="absolute bottom-3 right-3 p-2 bg-zinc-900 rounded-xl hover:bg-zinc-800 border border-zinc-800 text-purple-400 disabled:opacity-50 transition-all flex items-center gap-2"
                >
                  {isGeneratingCaption ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreatePost;
