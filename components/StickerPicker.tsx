
import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Loader2, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Sticker, UserProfile } from '../types';
import { useTranslation } from '../lib/translation';

interface StickerPickerProps {
  currentUser: UserProfile;
  onSelect: (url: string) => void;
  onClose: () => void;
}

const StickerPicker: React.FC<StickerPickerProps> = ({ currentUser, onSelect, onClose }) => {
  const { t } = useTranslation();
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchStickers();
  }, []);

  const fetchStickers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('stickers')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setStickers(data || []);
    } catch (err) {
      console.error('Error fetching stickers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const fileName = `${currentUser.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('stickers')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('stickers').getPublicUrl(fileName);

      const { data: newSticker, error: insertError } = await supabase
        .from('stickers')
        .insert({
          user_id: currentUser.id,
          url: publicUrl
        })
        .select()
        .single();

      if (insertError) throw insertError;
      if (newSticker) setStickers(prev => [newSticker, ...prev]);
    } catch (err) {
      console.error('Error uploading sticker:', err);
      alert('Failed to create sticker');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="absolute bottom-20 left-0 w-80 bg-[var(--vix-card)] border border-[var(--vix-border)] rounded-3xl shadow-2xl z-50 overflow-hidden animate-vix-in">
      <div className="p-4 border-b border-[var(--vix-border)] flex justify-between items-center bg-[var(--vix-secondary)]/20">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t('Stickers')}</h3>
        <button onClick={onClose} className="text-zinc-500 hover:text-[var(--vix-text)]"><X className="w-4 h-4" /></button>
      </div>
      
      <div className="p-4 grid grid-cols-4 gap-2 max-h-64 overflow-y-auto no-scrollbar">
        <button 
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="aspect-square rounded-xl border-2 border-dashed border-[var(--vix-border)] flex flex-col items-center justify-center text-zinc-500 hover:border-pink-500 hover:text-pink-500 transition-all group"
        >
          {isUploading ? <Loader2 className="w-5 h-5 animate-spin vix-loader" /> : <Plus className="w-5 h-5" />}
          <span className="text-[8px] font-black uppercase mt-1">{t('Create')}</span>
        </button>
        
        {loading ? (
          <div className="col-span-3 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin vix-loader" /></div>
        ) : stickers.map(sticker => (
          <button 
            key={sticker.id}
            onClick={() => onSelect(sticker.url)}
            className="aspect-square rounded-xl overflow-hidden hover:scale-110 transition-transform active:scale-90"
          >
            <img src={sticker.url} className="w-full h-full object-contain" alt="Sticker" />
          </button>
        ))}
      </div>
      
      <input 
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleUpload}
        className="hidden"
      />
    </div>
  );
};

export default StickerPicker;
