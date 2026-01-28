
import React from 'react';

const VerificationBadge: React.FC<{ size?: string }> = ({ size = 'w-3 h-3' }) => (
  <span className="inline-flex items-center ml-[2px] shrink-0 self-center">
    <svg 
      viewBox="0 0 24 24" 
      aria-label="Verified" 
      className={`${size} text-[#0095f6] fill-current drop-shadow-sm`} 
      fill="currentColor"
    >
      <path d="M12.003 21.312l-3.235-2.022-3.691.802.133-3.803-2.735-2.646 2.441-2.92-1.07-3.633 3.64-.842 1.63-3.449L12.003 4.2l2.887-1.425 1.63 3.449 3.64.842-1.07 3.633 2.441 2.92-2.735 2.646.133 3.803-3.691-.802-3.235 2.022zM10.15 14.885l4.823-4.83-1.061-1.06-3.762 3.766-1.704-1.704-1.06 1.06 2.764 2.768z" />
    </svg>
  </span>
);

export default VerificationBadge;
