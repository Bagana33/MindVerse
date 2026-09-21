"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { useSession } from "../../components/auth/useSession";
import Modal from "../../components/ui/Modal";
import { invalidateCache } from "../../lib/fetchCache";

const colors = ["#7c3aed", "#be185d", "#2563eb", "#047857", "#b45309", "#b91c1c", "#0e7490", "#9333ea"];
export default function SpinnerPage() {
  const { session } = useSession();
  const [options, setOptions] = useState<string[]>([]);
  const [newOption, setNewOption] = useState("");
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [shareCopied, setShareCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [readError, setReadError] = useState("");
  const [userOptionCount, setUserOptionCount] = useState(0);
  const [pending, setPending] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const busy = useRef(false);
  const spinningRef = useRef(false);
  const request = useRef<AbortController | null>(null);
  const spinTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchOptions = useCallback(async () => {
    if (document.visibilityState === "hidden" || busy.current || spinningRef.current || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    const timeout = setTimeout(() => controller.abort("timeout"), 15000);
    try {
      const response = await fetch("/api/spinner", { cache: "no-store", signal: controller.signal });
      const data = await response.json();
      if (!response.ok || !data.ok || !Array.isArray(data.options)) throw new Error("load");
      if (!controller.signal.aborted) {
        setOptions(data.options);
        setUserOptionCount(data.userOptionCount || 0);
        setReadError("");
      }
    } catch {
      if (!controller.signal.aborted || controller.signal.reason === "timeout") setReadError("Сонголтуудыг шинэчилж чадсангүй. Дахин оролдоно уу.");
    } finally {
      clearTimeout(timeout);
      if (request.current === controller) { request.current = null; setLoading(false); }
    }
  }, [session?.email]);

  useEffect(() => {
    void fetchOptions();
    const interval = setInterval(fetchOptions, 20000);
    document.addEventListener("visibilitychange", fetchOptions);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", fetchOptions); request.current?.abort(); request.current = null; };
  }, [fetchOptions]);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update(); query.addEventListener("change", update);
    return () => { query.removeEventListener("change", update); if (spinTimer.current) clearTimeout(spinTimer.current); if (copyTimer.current) clearTimeout(copyTimer.current); };
  }, []);

  async function saveOption(method: "POST" | "DELETE", option: string) {
    if (loading || busy.current || spinningRef.current || !session || !option.trim()) return;
    busy.current = true; setPending(true); setError("");
    request.current?.abort(); request.current = null;
    try {
      const response = await fetch("/api/spinner", {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ option: option.trim() }), signal: AbortSignal.timeout(20000),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Өөрчлөлтийг хадгалж чадсангүй.");
      setOptions(data.options || []);
      setLoading(false);
      if (typeof data.userOptionCount === "number") setUserOptionCount(data.userOptionCount);
      if (method === "POST") setNewOption("");
      if (result === option) setResult(null);
      invalidateCache("/api/spinner"); setRemoveTarget(null);
    } catch (cause) {
      setError(cause instanceof Error && cause.name !== "TimeoutError" ? cause.message : "Хариу удаж байна. Жагсаалтаа шинэчилж шалгаад дахин оролдоно уу.");
    } finally { busy.current = false; setPending(false); }
  }

  function spin() {
    if (options.length < 2 || spinningRef.current || busy.current) return;
    spinningRef.current = true; setSpinning(true); setResult(null); setShareCopied(false);
    request.current?.abort(); request.current = null;
    const array = new Uint32Array(1); crypto.getRandomValues(array);
    const index = Math.floor((array[0] / 4294967296) * options.length);
    const selected = options[index];
    const slice = 360 / options.length;
    const target = (360 - (index + 0.5) * slice) % 360;
    const delta = (target - rotation % 360 + 360) % 360;
    setRotation(rotation + (reducedMotion ? 0 : 6 * 360) + delta);
    spinTimer.current = setTimeout(() => { setResult(selected); setSpinning(false); spinningRef.current = false; }, reducedMotion ? 0 : 4000);
  }

  async function copyResult() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(`Азын хүрд: “${result}” сонгогдлоо!`);
      setShareCopied(true); if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setShareCopied(false), 2500);
    } catch { setError("Үр дүнг хуулж чадсангүй. Доорх сонголтын нэрийг хуулж ашиглаарай."); }
  }

  return <DashboardLayout><div className="mv-page max-w-[1280px]">
    <header className="mv-page-header"><div><p className="mv-eyebrow">Хамтдаа тоглоё</p><h1 className="mv-title">Азын хүрд</h1><p className="mv-subtitle">Сонголтуудаа нэмээд, дараагийн санаагаа санамсаргүйгээр сонгоорой.</p></div><Link href="/game" className="mv-button-secondary">Бүтээлийн санал хураалт →</Link></header>
    {(error || readError) && <div role="alert" className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error || readError}<button onClick={() => { setError(""); void fetchOptions(); }} disabled={pending || spinning} className="ml-3 min-h-11 font-semibold underline">Шинэчлэх</button></div>}
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] xl:gap-7">
      <section className="mv-panel flex min-w-0 flex-col items-center gap-5 px-5 py-6 xl:px-8" aria-label="Санамсаргүй сонголтын хүрд" aria-busy={spinning || loading}>
        <div className="w-full border-b border-white/10 pb-4"><h2 className="text-lg font-semibold text-white">Нэг эргэлтээр сонго</h2><p className="mt-1 text-sm leading-6 text-slate-400">Сонголт бүр ижил магадлалтай.</p></div>
        {loading ? <div role="status" className="flex aspect-square w-full max-w-72 xl:max-w-80 animate-pulse items-center justify-center rounded-full bg-white/5 text-sm">Сонголтуудыг ачаалж байна…</div> : <div className="relative aspect-square w-full max-w-72 xl:max-w-80">
          <div aria-hidden="true" className="absolute -top-2 left-1/2 z-10 h-0 w-0 -translate-x-1/2 border-x-[12px] border-t-[22px] border-x-transparent border-t-white drop-shadow-lg" />
          <svg role="img" aria-label={`${options.length} сонголттой хүрд`} viewBox="0 0 200 200" className="h-full w-full rounded-full border-4 border-white/10 shadow-xl" style={{ transform: `rotate(${rotation}deg)`, transition: spinning && !reducedMotion ? "transform 4000ms cubic-bezier(0.17,0.67,0.12,0.99)" : "none" }}>
            {options.length < 2 ? <circle cx="100" cy="100" r="100" fill="#25203b" /> : options.map((option, index) => {
              const slice = 360 / options.length;
              const start = (index * slice - 90) * Math.PI / 180;
              const end = ((index + 1) * slice - 90) * Math.PI / 180;
              const middle = (start + end) / 2;
              return <g key={`${option}-${index}`}><path d={`M 100 100 L ${100 + 100 * Math.cos(start)} ${100 + 100 * Math.sin(start)} A 100 100 0 ${slice > 180 ? 1 : 0} 1 ${100 + 100 * Math.cos(end)} ${100 + 100 * Math.sin(end)} Z`} fill={colors[index % colors.length]} stroke="#101320" strokeWidth="1.5" />
                {options.length <= 16 && <text x={100 + 64 * Math.cos(middle)} y={100 + 64 * Math.sin(middle)} fill="white" fontSize={options.length > 8 ? "7" : "9"} fontWeight="600" textAnchor="middle" dominantBaseline="middle" transform={`rotate(${middle * 180 / Math.PI + 90},${100 + 64 * Math.cos(middle)},${100 + 64 * Math.sin(middle)})`}>{option.length > 12 ? option.slice(0, 11) + "…" : option}</text>}</g>;
            })}
            <circle cx="100" cy="100" r="13" fill="#f1f5f9" stroke="#101320" strokeWidth="4" />
          </svg>
        </div>}
        <button onClick={spin} disabled={spinning || pending || loading || options.length < 2} className="mv-button-primary w-full max-w-64 text-base">{spinning ? "Сонгож байна…" : "Хүрд эргүүлэх"}</button>
        <div role="status" aria-live="polite" className="w-full text-center">
          {result && !spinning ? <div className="rounded-2xl border border-violet-400/40 bg-violet-500/10 p-5"><p className="text-sm font-medium text-violet-300">Сонгогдсон нь</p><p className="my-3 break-words text-xl font-bold text-white xl:text-2xl">{result}</p><button onClick={copyResult} className="mv-button-secondary">{shareCopied ? "✓ Хуулагдлаа" : "Үр дүнг хуулах"}</button></div> : <p className="text-sm leading-relaxed text-slate-400">{options.length < 2 && !loading ? "Эхлэхийн тулд хамгийн багадаа 2 сонголт нэмээрэй." : "Бүх сонголт ижил магадлалтай. Үр дүн энд гарна."}</p>}
        </div>
      </section>
      <section className="mv-panel min-w-0 space-y-5"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4"><h2 className="text-lg font-semibold text-white">Сонголтууд <span className="text-violet-300">{options.length}</span></h2>{session && <span className="rounded-full bg-white/5 px-3 py-1.5 text-sm text-slate-300">Таны оруулсан: {userOptionCount}/2</span>}</div>
        {session ? <form onSubmit={event => { event.preventDefault(); void saveOption("POST", newOption); }}><label htmlFor="spinner-option" className="mv-label">Шинэ сонголт</label><div className="flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row"><input id="spinner-option" className="mv-field" value={newOption} onChange={event => setNewOption(event.target.value)} maxLength={100} disabled={loading || pending || spinning || userOptionCount >= 2} placeholder="Жишээ: Постер дизайн" /><button className="mv-button-primary shrink-0" disabled={loading || !newOption.trim() || userOptionCount >= 2 || pending || spinning}>{pending ? "Хадгалж байна…" : "Нэмэх"}</button></div><p className="mt-3 text-sm leading-6 text-slate-400">Хүн бүр 2 хүртэл сонголт нэмнэ. Хүрд эргэж байх үед жагсаалт өөрчлөгдөхгүй.</p></form> : <div className="rounded-xl border border-white/10 p-4"><p className="mb-3 text-sm leading-relaxed text-slate-400">Хүрдийг шууд эргүүлж болно. Өөрийн сонголт нэмэхийн тулд нэвтрээрэй.</p><Link href="/login" className="mv-button-secondary">Нэвтрэх</Link></div>}
        {!loading && options.length === 0 && <p className="py-6 text-sm text-slate-400">Одоогоор сонголт алга.</p>}
        <ul className="max-h-[420px] space-y-2 overflow-y-auto overscroll-contain pr-1 lg:max-h-[360px]">{options.map((option, index) => <li key={`${option}-${index}`} className="flex min-h-14 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3"><span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} /><span className="min-w-0 flex-1 break-words text-sm leading-relaxed text-slate-200">{option}</span>{session?.role === "teacher" && <button onClick={() => setRemoveTarget(option)} disabled={options.length <= 2 || spinning || pending} aria-label={`${option} сонголтыг устгах`} className="h-11 w-11 shrink-0 rounded-xl text-xl text-rose-300 hover:bg-rose-400/10 disabled:opacity-30">×</button>}</li>)}</ul>
      </section>
    </div>
    <Modal open={removeTarget !== null} onClose={() => setRemoveTarget(null)} title="Сонголт устгах" busy={pending} footer={<><button disabled={pending} className="mv-button-secondary" onClick={() => setRemoveTarget(null)}>Болих</button><button disabled={pending} className="mv-button-primary bg-rose-600 hover:bg-rose-500" onClick={() => removeTarget && void saveOption("DELETE", removeTarget)}>{pending ? "Устгаж байна…" : "Устгах"}</button></>}><p className="break-words leading-relaxed">“{removeTarget}” сонголтыг хамтын жагсаалтаас устгана.</p>{error && <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}</Modal>
  </div></DashboardLayout>;
}
