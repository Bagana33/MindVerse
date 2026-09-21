"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type ImageLightboxProps = { src: string; alt: string; onClose: () => void; caption?: string };

export function ImageLightbox({ src, alt, onClose, caption }: ImageLightboxProps) {
  const [mounted, setMounted] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    setMounted(true);
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
      }
      if (event.key !== "Tab") return;
      const controls = containerRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex="0"]');
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || !containerRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !containerRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKey);
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => { if (mounted) closeRef.current?.focus(); }, [mounted]);
  useEffect(() => { setZoom(false); setFailed(false); }, [src]);

  if (!mounted) return null;
  const controlClass = "inline-flex min-h-11 items-center justify-center rounded-xl border border-white/20 bg-slate-800 px-3 text-xs font-semibold text-white hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400";
  return createPortal(
    <div ref={containerRef} role="dialog" aria-modal="true" aria-label={alt || "Зургийг томоор харах"} className="fixed inset-0 z-[999] flex items-center justify-center bg-black/90 p-3 sm:p-6" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="flex max-h-[calc(100dvh-24px)] w-full max-w-6xl flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">{alt || "Зураг"}</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={failed} aria-pressed={zoom} onClick={() => setZoom((value) => !value)} className={controlClass}>{zoom ? "Багтаах" : "Томруулах"}</button>
            <a href={src} download target="_blank" rel="noopener noreferrer" className={controlClass}>Эх зураг ↗</a>
            <button ref={closeRef} type="button" onClick={onClose} aria-label="Зургийг хаах" className={controlClass}>Хаах ✕</button>
          </div>
        </div>
        <div className="min-h-0 overflow-auto overscroll-contain rounded-xl bg-slate-950" tabIndex={zoom ? 0 : undefined} aria-label={zoom ? "Томруулсан зураг: гүйлгэж үзэх" : undefined} onDoubleClick={() => { if (!failed) setZoom((value) => !value); }}>
          {failed ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-4 p-6 text-center text-sm text-slate-300" role="status">
              Зургийг ачаалж чадсангүй. Холболтоо шалгаад дахин оролдоно уу.
              <button type="button" onClick={() => { setFailed(false); setRetry((value) => value + 1); }} className={controlClass}>Дахин оролдох</button>
            </div>
          ) : (
            <img key={`${src}:${retry}`} src={src} alt={alt} loading="eager" decoding="async" onError={() => setFailed(true)} className={zoom ? "block max-w-none cursor-zoom-out select-none" : "mx-auto block max-h-[75dvh] max-w-full cursor-zoom-in object-contain select-none"} style={zoom ? { width: "160%", height: "auto" } : { width: "auto", height: "auto" }} draggable={false} />
          )}
        </div>
        {caption && caption !== alt && <p className="text-center text-sm text-slate-300">{caption}</p>}
        <p className="text-center text-xs text-slate-400">Хоёр товшиж томруулна. Esc товч эсвэл зургийн гадна дарж хаана.</p>
      </div>
    </div>,
    document.body
  );
}

export default ImageLightbox;
