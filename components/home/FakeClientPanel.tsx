"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "../auth/useSession";

type Brief = {
  id: string;
  clientName: string;
  clientAvatar: string;
  clientColor: string;
  task: string;
  requirements?: string[];
  challenge?: string;
  category: string;
};

function buildClientMessage(brief: Brief) {
  let text = brief.task;
  if (brief.requirements && brief.requirements.length > 0) {
    text += "\n\n📌 Шаардлагууд:\n" + brief.requirements.map((r, i) => `${i + 1}. ${r}`).join("\n");
  }
  if (brief.challenge) {
    text += "\n\n🎯 Сорилт (Нэмэлт оноо):\n" + brief.challenge;
  }
  return text;
}

type GradeResult = {
  score: number;
  passed: boolean;
  feedback: string;
  clientReaction: string;
  xpEarned: number;
  maxXp: number;
};

type ChatMessage =
  | { from: "client"; text: string }
  | { from: "student"; text: string; imageUrl?: string }
  | { from: "result"; result: GradeResult };

const CATEGORY_COLORS: Record<string, string> = {
  "Logo Design": "from-violet-500 to-purple-600",
  "Social Media": "from-pink-500 to-rose-500",
  "UI/UX Design": "from-sky-500 to-blue-600",
  "Print Design": "from-emerald-500 to-teal-600",
  "Poster Design": "from-red-500 to-orange-600",
  "Branding": "from-indigo-500 to-violet-600",
  "Invitation Design": "from-amber-500 to-yellow-600",
  "Dashboard UI": "from-cyan-500 to-blue-500",
};

