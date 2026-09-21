"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

export default function Modal({ open, onClose, title, children, footer, wide = false, busy = false }: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  busy?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    if (!element || !open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [open]);

  return <dialog ref={dialog} aria-labelledby={titleId} aria-busy={busy}
    className={`mv-modal ${wide ? "mv-modal-wide" : ""}`}
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="flex max-h-[calc(100dvh-2rem)] flex-col lg:max-h-[calc(100dvh-4rem)]">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-7">
        <h2 id={titleId} className="text-lg font-bold text-white sm:text-xl">{title}</h2>
        <button type="button" disabled={busy} onClick={onClose} aria-label="Цонх хаах"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-2xl text-slate-300 hover:bg-white/10 disabled:opacity-40">×</button>
      </header>
      <div className="min-h-0 mv-scroll-area overflow-y-auto overscroll-contain p-5 sm:p-7">{open ? children : null}</div>
      {footer && <footer className="flex shrink-0 flex-wrap justify-end gap-3 border-t border-white/10 bg-white/[0.02] px-5 py-4 sm:px-7">{footer}</footer>}
    </div>
  </dialog>;
}
