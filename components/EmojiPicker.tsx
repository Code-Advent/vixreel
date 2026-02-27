
import React from 'react';
import { X } from 'lucide-react';
import { useTranslation } from '../lib/translation';

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

const EMOJIS = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
  '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
  '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩',
  '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
  '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬',
  '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗',
  '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯',
  '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐',
  '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈',
  '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾',
  '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿',
  '😾', '👋', '🤚', '🖐', '✋', '🖖', '👌', '🤏', '✌️', '🤞',
  '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍',
  '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝',
  '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦵', '🦿', '🦶', '👂',
  '🦻', '👃', '🧠', '🦷', '🦴', '👀', '👁', '👅', '👄', '💋',
  '🩸', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎',
  '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟'
];

const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelect, onClose }) => {
  const { t } = useTranslation();

  return (
    <div className="absolute bottom-20 left-0 w-80 bg-[var(--vix-card)] border border-[var(--vix-border)] rounded-3xl shadow-2xl z-50 overflow-hidden animate-vix-in">
      <div className="p-4 border-b border-[var(--vix-border)] flex justify-between items-center bg-[var(--vix-secondary)]/20">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t('Emojis')}</h3>
        <button onClick={onClose} className="text-zinc-500 hover:text-[var(--vix-text)]"><X className="w-4 h-4" /></button>
      </div>
      
      <div className="p-4 grid grid-cols-8 gap-2 max-h-64 overflow-y-auto no-scrollbar">
        {EMOJIS.map(emoji => (
          <button 
            key={emoji}
            onClick={() => onSelect(emoji)}
            className="text-2xl hover:scale-125 transition-transform active:scale-90"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};

export default EmojiPicker;
