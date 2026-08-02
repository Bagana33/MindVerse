"use client";

import { useEffect, useRef, useState } from "react";

type ChatMsg = { role: "user" | "assistant"; content: string; images?: string[] };

export default function StudentAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: "assistant",
      content:
        "Сайн байна уу! Би график дизайны туслах. Typography, өнгө, layout, composition, Figma гэх мэтэд тусална. Асуултаа бичээрэй.",
    },
  ]);

  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const next: ChatMsg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: next }),
      });
      const json = await res.json();
      console.log("API Response:", json); // Debug log
      if (!res.ok || !json.ok) throw new Error(json.error || "Алдаа гарлаа");
      const answerText = json.answer;
      setMessages((m) => [...m, { 
        role: "assistant", 
        content: answerText,
        images: json.images || undefined
      }]);
    } catch (e: any) {
      console.error("Chat error:", e); // Debug log
      const msg = typeof e?.message === 'string' ? e.message : "Одоогоор хариулах боломжгүй байна.";
      setMessages((m) => [...m, { role: "assistant", content: msg }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 lg:bottom-6 lg:right-6 z-[100]">
      {open && (
        <div className="mb-3 w-[340px] sm:w-[380px] max-w-[90vw] glass-card rounded-3xl p-5 shadow-2xl border-white/10">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-primary-500/30">
                <span className="material-symbols-outlined text-xl">smart_toy</span>
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">Design Assistant</h3>
                <p className="text-[10px] text-slate-500 font-medium">AI Design Helper</p>
              </div>
            </div>
            <button
              className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>

          {/* Info badge */}
          <div className="mb-3 px-3 py-1.5 rounded-lg bg-primary-500/10 border border-primary-500/20">
            <p className="text-[11px] text-primary-400 font-medium">Зөвхөн график дизайны сэдвүүдэд тусална</p>
          </div>

          {/* Messages */}
          <div className="max-h-[320px] overflow-y-auto space-y-3 pr-2 mb-4 hide-scrollbar">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
                  m.role === "assistant"
                    ? "bg-dark-800 border border-white/5 text-slate-200"
                    : "bg-gradient-to-r from-primary-500/20 to-indigo-500/20 border border-primary-500/30 text-white"
                }`}>
                  {m.content}
                  {m.images && m.images.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {m.images.map((imgUrl, idx) => (
                        <div key={idx} className="rounded-lg overflow-hidden border border-white/10">
                          <img 
                            src={imgUrl} 
                            alt={`Generated image ${idx + 1}`}
                            className="w-full h-auto max-h-64 object-cover"
                            loading="lazy"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="bg-dark-800 border border-white/5 rounded-2xl px-4 py-2.5">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-primary-500 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 rounded-full bg-primary-500 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 rounded-full bg-primary-500 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 pt-3 border-t border-white/5">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Асуултаа бичнэ үү..."
              className="flex-1 rounded-xl border border-white/10 bg-dark-800 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all"
            />
            <button
              onClick={send}
              disabled={busy || !input.trim()}
              className="rounded-xl bg-gradient-to-r from-primary-500 to-indigo-600 px-4 py-2.5 text-sm text-white font-medium shadow-[0_4px_16px_rgba(139,92,246,0.4)] hover:shadow-[0_6px_20px_rgba(139,92,246,0.6)] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {busy ? (
                <>
                  <span className="material-symbols-outlined text-lg animate-spin">sync</span>
                  <span>...</span>
                </>
              ) : (
                <>
                  <span>Илгээх</span>
                  <span className="material-symbols-outlined text-lg">send</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`h-14 w-14 rounded-2xl bg-gradient-to-br from-primary-500 to-indigo-600 text-white shadow-[0_8px_24px_rgba(139,92,246,0.45)] hover:shadow-[0_12px_32px_rgba(139,92,246,0.6)] transition-all flex items-center justify-center group ${
          open ? "rotate-90" : ""
        }`}
        aria-label="Open design assistant"
        title="Design Assistant"
      >
        {open ? (
          <span className="material-symbols-outlined text-2xl">close</span>
        ) : (
          <span className="material-symbols-outlined text-2xl">smart_toy</span>
        )}
      </button>
    </div>
  );
}
