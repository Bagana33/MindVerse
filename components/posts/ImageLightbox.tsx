"use client";
import React, { useEffect, useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface ImageLightboxProps {
  src: string;
  alt: string;
  onClose: () => void;
  caption?: string;
}

export const ImageLightbox: React.FC<ImageLightboxProps> = ({ src, alt, onClose, caption }) => {
  const [mounted, setMounted] = useState(false);
  const [zoom, setZoom] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === ' ') e.preventDefault(); // prevent page scroll
  }, [onClose]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  const toggleZoom = () => setZoom(z => !z);

  const content = (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[999] flex items-center justify-center p-4 sm:p-8 bg-black/80 backdrop-blur-md"
      onClick={(e) => {
        if (e.target === containerRef.current) onClose();
      }}
    >
      <div className="absolute inset-0 pointer-events-none opacity-40 bg-[radial-gradient(circle_at_20%_20%,rgba(139,92,246,0.4),transparent_60%)]" />
      <div className="absolute inset-0 pointer-events-none opacity-30 bg-[radial-gradient(circle_at_80%_60%,rgba(236,72,153,0.35),transparent_55%)]" />
      <div className="relative max-w-6xl w-full flex flex-col gap-4">
        <div className="flex items-center justify-between text-xs text-slate-300 px-1">
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Viewing image
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleZoom}
              className="rounded-full px-3 py-1.5 bg-slate-800/60 hover:bg-slate-700/60 text-[11px] font-medium text-slate-200 border border-slate-700/70"
            >{zoom ? 'Fit' : 'Zoom'}</button>
            <a
              href={src}
              download
              className="rounded-full px-3 py-1.5 bg-slate-800/60 hover:bg-slate-700/60 text-[11px] font-medium text-slate-200 border border-slate-700/70"
            >Download</a>
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-full px-3 py-1.5 bg-slate-800/60 hover:bg-slate-700/60 text-[11px] font-semibold text-slate-100 border border-slate-700/70"
            >Close ✕</button>
          </div>
        </div>
        <div
          className={`relative mx-auto overflow-hidden rounded-2xl border border-slate-600/60 shadow-[0_8px_40px_-8px_rgba(0,0,0,0.6)] bg-slate-900/40 ${zoom ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
          onDoubleClick={toggleZoom}
        >
          <img
            src={src}
            alt={alt}
            className={`transition-all duration-500 ${zoom ? 'scale-[1.6] origin-center' : 'scale-100'} select-none`}
            style={{ maxHeight: '80vh', width: '100%', objectFit: 'contain' }}
            draggable={false}
          />
          {/* Decorative overlay */}
          <div className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-25" style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)',
            backgroundSize: '6px 6px'
          }} />
          <div className="absolute inset-0 ring-1 ring-inset ring-violet-500/30 rounded-2xl" />
          <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-white/10 to-transparent" />
        </div>
        {caption && (
          <div className="text-center text-[11px] text-slate-400 italic px-2">
            {caption}
          </div>
        )}
        <div className="text-center text-[10px] text-slate-500">
          Double-click to {zoom ? 'exit zoom' : 'zoom in'}. Press ESC or click outside to close.
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(content, document.body);
};

export default ImageLightbox;
