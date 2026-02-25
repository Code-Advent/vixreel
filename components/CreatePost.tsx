
import React, { useState, useRef } from 'react';
import { 
  X, Wand2, Loader2, Image as ImageIcon, Video, 
  UploadCloud, ChevronRight, Columns2, Scissors,
  MapPin, Lock, MessageSquare, Smile, Sparkles,
  Globe, EyeOff, Check
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { generateAIText, generateAIImage } from '../services/geminiService';
import { sanitizeFilename } from '../lib/utils';
import { Post } from '../types';
import { useTranslation } from '../lib/translation';

interface CreatePostProps {
  userId: string;
  onClose: () => void;
  onPostSuccess: () => void;
  duetSource?: Post | null;
  stitchSource?: Post | null;
}

const CreatePost: React.FC<CreatePostProps> = ({ userId, onClose, onPostSuccess, duetSource, stitchSource }) => {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [privacy, setPrivacy] = useState<'PUBLIC' | 'FOLLOWERS' | 'PRIVATE'>('PUBLIC');
  const [allowComments, setAllowComments] = useState(true);
  const [feeling, setFeeling] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
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

  const handleGenerateAIImage = async () => {
    if (isGeneratingImage || !caption) {
      alert("Please write a description in the caption first to guide the AI.");
      return;
    }
    setIsGeneratingImage(true);
    try {
      const imageUrl = await generateAIImage(caption);
      if (imageUrl) {
        // Convert base64 to File object
        const res = await fetch(imageUrl);
        const blob = await res.blob();
        const generatedFile = new File([blob], `ai-gen-${Date.now()}.png`, { type: 'image/png' });
        setFile(generatedFile);
        setPreview(imageUrl);
        setMediaType('image');
      } else {
        alert("Failed to generate image. Please try a different description.");
      }
    } finally { setIsGeneratingImage(false); }
  };

  const handlePost = async () => {
    if (!file || isPosting) return;
    setIsPosting(true);
    const safeFilename = sanitizeFilename(file.name);
    const fileName = `${Date.now()}-${safeFilename}`;
    const filePath = `${userId}/${fileName}`;
    try {
      const { error: uploadErr } = await supabase.storage
        .from('posts')
        .upload(filePath, file, {
          upsert: true,
          contentType: file.type
        });

      if (uploadErr) throw uploadErr;

      const { data: { publicUrl } } = supabase.storage.from('posts').getPublicUrl(filePath);
      
      const { data: newPost, error: insertErr } = await supabase.from('posts').insert({
        user_id: userId, 
        media_url: publicUrl, 
        media_type: mediaType, 
        caption: caption.trim(),
        location_name: location, // Assuming we add location_name or just use location_id
        privacy,
        allow_comments: allowComments,
        feeling,
        duet_from_id: duetSource?.id,
        stitch_from_id: stitchSource?.id
      }).select().single();

      if (insertErr) throw insertErr;

      if (duetSource && newPost) {
        await supabase.from('duets').insert({
          user_id: userId,
          original_post_id: duetSource.id,
          duet_post_id: newPost.id
        });
      }

      if (stitchSource && newPost) {
        await supabase.from('stitches').insert({
          user_id: userId,
          original_post_id: stitchSource.id,
          stitch_post_id: newPost.id
        });
      }

      onPostSuccess();
      onClose();
    } catch (err: any) {
      console.error("Post Upload Error:", err);
      alert(err.message || "Failed to share post.");
    } finally { setIsPosting(false); }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-[var(--vix-bg)] flex flex-col items-center animate-vix-in overflow-y-auto no-scrollbar">
      {/* Header */}
      <div className="w-full flex items-center justify-between p-6 bg-[var(--vix-bg)] border-b border-[var(--vix-border)] sticky top-0 z-50">
        <button onClick={onClose} className="p-2 text-zinc-500 hover:text-[var(--vix-text)]"><X className="w-6 h-6" /></button>
        <span className="font-bold text-sm uppercase tracking-widest text-[var(--vix-text)]">
          {duetSource ? t('New Duet') : stitchSource ? t('New Stitch') : t('New Post')}
        </span>
        <button onClick={handlePost} disabled={!file || isPosting} className="vix-gradient px-8 py-2 rounded-full text-white font-bold text-xs uppercase disabled:opacity-20 shadow-lg shadow-pink-500/20">
          {isPosting ? <Loader2 className="w-4 h-4 animate-spin" /> : t('Share')}
        </button>
      </div>

      <div className="w-full max-w-5xl flex-1 flex flex-col md:flex-row overflow-visible p-6 sm:p-12 gap-12">
        {/* Upload Area */}
        <div className="flex-1 bg-[var(--vix-card)] flex flex-col items-center justify-center rounded-[3rem] border border-[var(--vix-border)] min-h-[400px] relative p-8 shadow-2xl">
          {duetSource && (
            <div className="absolute top-6 left-6 flex items-center gap-2 bg-blue-500/10 px-4 py-2 rounded-full border border-blue-500/20 z-10">
              <Columns2 className="w-3 h-3 text-blue-500" />
              <span className="text-[9px] font-black uppercase tracking-widest text-blue-500">{t('Duet with')} @{duetSource.user.username}</span>
            </div>
          )}
          {stitchSource && (
            <div className="absolute top-6 left-6 flex items-center gap-2 bg-purple-500/10 px-4 py-2 rounded-full border border-purple-500/20 z-10">
              <Scissors className="w-3 h-3 text-purple-500" />
              <span className="text-[9px] font-black uppercase tracking-widest text-purple-500">{t('Stitch with')} @{stitchSource.user.username}</span>
            </div>
          )}
          {preview ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-8">
               <div className="relative max-h-[60vh] flex items-center justify-center w-full gap-4">
                  {duetSource && (
                    <div className="flex-1 aspect-[9/16] bg-black rounded-2xl overflow-hidden shadow-2xl border border-zinc-800">
                      <video src={duetSource.media_url} autoPlay loop muted className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className={`${duetSource ? 'flex-1 aspect-[9/16]' : 'w-full'} flex items-center justify-center`}>
                    {mediaType === 'video' ? (
                      <video src={preview} controls className="max-w-full max-h-[50vh] rounded-2xl shadow-2xl border border-zinc-800" />
                    ) : (
                      <img src={preview} className="max-w-full max-h-[50vh] rounded-2xl shadow-2xl object-contain border border-zinc-800" alt="Preview" />
                    )}
                  </div>
                  <button onClick={() => {setFile(null); setPreview(null);}} className="absolute -top-4 -right-4 bg-[var(--vix-secondary)] p-3 rounded-full text-[var(--vix-text)] border border-[var(--vix-border)] shadow-xl hover:bg-red-500 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
               </div>
               <button onClick={() => fileInputRef.current?.click()} className="px-6 py-2 rounded-full border border-[var(--vix-border)] text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-[var(--vix-text)] transition-all">Replace Media</button>
            </div>
          ) : (
            <div className="text-center space-y-10 flex flex-col items-center animate-vix-in">
               <div className="w-40 h-40 rounded-[4rem] bg-[var(--vix-secondary)]/50 flex items-center justify-center border border-[var(--vix-border)] shadow-2xl group transition-all hover:scale-105 duration-500">
                  <UploadCloud className="w-16 h-16 text-zinc-800 group-hover:text-pink-500 transition-colors" />
               </div>
               <div className="space-y-6">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-black text-[var(--vix-text)] uppercase tracking-tight">Select Media</h2>
                    <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-black max-w-xs">High Resolution Photo or Video (max 50MB)</p>
                  </div>
                  <button 
                    onClick={() => fileInputRef.current?.click()} 
                    className="vix-gradient px-14 py-5 rounded-[2rem] font-black text-[11px] uppercase tracking-widest text-white shadow-2xl shadow-pink-500/30 active:scale-95 transition-all hover:scale-105"
                  >
                    CHOOSE FILE
                  </button>
               </div>
            </div>
          )}
          <input ref={fileInputRef} type="file" className="hidden" accept="image/*,video/*" onChange={handleFileChange} />
        </div>

        {/* Sidebar Controls */}
        <div className="w-full md:w-96 flex flex-col gap-8">
          <div className="bg-[var(--vix-card)] border border-[var(--vix-border)] rounded-[3rem] p-10 space-y-8 shadow-2xl">
            <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-600">{t('Post Details')}</h3>
            <textarea 
              value={caption} 
              onChange={e => setCaption(e.target.value)} 
              className="w-full h-48 bg-[var(--vix-bg)]/50 border border-[var(--vix-border)] rounded-2xl p-6 text-sm text-[var(--vix-text)] outline-none resize-none focus:border-pink-500/30 transition-all shadow-inner placeholder:text-zinc-700" 
              placeholder={t('Write a caption... Use @username to mention creators.')}
            />
            <button 
              onClick={handleGenerateAICaption} 
              disabled={isGeneratingCaption} 
              className="w-full py-5 border border-[var(--vix-border)] rounded-2xl flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:bg-[var(--vix-secondary)] hover:text-[var(--vix-text)] transition-all group"
            >
              {isGeneratingCaption ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <><Wand2 className="w-4 h-4 group-hover:text-pink-500" /> {t('AI Caption Helper')}</>
              )}
            </button>
          </div>

          <div className="bg-[var(--vix-card)] border border-[var(--vix-border)] rounded-[3rem] p-8 space-y-6 shadow-2xl">
            <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-600 px-2">{t('Creative Tools')}</h3>
            
            <div className="space-y-4">
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">
                  <MapPin className="w-4 h-4" />
                </div>
                <input 
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder={t('Add Location')}
                  className="w-full bg-[var(--vix-bg)]/50 border border-[var(--vix-border)] rounded-2xl pl-12 pr-6 py-4 text-xs text-[var(--vix-text)] outline-none focus:border-pink-500/30 transition-all"
                />
              </div>

              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">
                  <Smile className="w-4 h-4" />
                </div>
                <input 
                  value={feeling}
                  onChange={e => setFeeling(e.target.value)}
                  placeholder={t('Feeling / Activity')}
                  className="w-full bg-[var(--vix-bg)]/50 border border-[var(--vix-border)] rounded-2xl pl-12 pr-6 py-4 text-xs text-[var(--vix-text)] outline-none focus:border-pink-500/30 transition-all"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-[var(--vix-border)] space-y-4">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-3">
                  <Lock className="w-4 h-4 text-zinc-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">{t('Privacy')}</span>
                </div>
                <select 
                  value={privacy}
                  onChange={e => setPrivacy(e.target.value as any)}
                  className="bg-transparent text-[10px] font-black uppercase tracking-widest text-pink-500 outline-none cursor-pointer"
                >
                  <option value="PUBLIC">{t('Public')}</option>
                  <option value="FOLLOWERS">{t('Followers')}</option>
                  <option value="PRIVATE">{t('Private')}</option>
                </select>
              </div>

              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-3">
                  <MessageSquare className="w-4 h-4 text-zinc-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">{t('Allow Comments')}</span>
                </div>
                <button 
                  onClick={() => setAllowComments(!allowComments)}
                  className={`w-10 h-5 rounded-full relative transition-all ${allowComments ? 'bg-pink-500' : 'bg-zinc-800'}`}
                >
                  <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${allowComments ? 'right-1' : 'left-1'}`} />
                </button>
              </div>
            </div>
          </div>

          <div className="bg-[var(--vix-card)] border border-[var(--vix-border)] rounded-[2.5rem] p-8 flex items-center justify-between shadow-xl group cursor-pointer hover:border-pink-500/30 transition-all" onClick={handleGenerateAIImage}>
             <div className="flex items-center gap-4">
                <div className="p-3 bg-[var(--vix-secondary)] rounded-2xl group-hover:bg-pink-500/10 transition-colors">
                  {isGeneratingImage ? <Loader2 className="w-4 h-4 text-pink-500 animate-spin" /> : <Sparkles className="w-4 h-4 text-pink-500" />}
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-[var(--vix-text)] uppercase tracking-widest">{t('AI Image Generator')}</span>
                  <span className="text-[8px] text-zinc-500 uppercase tracking-tighter">{t('Create media from your caption')}</span>
                </div>
             </div>
             <ChevronRight className="w-4 h-4 text-zinc-800" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreatePost;
