"use client";

import { useEffect, useRef, useState } from "react";

type ChatMsg = { role: "user" | "assistant"; content: string; images?: string[] };

export default function StudentAssistant({ initiallyOpen = false }: { initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: "assistant",
      content: "Сайн байна уу! Би график дизайны туслах. Үсгийн зохиомж, өнгө, бүтээлийн зохиомж, Figma зэрэг сэдвээр асуултаа бичээрэй.",
    },
  ]);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    const list = messageListRef.current;
    if (!open || !list) return;
    list.scrollTo({
      top: list.scrollHeight,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }, [messages, busy, open]);

  useEffect(() => () => requestRef.current?.abort(), []);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  };

  async function send() {
    const text = input.trim();
    if (!text || requestRef.current) return;
    const next: ChatMsg[] = [...messages, { role: "user", content: text }];
    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort("timeout"), 45000);
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: next }),
        signal: controller.signal,
      });
      const json = await res.json();
      if (!res.ok || !json.ok || typeof json.answer !== "string") {
        throw new Error(typeof json.error === "string" ? json.error : "Одоогоор хариулах боломжгүй байна. Дахин оролдоно уу.");
      }
      setMessages((current) => [...current, {
        role: "assistant",
        content: json.answer,
        images: Array.isArray(json.images) ? json.images.filter((url: unknown): url is string => typeof url === "string") : undefined,
      }]);
    } catch (error: unknown) {
      if (controller.signal.aborted && controller.signal.reason !== "timeout") return;
      const message = controller.signal.reason === "timeout"
        ? "Хариу хүлээх хугацаа дууслаа. Асуултаа дахин илгээнэ үү."
        : error instanceof Error ? error.message : "Холболт тасарлаа. Дахин оролдоно уу.";
      setMessages((current) => [...current, { role: "assistant", content: message }]);
      setInput((current) => current || text);
    } finally {
      window.clearTimeout(timeout);
      if (requestRef.current === controller) {
        requestRef.current = null;
        setBusy(false);
      }
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 lg:bottom-6 lg:right-6">
      {open && (
        <div
          id="design-assistant-panel"
          role="dialog"
          aria-labelledby="design-assistant-title"
          onKeyDown={(event) => {
            if (event.key === "Escape") { event.stopPropagation(); close(); }
          }}
          className="mb-3 flex max-h-[calc(100dvh-7rem)] w-[420px] max-w-[calc(100vw-2rem)] lg:w-[460px] flex-col rounded-3xl border border-white/10 bg-slate-950 p-4 shadow-2xl sm:p-5"
        >
          <div className="mb-3 flex shrink-0 items-center justify-between gap-2 border-b border-white/10 pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-indigo-600 text-white">
                <span className="material-symbols-outlined text-xl" aria-hidden="true">smart_toy</span>
              </div>
              <div>
                <h2 id="design-assistant-title" className="text-base font-bold text-white">Дизайны туслах</h2>
                <p className="text-xs text-slate-400">Асууж, туршиж, суралцаарай</p>
              </div>
            </div>
            <button type="button" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/5 hover:text-white" onClick={close} aria-label="Туслахыг хаах">
              <span className="material-symbols-outlined text-xl" aria-hidden="true">close</span>
            </button>
          </div>

          <p className="mb-3 shrink-0 rounded-lg border border-primary-500/20 bg-primary-500/10 px-3 py-2 text-xs leading-relaxed text-violet-300">График дизайны талаар асуугаарай. Хариуг өөрийн бүтээл дээр туршиж үзээрэй.</p>

          <div ref={messageListRef} role="log" aria-label="Дизайны туслахтай харилцсан яриа" aria-live="polite" aria-relevant="additions" className="mb-3 mv-scroll-area min-h-0 max-h-80 lg:max-h-[min(55dvh,520px)] space-y-3 overflow-y-auto overscroll-contain pr-1">
            {messages.map((message, index) => (
              <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[90%] whitespace-pre-line break-words rounded-2xl border px-3 py-2.5 text-sm leading-relaxed ${message.role === "assistant" ? "border-white/10 bg-slate-900 text-slate-200" : "border-primary-500/30 bg-primary-500/15 text-white"}`}>
                  <span className="sr-only">{message.role === "user" ? "Та: " : "Туслах: "}</span>
                  {message.content}
                  {message.images?.length ? (
                    <div className="mt-3 space-y-2">
                      {message.images.map((imageUrl, imageIndex) => (
                        <div key={imageIndex} className="overflow-hidden rounded-lg border border-white/10">
                          <img src={imageUrl} alt={`Дизайны жишээ зураг ${imageIndex + 1}`} className="h-auto max-h-64 w-full object-contain" loading="lazy" decoding="async" />
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          {busy && <p role="status" className="mb-3 text-xs text-violet-300">Хариулт бэлтгэж байна…</p>}

          <form onSubmit={(event) => { event.preventDefault(); void send(); }} className="flex shrink-0 items-center gap-2 border-t border-white/10 pt-3">
            <label className="sr-only" htmlFor="design-assistant-question">Дизайны асуулт</label>
            <input
              ref={inputRef}
              id="design-assistant-question"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              maxLength={4000}
              autoComplete="off"
              placeholder="Асуултаа бичнэ үү…"
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-base text-white placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/25"
            />
            <button type="submit" disabled={busy || !input.trim()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50" aria-label="Асуулт илгээх">
              <span className={`material-symbols-outlined text-xl ${busy ? "animate-spin" : ""}`} aria-hidden="true">{busy ? "sync" : "send"}</span>
            </button>
          </form>
        </div>
      )}

      <button ref={triggerRef} type="button" onClick={() => open ? close() : setOpen(true)} className="ml-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-indigo-600 text-white shadow-lg transition-colors hover:from-primary-400" aria-label={open ? "Туслахыг хаах" : "Дизайны туслах нээх"} aria-expanded={open} aria-controls="design-assistant-panel" title="Дизайны туслах">
        <span className="material-symbols-outlined text-2xl" aria-hidden="true">{open ? "close" : "smart_toy"}</span>
      </button>
    </div>
  );
}
