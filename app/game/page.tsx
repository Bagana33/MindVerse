"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { useSession } from "../../components/auth/useSession";
import Modal from "../../components/ui/Modal";
import PostImage from "../../components/posts/PostImage";
import { invalidateCache } from "../../lib/fetchCache";
const ImageLightbox = dynamic(() => import("../../components/posts/ImageLightbox"), { ssr: false });

type GameImage = { id: string; imageUrl: string; imageUrls?: string[]; addedBy: string | null; studentName?: string | null; studentNickname?: string | null; likes: number; likedBy: string[]; createdAt: string };
type Ranking = { email: string; name: string; likes: number; xp: number; rank: number };
type GameState = { gameEnded: boolean; winner: { email: string; name: string } | null; rankings: Ranking[]; lessonId: string | null; targetGrade: string | null };
type Lesson = { id: string; title: string; targetGrades: string[] };
type Action = "setup" | "end" | "reset";
const emptyState: GameState = { gameEnded: false, winner: null, rankings: [], lessonId: null, targetGrade: null };
const stableImages = (items: GameImage[]) => [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));

export default function GamePage() {
  const { session } = useSession();
  const [images, setImages] = useState<GameImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [gameState, setGameState] = useState<GameState>(emptyState);
  const [error, setError] = useState("");
  const [readError, setReadError] = useState("");
  const [notice, setNotice] = useState("");
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [lessonError, setLessonError] = useState("");
  const [lessonRetry, setLessonRetry] = useState(0);
  const [selectedLessonId, setSelectedLessonId] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<Action | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState<Record<string, number>>({});
  const [lightbox, setLightbox] = useState<{src: string; alt: string} | null>(null);
  const busy = useRef(false);
  const readRequest = useRef<AbortController | null>(null);

  const fetchImages = useCallback(async () => {
    if (document.visibilityState === "hidden" || readRequest.current || busy.current) return;
    const controller = new AbortController(); readRequest.current = controller;
    const timeout = setTimeout(() => controller.abort("timeout"), 15000);
    try {
      const response = await fetch("/api/game/images", { cache: "no-store", signal: controller.signal });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error("load");
      if (!controller.signal.aborted) {
        setImages(stableImages(data.images || []));
        setGameState({ gameEnded: !!data.gameEnded, winner: data.winner || null, rankings: data.rankings || [], lessonId: data.lessonId || null, targetGrade: data.targetGrade || null });
        setReadError("");
      }
    } catch {
      if (!controller.signal.aborted || controller.signal.reason === "timeout") setReadError("Санал хураалтыг шинэчилж чадсангүй. Холболтоо шалгаад дахин оролдоно уу.");
    } finally { clearTimeout(timeout); if (readRequest.current === controller) { readRequest.current = null; setLoading(false); } }
  }, []);

  useEffect(() => {
    void fetchImages(); const timer = setInterval(fetchImages, 15000);
    document.addEventListener("visibilitychange", fetchImages);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", fetchImages); readRequest.current?.abort(); readRequest.current = null; };
  }, [fetchImages]);
  useEffect(() => {
    if (session?.role !== "teacher") return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort("timeout"), 15000);
    setLessonError("");
    fetch("/api/lessons", { signal: controller.signal }).then(async response => {
      const data = await response.json(); if (!response.ok || !data.ok) throw new Error("load");
      if (!controller.signal.aborted) setLessons(data.lessons || []);
    }).catch(() => { if (!controller.signal.aborted || controller.signal.reason === "timeout") setLessonError("Хичээлийн жагсаалт ачаалсангүй."); }).finally(() => clearTimeout(timer));
    return () => { controller.abort(); clearTimeout(timer); };
  }, [session?.role, lessonRetry]);

  async function mutate(action: Action | "vote", imageId?: string) {
    if (busy.current || !session || (action !== "vote" && session.role !== "teacher")) return;
    if (action === "vote" && gameState.gameEnded) return;
    if (action === "setup" && !selectedLessonId) return;
    busy.current = true; setPending(imageId || action); setError(""); setNotice("");
    readRequest.current?.abort(); readRequest.current = null;
    try {
      const response = await fetch(action === "vote" ? "/api/game/images/vote" : `/api/game/${action}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(25000),
        ...(action === "vote" ? {body: JSON.stringify({id: imageId, vote: "like"})} : action === "setup" ? {body: JSON.stringify({lessonId: selectedLessonId, targetGrade: selectedGrade || null})} : {}),
      });
      const data = await response.json(); if (!response.ok || !data.ok) throw new Error(data.error || "Үйлдлийг гүйцэтгэж чадсангүй.");
      if (Array.isArray(data.images)) setImages(stableImages(data.images));
      if (action === "reset") { setGameState(emptyState); setImages([]); }
      if (action === "end") setGameState(previous => ({...previous, gameEnded: true, winner: data.winner || null, rankings: data.rankings || []}));
      invalidateCache("/api/game"); invalidateCache("/api/leaderboard");
      if (action !== "vote") setNotice(data.message || "Өөрчлөлт хадгалагдлаа.");
      setConfirmAction(null);
    } catch (cause) { setError(cause instanceof Error && cause.name !== "TimeoutError" ? cause.message : "Хариу удаж байна. Дахин илгээхээс өмнө шинэчилж, үр дүнг шалгаарай."); }
    finally { busy.current = false; setPending(null); }
    if (action !== "vote") void fetchImages();
  }

  return <DashboardLayout><div className="mv-page">
    <header className="mv-page-header"><div><p className="mv-eyebrow">Бүтээлээ сориорой</p><h1 className="mv-title">Бүтээлийн санал хураалт</h1><p className="mv-subtitle">Ангийнхаа бүтээлүүдийг үзээд, таалагдсан ажилдаа санал өгөөрэй.</p></div><Link href="/spinner" className="mv-button-secondary">Азын хүрд →</Link></header>
    {(error || readError) && <div role="alert" className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error || readError}<button onClick={() => { setError(""); void fetchImages(); }} disabled={!!pending} className="ml-3 min-h-11 font-semibold underline">Шинэчлэх</button></div>}
    {notice && <p role="status" className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">{notice}</p>}
    {!session && <div className="mv-panel flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm leading-relaxed text-slate-400">Бүтээлүүдийг чөлөөтэй үзээрэй. Санал өгөхийн тулд нэвтрэх шаардлагатай.</p><Link href="/login" className="mv-button-secondary shrink-0">Нэвтрэх</Link></div>}
    {session?.role === "teacher" && !gameState.lessonId && !loading && <section className="mv-panel grid gap-5 lg:grid-cols-[minmax(180px,0.7fr)_minmax(0,1.3fr)] lg:gap-8"><div><p className="mb-3 text-sm font-semibold text-violet-300">Багшийн тохиргоо</p><h2 className="text-xl font-bold text-white">Санал хураалт эхлүүлэх</h2><p className="mt-2 max-w-lg text-sm leading-6 text-slate-400">Сонгосон хичээлд илгээсэн бүтээлүүдээр санал хураалт үүсгэнэ.</p></div><div className="min-w-0 space-y-4">{lessonError && <p role="alert" className="text-sm text-rose-300">{lessonError}<button className="ml-3 min-h-11 underline" onClick={() => setLessonRetry(v => v + 1)}>Дахин ачаалах</button></p>}<div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="game-lesson" className="mv-label">Хичээл</label><select id="game-lesson" className="mv-field" value={selectedLessonId} onChange={e => setSelectedLessonId(e.target.value)}><option value="">Хичээл сонгох</option>{lessons.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}</select></div><div><label htmlFor="game-grade" className="mv-label">Хамрагдах анги</label><select id="game-grade" className="mv-field" value={selectedGrade} onChange={e => setSelectedGrade(e.target.value)}><option value="">Бүх анги</option>{["9","10","11","12","Р"].map(g => <option key={g} value={g}>{g}-р анги</option>)}</select></div></div><button className="mv-button-primary" disabled={!selectedLessonId || !!pending} onClick={() => setConfirmAction("setup")}>Санал хураалт эхлүүлэх</button></div></section>}
    {loading ? <div role="status" className="grid gap-5 sm:grid-cols-2">{[0,1].map(i => <div key={i} className="h-72 animate-pulse rounded-2xl bg-white/5" />)}<span className="sr-only">Санал хураалт ачаалж байна…</span></div> : !gameState.lessonId && !error && !readError ? <div className="mv-status"><p className="text-lg font-semibold text-white">Одоогоор санал хураалт эхлээгүй байна.</p><p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-400">Багш хичээлээ сонгож санал хураалт эхлүүлэхэд бүтээлүүд энд харагдана. Энэ хооронд дараагийн даалгавраа үзээрэй.</p><Link className="mv-button-secondary mt-5" href="/lessons">Хичээлүүд рүү очих</Link></div> : gameState.lessonId && <>
      <div className="mv-panel flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between lg:px-6 lg:py-5"><div><span className={`inline-block rounded-full px-3 py-1.5 text-sm font-semibold ${gameState.gameEnded ? "bg-amber-500/15 text-amber-200" : "bg-emerald-500/15 text-emerald-200"}`}>{gameState.gameEnded ? "Дууссан" : "Санал авч байна"}</span><p className="mt-3 font-semibold text-white">{lessons.find(l => l.id === gameState.lessonId)?.title || "Ангийн бүтээлүүд"}</p><p className="mt-1 text-sm text-slate-400">{images.length} бүтээл · {gameState.targetGrade ? `${gameState.targetGrade}-р анги` : "Бүх анги"}</p></div>{session?.role === "teacher" && <div className="flex flex-wrap gap-3">{!gameState.gameEnded && <button className="mv-button-primary" disabled={!!pending || images.length === 0} onClick={() => setConfirmAction("end")}>Дуусгах</button>}<button className="mv-button-secondary" disabled={!!pending} onClick={() => setConfirmAction("reset")}>Дахин тохируулах</button></div>}</div>
      {gameState.gameEnded && (gameState.rankings.length > 0 || gameState.winner) && <section className="mv-panel border-amber-500/30"><h2 className="mb-4 text-xl font-bold text-white">Санал хураалтын үр дүн</h2>{gameState.rankings.length ? <ol className="grid gap-3 xl:grid-cols-3">{gameState.rankings.map(r => <li key={r.email} className="flex flex-wrap items-center gap-3 rounded-xl bg-white/5 p-4"><span className="text-xl font-bold tabular-nums text-amber-300">#{r.rank}</span><span className="min-w-0 flex-1 break-words text-white">{r.name}</span><span className="text-sm text-slate-400">{r.likes} санал</span><span className="font-semibold text-emerald-300">+{r.xp} XP</span></li>)}</ol> : <p className="text-amber-200">{gameState.winner?.name} хамгийн олон санал авлаа.</p>}</section>}
      {images.length === 0 ? <div className="mv-status"><p className="text-white">Одоогоор илгээсэн бүтээл алга.</p><Link href={`/lessons/${gameState.lessonId}`} className="mv-button-secondary mt-4">Хичээлийн даалгавар үзэх</Link></div> : <section className={`grid items-start gap-5 sm:grid-cols-2 ${images.length >= 3 ? "2xl:grid-cols-3" : ""}`} aria-label="Санал өгөх бүтээлүүд"><div className="col-span-full flex flex-col justify-between gap-2 sm:flex-row sm:items-center"><h2 className="text-lg font-semibold text-white">Илгээсэн бүтээлүүд</h2><p className="text-sm leading-6 text-slate-400">Зураг дээр дарж бүтнээр нь үзээрэй.</p></div>{images.map((item, index) => {
        const sources = (item.imageUrls?.length ? item.imageUrls : [item.imageUrl]).filter(Boolean);
        const current = Math.min(currentImageIndex[item.id] || 0, Math.max(0, sources.length - 1));
        const name = item.studentNickname || item.studentName || "Сурагч";
        const liked = !!session && (item.likedBy || []).includes(session.email);
        return <article key={item.id} className="mv-panel min-w-0 space-y-4 p-4 xl:p-5"><div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-sm font-semibold text-violet-200">{index + 1}</span><h3 className="min-w-0 break-words text-base font-semibold text-white">{name}</h3></div><div className="relative">{sources[current] ? <button className="block w-full rounded-xl" onClick={() => setLightbox({src:sources[current],alt:`${name} — бүтээл ${current + 1}`})} aria-label={`${name} бүтээлийг томруулах`}><PostImage src={sources[current]} alt={`${name} — бүтээл ${current + 1}`} priority={index === 0} className="max-h-[440px]" sizes={images.length >= 3 ? "(min-width: 1536px) 430px, (min-width: 1024px) 520px, (min-width: 640px) 45vw, 92vw" : "(min-width: 1536px) 680px, (min-width: 1024px) 520px, (min-width: 640px) 45vw, 92vw"} /></button> : <div className="mv-status text-sm">Зураг байхгүй</div>}{sources.length > 1 && <div className="mt-3 flex items-center justify-between gap-3"><button className="mv-button-secondary px-4" disabled={current === 0} aria-label="Өмнөх зураг" onClick={() => setCurrentImageIndex(v => ({...v,[item.id]:current - 1}))}>←</button><span className="text-sm tabular-nums text-slate-400">{current + 1} / {sources.length}</span><button className="mv-button-secondary px-4" disabled={current === sources.length - 1} aria-label="Дараагийн зураг" onClick={() => setCurrentImageIndex(v => ({...v,[item.id]:current + 1}))}>→</button></div>}</div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4"><span className="text-sm tabular-nums text-slate-300">{item.likes} санал</span><button disabled={!!pending || gameState.gameEnded || !session} onClick={() => void mutate("vote",item.id)} aria-pressed={liked} className={liked ? "mv-button-primary" : "mv-button-secondary"}>{pending === item.id ? "Илгээж байна…" : liked ? "♥ Санал өгсөн" : "♡ Санал өгөх"}</button></div></article>;
      })}</section>}
    </>}
    <Modal open={confirmAction !== null} onClose={() => setConfirmAction(null)} title={confirmAction === "setup" ? "Санал хураалт эхлүүлэх" : confirmAction === "end" ? "Санал хураалт дуусгах" : "Санал хураалтыг дахин тохируулах"} busy={!!pending} footer={<><button disabled={!!pending} className="mv-button-secondary" onClick={() => setConfirmAction(null)}>Болих</button><button disabled={!!pending} className="mv-button-primary" onClick={() => confirmAction && void mutate(confirmAction)}>{pending ? "Гүйцэтгэж байна…" : "Баталгаажуулах"}</button></>}><p className="text-sm leading-relaxed text-slate-300">{confirmAction === "setup" ? `“${lessons.find(l=>l.id===selectedLessonId)?.title}” хичээлийн бүтээлүүдээр ${selectedGrade ? selectedGrade + '-р ангийн' : 'бүх ангийн'} санал хураалт эхлүүлнэ.` : confirmAction === "end" ? "Санал хураалтыг хааж, эхний 3 байрт 5, 3, 2 XP олгоно. Дуусгасны дараа дахин санал авахгүй." : "Одоогийн тоглолтын мэдээллийг арилгаж, шинэ хичээл сонгох боломжтой болгоно."}</p>{error && <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}</Modal>
    {lightbox && <ImageLightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />}
  </div></DashboardLayout>;
}
