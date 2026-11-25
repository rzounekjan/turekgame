import React from 'react';

interface NeonLogoTProps {
  size?: number;
  className?: string;
}

/**
 * Bespoke Neon Letter "T" Logo Emblem (inline SVG with authentic double-tube neon core)
 */
export const NeonLogoT: React.FC<NeonLogoTProps> = ({ size = 44, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 neon-drop-cyan ${className}`}
      aria-label="Logo TUREK"
    >
      <defs>
        <linearGradient id="turekNeonTube" x1="12" y1="12" x2="68" y2="68" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#67e8f9" />
          <stop offset="55%" stopColor="#00f0ff" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
        <linearGradient id="turekAmberTrim" x1="18" y1="16" x2="62" y2="16" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#fde047" />
        </linearGradient>
      </defs>

      {/* Outer octagonal neon housing frame */}
      <path
        d="M18 6H62L74 18V62L62 74H18L6 62V18L18 6Z"
        fill="#070c18"
        stroke="url(#turekNeonTube)"
        strokeWidth="2.4"
        strokeOpacity="0.88"
      />

      {/* Glowing outer tube contour of neon letter T */}
      <path
        d="M17 20H63V30H45.5V63H34.5V30H17V20Z"
        stroke="#00f0ff"
        strokeWidth="3.2"
        strokeLinejoin="round"
        fill="rgba(0, 240, 255, 0.08)"
      />

      {/* Inner incandescent neon filament core */}
      <path
        d="M21.5 25H58.5M40 25V58.5"
        stroke="#f0fdff"
        strokeWidth="2.4"
        strokeLinecap="round"
      />

      {/* Subtle warm highway accent tick below crossbar */}
      <path
        d="M24 34.5H31M49 34.5H56"
        stroke="url(#turekAmberTrim)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
};

/**
 * Bespoke Neon "TUREK" Title Lockup (inline SVG)
 */
export const NeonTitleTurek: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <NeonLogoT size={68} className="mb-3" />
      <svg
        viewBox="0 0 460 98"
        className="w-[min(84vw,420px)] h-auto neon-drop-cyan"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="TUREK"
      >
        <defs>
          <linearGradient id="turekWordGrad" x1="0" y1="0" x2="460" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#a5f3fc" />
            <stop offset="50%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#67e8f9" />
          </linearGradient>
          <linearGradient id="turekRoadRule" x1="40" y1="90" x2="420" y2="90" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00f0ff" stopOpacity="0" />
            <stop offset="22%" stopColor="#00f0ff" stopOpacity="0.95" />
            <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.95" />
            <stop offset="78%" stopColor="#00f0ff" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#00f0ff" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Outer neon tube halo stroke */}
        <text
          x="230"
          y="72"
          textAnchor="middle"
          fontFamily="Oxanium, sans-serif"
          fontWeight="800"
          fontSize="76"
          letterSpacing="14"
          stroke="#00f0ff"
          strokeWidth="6"
          strokeOpacity="0.45"
          fill="none"
        >
          TUREK
        </text>

        {/* Crisp incandescent neon lettering */}
        <text
          x="230"
          y="72"
          textAnchor="middle"
          fontFamily="Oxanium, sans-serif"
          fontWeight="800"
          fontSize="76"
          letterSpacing="14"
          stroke="#00f0ff"
          strokeWidth="1.6"
          fill="url(#turekWordGrad)"
        >
          TUREK
        </text>

        {/* Clean highway horizon accent rule */}
        <line
          x1="44"
          y1="90"
          x2="416"
          y2="90"
          stroke="url(#turekRoadRule)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};
