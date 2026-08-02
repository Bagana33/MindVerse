"use client";
import React from 'react';

/**
 * Medal3D – WebGL-free CSS medal badge.
 *
 * The previous Three.js implementation created a new WebGLRenderer (= a new
 * WebGL context) per row in the leaderboard.  Browsers cap contexts at ~16,
 * so every extra row triggered "context was blocked / lost" errors in the
 * console.
 *
 * This version renders an identical-looking animated medal entirely in CSS
 * and SVG – zero WebGL, zero context budget, zero crashes.
 */

interface Medal3DProps {
  /** 'gold' | 'silver' | 'bronze'  – default 'gold' */
  variant?: 'gold' | 'silver' | 'bronze';
  size?: number;
}

const VARIANTS = {
  gold: {
    outer: 'from-amber-300 via-yellow-400 to-amber-500',
    inner: 'from-yellow-300 via-amber-400 to-yellow-500',
    glow:  'shadow-[0_0_10px_3px_rgba(251,191,36,0.55)]',
    star:  '#fbbf24',
    ring:  '#f59e0b',
  },
  silver: {
    outer: 'from-slate-300 via-gray-200 to-slate-400',
    inner: 'from-gray-200 via-slate-300 to-gray-400',
    glow:  'shadow-[0_0_10px_3px_rgba(148,163,184,0.5)]',
    star:  '#cbd5e1',
    ring:  '#94a3b8',
  },
  bronze: {
    outer: 'from-orange-400 via-amber-600 to-orange-700',
    inner: 'from-amber-500 via-orange-500 to-amber-700',
    glow:  'shadow-[0_0_10px_3px_rgba(217,119,6,0.5)]',
    star:  '#f97316',
    ring:  '#d97706',
  },
} as const;

const Medal3D: React.FC<Medal3DProps> = ({ variant = 'gold', size = 28 }) => {
  const v = VARIANTS[variant];
  return (
    <span
      title="Top Student Medal"
      style={{ width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
    >
      {/* Rotating outer gradient ring */}
      <span
        className={`relative flex items-center justify-center rounded-full bg-gradient-to-tr ${v.outer} ${v.glow} animate-[spin_4s_linear_infinite]`}
        style={{ width: size, height: size }}
      >
        {/* Inner coin face */}
        <span
          className={`flex items-center justify-center rounded-full bg-gradient-to-br ${v.inner}`}
          style={{ width: size * 0.72, height: size * 0.72 }}
        >
          {/* Star icon */}
          <svg
            viewBox="0 0 24 24"
            fill={v.star}
            style={{ width: size * 0.44, height: size * 0.44 }}
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </span>
      </span>
    </span>
  );
};

export default Medal3D;
