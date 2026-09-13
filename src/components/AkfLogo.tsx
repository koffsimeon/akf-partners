import React, { useState } from 'react';

interface AkfLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function AkfLogo({ className = '', size = 'md' }: AkfLogoProps) {
  // Try candidate image sources in sequence:
  // 1. /AKF 2-1.jpg (exact original file name if user placed it in public/)
  // 2. /akf-logo.jpg
  // 3. /akf-logo.svg (vector version faithful to official badge)
  const sources = ['/AKF 2-1.jpg', '/akf-logo.jpg', '/akf-logo.svg'];
  const [sourceIndex, setSourceIndex] = useState(0);

  const handleError = () => {
    if (sourceIndex < sources.length - 1) {
      setSourceIndex((prev) => prev + 1);
    }
  };

  const dimensionClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10 sm:h-11 sm:w-11',
    lg: 'h-14 w-14',
  }[size];

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 rounded-full bg-white p-0.5 shadow-xs border border-slate-200/80 overflow-hidden ${dimensionClasses} ${className}`}
    >
      <img
        src={sources[sourceIndex]}
        alt="Logo officiel AKF Partners - All Koff's Food"
        referrerPolicy="no-referrer"
        onError={handleError}
        className="h-full w-full object-contain rounded-full select-none"
        loading="eager"
        decoding="async"
      />
    </div>
  );
}
