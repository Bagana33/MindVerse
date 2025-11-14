"use client";
import React, { useState, useRef, useEffect } from 'react';

interface PostImageProps {
  src: string;
  alt: string;
  className?: string;
  rounded?: string; // tailwind rounded utility override
}

// Utility to join class names
function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ');
}

export const PostImage: React.FC<PostImageProps> = ({ src, alt, className, rounded = 'rounded-2xl' }) => {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    if (img.complete && img.naturalWidth) {
      setNatural({ w: img.naturalWidth, h: img.naturalHeight });
      setLoaded(true);
    }
  }, []);

  const onLoad = () => {
    if (imgRef.current) {
      setNatural({ w: imgRef.current.naturalWidth, h: imgRef.current.naturalHeight });
      setLoaded(true);
    }
  };

  const orientation = natural ? (natural.w === natural.h ? 'square' : natural.w > natural.h ? 'landscape' : 'portrait') : 'unknown';

  // Relaxed sizing: a single max height for consistency, allow full containment
  const sizeClass = 'max-h-[600px]';

  return (
    <div
      className={cn(
        'group relative overflow-hidden border border-slate-700/50 shadow-lg transition-all duration-400 bg-slate-950/10 backdrop-blur-sm',
        rounded,
        sizeClass,
        className
      )}
    >
      {/* Decorative elements now only on hover for cleaner idle look */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-600/0 via-fuchsia-500/0 to-sky-500/0 group-hover:from-violet-600/15 group-hover:via-fuchsia-500/10 group-hover:to-sky-500/15 transition-opacity duration-500" aria-hidden="true" />
      <div
        className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-0 group-hover:opacity-25 transition-opacity duration-500"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)',
          backgroundSize: '6px 6px'
        }}
        aria-hidden="true"
      />
      {/* Edge frame subtle until hover */}
      <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-violet-400/10 group-hover:ring-violet-400/30 transition duration-500 pointer-events-none" aria-hidden="true" />

      {/* Skeleton loader */}
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-full h-full animate-pulse bg-gradient-to-br from-slate-800/60 via-slate-700/40 to-slate-800/60" />
        </div>
      )}

      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={onLoad}
        className={cn(
          'w-full h-full object-contain transition-transform duration-700',
          loaded ? 'opacity-100' : 'opacity-0',
          'group-hover:scale-[1.03]'
        )}
        style={{
          objectPosition: 'center'
        }}
      />

      {/* Subtle top sheen */}
      <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-white/5 to-transparent group-hover:from-white/15 pointer-events-none transition-colors duration-500" aria-hidden="true" />
    </div>
  );
};

export default PostImage;
