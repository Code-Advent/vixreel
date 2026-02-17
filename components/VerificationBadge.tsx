
import React from 'react';

const VerificationBadge: React.FC<{ size?: string }> = ({ size = 'w-3 h-3' }) => (
  <span className="inline-flex items-center ml-1 shrink-0 relative group">
    <div className={`absolute inset-0 bg-blue-500/20 blur-md rounded-full ${size} opacity-0 group-hover:opacity-100 transition-opacity animate-pulse`}></div>
    <svg 
      viewBox="0 0 24 24" 
      aria-label="Vix Verified" 
      className={`${size} relative z-10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]`}
      fill="none"
    >
      <circle cx="12" cy="12" r="11" fill="#0095f6" />
      <path 
        d="M7 12l3 3 7-7" 
        stroke="white" 
        strokeWidth="3" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
    </svg>
  </span>
);

export default VerificationBadge;