export function FakeClientPanel() {
  const { session } = useSession();
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [activeBrief, setActiveBrief] = useState<Brief | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [totalXpEarned, setTotalXpEarned] = useState(0);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  }

  useEffect(() => {
    fetch("/api/fake-client")
      .then((r) => r.json())
      .then((data) => {
        if (data.briefs) setBriefs(data.briefs);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function selectBrief(brief: Brief) {
    setActiveBrief(brief);
    setResult(null);
    setInput("");
    setSelectedImage(null);
    setMessages([
      {
        from: "client",
        text: buildClientMessage(brief),
      },
    ]);
    setTimeout(() => textareaRef.current?.focus(), 100);
  }

  async function handleSubmit() {
    if (!activeBrief || (!input.trim() && !selectedImage) || loading || result) return;

    const studentText = input.trim();
    const studentImage = selectedImage;
    setInput("");
    setSelectedImage(null);
    setMessages((prev) => [...prev, { from: "student", text: studentText, imageUrl: studentImage }]);
    setLoading(true);

    try {
      const res = await fetch("/api/fake-client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ briefId: activeBrief.id, response: studentText, imageUrl: studentImage }),
      });
      const data = await res.json();

      const gradeResult: GradeResult = {
        score: data.score ?? 0,
        passed: data.passed ?? false,
        feedback: data.feedback ?? "",
        clientReaction: data.clientReaction ?? "",
        xpEarned: data.xpEarned ?? 0,
        maxXp: data.maxXp ?? 0,
      };

      setResult(gradeResult);
      if (gradeResult.xpEarned > 0) {
        setTotalXpEarned((prev) => prev + gradeResult.xpEarned);
      }
      setMessages((prev) => [...prev, { from: "result", result: gradeResult }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          from: "client",
          text: "Уучлаарай, одоо холбогдох боломжгүй байна. Дараа дахин оролдоно уу.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setActiveBrief(null);
    setMessages([]);
    setResult(null);
    setInput("");
    setSelectedImage(null);
  }

  const displayedBriefs = showAll ? briefs : briefs.slice(0, 3);

  return (
    <div className="bg-dark-900 border border-white/5 rounded-3xl overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.4)]">
      {/* Header */}
      <div className="relative p-4 border-b border-white/5 bg-gradient-to-r from-violet-900/30 via-purple-900/20 to-dark-900">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600/10 to-transparent pointer-events-none" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-sm shadow-lg">
              💼
            </div>
            <div>
              <h3 className="text-sm font-black text-white">Fake Client</h3>
              <p className="text-[10px] text-slate-400">Даалгавар гүйцэтгэж XP олоорой</p>
            </div>
          </div>
          {totalXpEarned > 0 && (
            <div className="flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 rounded-full">
              <span className="text-amber-400 text-xs">⚡</span>
              <span className="text-xs font-extrabold text-amber-300">+{totalXpEarned} XP</span>
            </div>
          )}
        </div>
      </div>

      {!activeBrief ? (
        /* ── Brief List View ── */
        <div className="p-4 space-y-3">
          <p className="text-[11px] text-slate-400 font-medium">
            Клиент сонгоод тэдний захиалгыг биелүүлнэ үү:
          </p>

          {briefs.length === 0 ? (
            <div className="text-center py-6 text-slate-500 text-xs">
              <div className="text-2xl mb-2">⏳</div>
              Клиентүүд ачаалж байна...
            </div>
          ) : (
            <>
              {displayedBriefs.map((brief) => {
                const gradientClass = CATEGORY_COLORS[brief.category] || "from-violet-500 to-purple-600";
                return (
                  <button
                    key={brief.id}
                    onClick={() => selectBrief(brief)}
                    className="w-full text-left p-3.5 rounded-2xl border border-white/5 bg-dark-800/60 hover:bg-dark-800 hover:border-violet-500/30 transition-all duration-200 group"
                  >
                    <div className="flex items-start gap-3">
                      {/* Client Avatar */}
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 shadow-md"
                        style={{ background: `${brief.clientColor}33`, border: `1.5px solid ${brief.clientColor}55` }}
                      >
                        {brief.clientAvatar}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-bold text-white truncate">{brief.clientName}</span>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r ${gradientClass} text-white shrink-0 opacity-80`}>
                            {brief.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                          {brief.task}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between">
                      <span className="text-[10px] text-violet-400 font-semibold group-hover:text-violet-300 transition-colors">
                        Хариулах →
                      </span>
                      <span className="text-[10px] text-amber-400 font-bold">⚡ XP авах боломж</span>
                    </div>
                  </button>
                );
              })}

              {briefs.length > 3 && (
                <button
                  onClick={() => setShowAll(!showAll)}
                  className="w-full py-2 text-[11px] text-slate-400 hover:text-slate-200 transition-colors font-medium"
                >
                  {showAll ? "Хаах ↑" : `+${briefs.length - 3} клиент харах ↓`}
                </button>
              )}
            </>
          )}
        </div>
      ) : (
        /* ── Active Chat View ── */
        <div className="flex flex-col" style={{ maxHeight: "520px" }}>
          {/* Client Info Bar */}
          <div
            className="flex items-center gap-2.5 px-4 py-2.5 border-b border-white/5"
            style={{ background: `${activeBrief.clientColor}18` }}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-base shrink-0"
              style={{ background: `${activeBrief.clientColor}44` }}
            >
              {activeBrief.clientAvatar}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-white truncate">{activeBrief.clientName}</div>
              <div className="text-[9px] text-slate-400">{activeBrief.category}</div>
            </div>
            <button
              onClick={reset}
              className="text-slate-500 hover:text-slate-300 text-xs transition-colors shrink-0 px-2 py-1 rounded-lg hover:bg-white/5"
            >
              ← Буцах
            </button>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ minHeight: "220px" }}>
            {messages.map((msg, i) => {
              if (msg.from === "client") {
                return (
                  <div key={i} className="flex items-start gap-2.5">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0 mt-0.5"
                      style={{ background: `${activeBrief.clientColor}44` }}
                    >
                      {activeBrief.clientAvatar}
                    </div>
                    <div className="bg-dark-800 border border-white/5 rounded-2xl rounded-tl-sm px-3.5 py-2.5 max-w-[85%]">
                      <div className="text-[11px] text-slate-200 leading-relaxed whitespace-pre-wrap">{msg.text}</div>
                    </div>
                  </div>
                );
              }

              if (msg.from === "student") {
                return (
                  <div key={i} className="flex items-start gap-2.5 justify-end">
                    <div className="bg-violet-600/30 border border-violet-500/30 rounded-2xl rounded-tr-sm px-3.5 py-2.5 max-w-[85%]">
                      {msg.imageUrl && (
                        <img src={msg.imageUrl} alt="Student Work" className="rounded-xl w-full object-cover max-h-48 mb-2 border border-white/10" />
                      )}
                      {msg.text && <div className="text-[11px] text-violet-100 leading-relaxed whitespace-pre-wrap">{msg.text}</div>}
                    </div>
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-[11px] font-bold text-white shrink-0 mt-0.5">
                      {(session?.email || "U")[0].toUpperCase()}
                    </div>
                  </div>
                );
              }

              if (msg.from === "result" && msg.result) {
                const r = msg.result;
                return (
                  <div key={i} className="space-y-2.5">
                    {/* Client Reaction */}
                    <div className="flex items-start gap-2.5">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0 mt-0.5"
                        style={{ background: `${activeBrief.clientColor}44` }}
                      >
                        {activeBrief.clientAvatar}
                      </div>
                      <div className="bg-dark-800 border border-white/5 rounded-2xl rounded-tl-sm px-3.5 py-2.5 max-w-[85%]">
                        <p className="text-[11px] text-slate-300 italic leading-relaxed">"{r.clientReaction}"</p>
                      </div>
                    </div>

                    {/* Score Card */}
                    <div
                      className={`mx-1 p-4 rounded-2xl border ${
                        r.passed
                          ? "bg-emerald-500/10 border-emerald-500/30"
                          : "bg-rose-500/10 border-rose-500/30"
                      }`}
                    >
                      {/* Score bar */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`text-2xl font-black ${r.passed ? "text-emerald-400" : "text-rose-400"}`}>
                          {r.score}/10
                        </div>
                        <div className="flex-1">
                          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${
                                r.passed
                                  ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                                  : "bg-gradient-to-r from-rose-500 to-red-500"
                              }`}
                              style={{ width: `${(r.score / 10) * 100}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between mt-0.5">
                            <span className={`text-[9px] font-bold ${r.passed ? "text-emerald-400" : "text-rose-400"}`}>
                              {r.passed ? "✅ Тэнцсэн" : "❌ Тэнцээгүй"}
                            </span>
                            {r.xpEarned > 0 && (
                              <span className="text-[9px] font-extrabold text-amber-400">
                                +{r.xpEarned} XP олголоо!
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* AI Feedback */}
                      <p className="text-[11px] text-slate-300 leading-relaxed">{r.feedback}</p>

                      {/* XP earned animation */}
                      {r.xpEarned > 0 && (
                        <div className="mt-3 py-2 px-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2">
                          <span className="text-lg">⚡</span>
                          <div>
                            <div className="text-xs font-black text-amber-300">+{r.xpEarned} XP олголоо!</div>
                            <div className="text-[9px] text-slate-400">Таны account-д нэмэгдлээ</div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Try Again / New Brief */}
                    <div className="flex gap-2 mx-1">
                      {!r.passed && (
                        <button
                          onClick={() => {
                            setMessages([{ from: "client", text: buildClientMessage(activeBrief) }]);
                            setResult(null);
                            setInput("");
                            setSelectedImage(null);
                            setTimeout(() => textareaRef.current?.focus(), 100);
                          }}
                          className="flex-1 py-2 rounded-xl text-xs font-bold bg-dark-800 border border-white/10 text-slate-300 hover:text-white hover:border-violet-500/40 transition-all"
                        >
                          🔄 Дахин оролдох
                        </button>
                      )}
                      <button
                        onClick={reset}
                        className="flex-1 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:opacity-90 transition-all shadow-lg"
                      >
                        🆕 Шинэ клиент
                      </button>
                    </div>
                  </div>
                );
              }

              return null;
            })}

            {/* Loading indicator */}
            {loading && (
              <div className="flex items-start gap-2.5">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0"
                  style={{ background: `${activeBrief.clientColor}44` }}
                >
                  {activeBrief.clientAvatar}
                </div>
                <div className="bg-dark-800 border border-white/5 rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1.5 items-center">
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    <span className="text-[10px] text-slate-500 ml-1">AI шалгаж байна...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          {!result && (
            <div className="p-3 border-t border-white/5 bg-dark-950/50">
              {!session ? (
                <div className="text-center text-[11px] text-slate-500 py-2">
                  Хариулт өгөхийн тулд <span className="text-violet-400 font-semibold">нэвтрэх</span> шаардлагатай
                </div>
              ) : (
                <div className="flex gap-2">
                  <div className="flex-1 flex flex-col gap-2">
                    {selectedImage && (
                      <div className="relative w-fit">
                        <img src={selectedImage} alt="Preview" className="h-16 w-auto rounded-lg border border-white/10 object-cover" />
                        <button
                          onClick={() => setSelectedImage(null)}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 flex items-center justify-center text-white text-[10px] shadow-lg hover:bg-rose-600 transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                    <textarea
                      ref={textareaRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSubmit();
                        }
                      }}
                      placeholder="Дизайны ажлаа тайлбарлаарай... (Enter → илгээх)"
                      rows={3}
                      disabled={loading}
                      className="w-full bg-dark-800 border border-white/5 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/40 resize-none disabled:opacity-50 leading-relaxed"
                    />
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageSelect} className="hidden" />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={loading}
                      title="Зураг хавсаргах"
                      className="w-10 h-10 rounded-xl bg-dark-800 border border-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:border-violet-500/30 transition-all shadow-md disabled:opacity-50"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21 15 16 10 5 21"/>
                      </svg>
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={loading || (!input.trim() && !selectedImage)}
                      className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white disabled:opacity-40 hover:opacity-90 transition-all shadow-lg"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="-rotate-90">
                        <path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
