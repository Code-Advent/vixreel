
import React from 'react';

const VerificationBadge: React.FC<{ size?: string }> = ({ size = 'w-4 h-4' }) => (
  <span className="inline-flex items-center ml-1 shrink-0 relative group">
    <div className={`absolute inset-0 bg-pink-500/40 blur-sm rounded-full ${size} opacity-0 group-hover:opacity-100 transition-opacity animate-pulse`}></div>
    <svg 
      viewBox="0 0 24 24" 
      aria-label="Vix Verified" 
      className={`${size} relative z-10 drop-shadow-[0_0_8px_rgba(255,0,128,0.5)]`}
      fill="none"
    >
      <defs>
        <linearGradient id="vix-badge-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff0080" />
          <stop offset="100%" stopColor="#7928ca" />
        </linearGradient>
      </defs>
      <path 
        d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" 
        fill="url(#vix-badge-gradient)"
      />
      <path 
        d="M9 12l2 2 4-4" 
        stroke="white" 
        strokeWidth="2.5" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
    </svg>
  </span>
);

export default VerificationBadge;
