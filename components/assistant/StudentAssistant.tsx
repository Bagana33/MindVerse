"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "../auth/useSession";

type ChatMsg = { role: "user" | "assistant"; content: string };

export default function StudentAssistant() {
  const { session } = useSession();
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

  if (!session || session.role !== "student") return null;

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
      if (!res.ok || !json.ok) throw new Error(json.error || "Алдаа гарлаа");
      setMessages((m) => [...m, { role: "assistant", content: json.answer }]);
    } catch (e: any) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: e?.message || "Одоогоор хариулах боломжгүй байна." },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-40">
      {open && (
        <div className="mb-3 w-[320px] max-w-[90vw] rounded-2xl border border-slate-700 bg-slate-900/90 backdrop-blur px-3 py-3 shadow-2xl">
          <div className="flex items-center justify-between pb-2">
            <div className="flex items-center gap-2 text-sm text-slate-200">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-500">🤖</span>
              <span className="font-semibold">Design Assistant</span>
            </div>
            <button
              className="text-slate-400 hover:text-slate-200"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <div className="text-[11px] text-slate-400 pb-2">Зөвхөн график дизайны сэдвүүдэд тусална.</div>
          <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
            {messages.map((m, i) => (
              <div key={i} className={m.role === "assistant" ? "text-slate-200" : "text-slate-300"}>
                <div className={`whitespace-pre-line rounded-xl px-3 py-2 text-[13px] leading-relaxed ${
                  m.role === "assistant"
                    ? "bg-slate-800/70 border border-slate-700"
                    : "bg-violet-600/20 border border-violet-500/30"
                }`}>{m.content}</div>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          <div className="pt-2 flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Таны асуулт…"
              className="flex-1 rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-violet-500/40 focus:outline-none"
            />
            <button
              onClick={send}
              disabled={busy || !input.trim()}
              className="rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 px-3 py-2 text-sm text-white disabled:opacity-60"
            >
              {busy ? "…" : "Send"}
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="h-12 w-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 text-white shadow-[0_8px_24px_rgba(34,197,235,0.45)] hover:shadow-[0_10px_28px_rgba(34,197,235,0.6)]"
        aria-label="Open design assistant"
        title="Design assistant"
      >
        💬
      </button>
    </div>
  );
}
