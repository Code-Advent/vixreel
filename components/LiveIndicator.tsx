
import React from 'react';
import { UserProfile } from '../types';

interface LiveIndicatorProps {
  user: UserProfile;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  onClick?: () => void;
}

const LiveIndicator: React.FC<LiveIndicatorProps> = ({ user, children, size = 'md', showText = true, onClick }) => {
  if (!user.is_live) {
    return <div onClick={onClick} className="cursor-pointer">{children}</div>;
  }

  const sizeClasses = {
    sm: 'p-[1.5px] w-8 h-8',
    md: 'p-[2px] w-10 h-10',
    lg: 'p-[2.5px] w-16 h-16',
    xl: 'p-[3px] w-24 h-24'
  };

  const textClasses = {
    sm: 'text-[6px] px-1 py-0',
    md: 'text-[7px] px-1.5 py-0.5',
    lg: 'text-[9px] px-2 py-0.5',
    xl: 'text-[10px] px-3 py-1'
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <div 
        onClick={onClick}
        className={`relative rounded-full border-2 border-red-500 animate-pulse cursor-pointer transition-all hover:scale-105 active:scale-95`}
        style={{ padding: '2px' }}
      >
        <div className="rounded-full overflow-hidden w-full h-full">
          {children}
        </div>
        
        {showText && (
          <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 bg-red-500 text-white font-black uppercase tracking-tighter rounded-sm shadow-lg z-10 ${textClasses[size]}`}>
            LIVE
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveIndicator;
