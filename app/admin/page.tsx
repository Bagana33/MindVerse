"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "../../components/auth/useSession";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import Modal from "../../components/ui/Modal";
import { invalidateCache } from "../../lib/fetchCache";

type Student = { email: string; name?: string; nickname?: string; experience: number; role: string; grade?: string };
type XPPayload = { action: "set" | "add"; amount: number; applyToAll: boolean; studentEmail?: string; targetGrade?: string };
type Review = { kind: "xp"; payload: XPPayload; label: string } | { kind: "delete"; student: Student } | { kind: "reset" };
const studentName = (student: Student) => student.nickname || student.name || student.email;
const numberLabel = (value: number) => Math.round(value || 0).toLocaleString("en-US");

export default function AdminPage() {
  const { session, loading: sessionLoading } = useSession();
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [grade, setGrade] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [action, setAction] = useState<"set" | "add">("add");
  const [amount, setAmount] = useState("");
  const [applyToAll, setApplyToAll] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [review, setReview] = useState<Review | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [resetStudent, setResetStudent] = useState<Student | null>(null);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!sessionLoading && session?.role !== "teacher") router.replace("/");
  }, [session?.role, sessionLoading, router]);

  useEffect(() => {
    if (session?.role !== "teacher") return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    let active = true;
    setLoading(true);
    setLoadError("");
    async function load() {
      try {
        const response = await fetch(`/api/leaderboard${grade === "all" ? "" : `?grade=${grade}`}`, { signal: controller.signal, cache: "no-store" });
        const json = await response.json();
        if (!response.ok || !json.ok || !Array.isArray(json.leaderboard)) throw new Error("Жагсаалтыг ачаалж чадсангүй.");
        if (active) setStudents(json.leaderboard.filter((student: Student) => student.role === "student"));
      } catch {
        if (active) setLoadError("Сурагчдын жагсаалтыг ачаалж чадсангүй. Холболтоо шалгаад дахин оролдоно уу.");
      } finally {
        clearTimeout(timeout);
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [session?.role, grade, refresh]);

  const visibleStudents = useMemo(() => students.filter(student => `${student.name || ""} ${student.nickname || ""} ${student.email}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())), [students, search]);
  const selected = students.find(student => student.email === selectedStudent);
  const refreshList = () => { invalidateCache("/api/leaderboard"); setRefresh(value => value + 1); };
  const openReview = (value: Review) => { if (busyRef.current) return; setReviewError(""); setConfirmation(""); setReview(value); };
  const scopeLabel = grade === "all" ? "Бүртгэлтэй бүх сурагч" : `${grade}-р ангийн бүх сурагч`;

  function reviewXP(event: React.FormEvent) {
    event.preventDefault();
    if (busyRef.current || loading) return;
    setMessage(null);
    const xp = Number(amount);
    if (!amount.trim() || !Number.isSafeInteger(xp)) { setMessage({ type: "error", text: "XP дүнг бүхэл тоогоор оруулна уу." }); return; }
    if (action === "set" && xp < 0) { setMessage({ type: "error", text: "Тогтоох XP нь 0 буюу түүнээс их байна." }); return; }
    if (action === "add" && xp === 0) { setMessage({ type: "error", text: "Нэмэх эсвэл хасах XP дүн 0-ээс ялгаатай байна." }); return; }
    if (!applyToAll && !selected) { setMessage({ type: "error", text: "Өөрчлөх сурагчаа сонгоно уу." }); return; }
    openReview({ kind: "xp", payload: { action, amount: xp, applyToAll, ...(!applyToAll ? { studentEmail: selectedStudent } : {}), ...(grade !== "all" ? { targetGrade: grade } : {}) }, label: applyToAll ? scopeLabel : studentName(selected!) });
  }

  async function confirmReview() {
    if (!review || busyRef.current) return;
    if (review.kind === "delete" && confirmation !== review.student.email) return;
    if (review.kind === "reset" && confirmation !== "0") return;
    busyRef.current = true;
    setBusy(true);
    setReviewError("");
    setMessage(null);
    const snapshot = review;
    try {
      const payload = snapshot.kind === "xp" ? snapshot.payload : snapshot.kind === "reset" ? { action: "set", amount: 0, applyToAll: true } : { studentEmail: snapshot.student.email };
      const response = await fetch(snapshot.kind === "delete" ? "/api/admin/delete-student" : "/api/admin/manage-xp", {
        method: snapshot.kind === "delete" ? "DELETE" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(30_000),
      });
      const json = await response.json();
      if (!response.ok || (snapshot.kind === "delete" ? json.success !== true : json.ok !== true)) { setReviewError(json.error || "Өөрчлөлтийг хадгалж чадсангүй."); return; }
      invalidateCache("/api/leaderboard");
      invalidateCache("/api/user");
      if (snapshot.kind === "delete") {
        setStudents(previous => previous.filter(student => student.email !== snapshot.student.email));
        if (selectedStudent === snapshot.student.email) setSelectedStudent("");
      } else if (snapshot.kind === "reset") {
        setStudents(previous => previous.map(student => ({ ...student, experience: 0 })));
      } else {
        const change = snapshot.payload;
        if (!change.applyToAll) setStudents(previous => previous.map(student => {
          if ((!change.applyToAll && student.email !== change.studentEmail) || (change.targetGrade && student.grade !== change.targetGrade)) return student;
          return { ...student, experience: json.user?.email === student.email ? json.user.experience : Math.max(0, change.action === "set" ? change.amount : student.experience + change.amount) };
        }));
        setAmount("");
      }
      setMessage({ type: "success", text: json.message || "Өөрчлөлт амжилттай хадгалагдлаа." });
      setReview(null);
      // Reload only after confirmed success. The server remains the source of truth.
      refreshList();
    } catch {
      setReview(null);
      setMessage({ type: "error", text: "Хүсэлтийн үр дүнг баталгаажуулж чадсангүй. Дахин өөрчлөхөөс өмнө жагсаалтыг шинэчилж шалгана уу." });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function openPassword(student: Student) {
    if (busyRef.current) return;
    setResetStudent(student); setPassword(""); setPasswordConfirm(""); setPasswordVisible(false); setPasswordError("");
  }

  async function resetPassword(event: React.FormEvent) {
    event.preventDefault();
    if (!resetStudent || busyRef.current) return;
    setPasswordError("");
    if (password.trim().length < 6 || password !== password.trim()) { setPasswordError("Нууц үг хамгийн багадаа 6 тэмдэгттэй, эхлэл болон төгсгөлдөө зайгүй байна."); return; }
    if (password !== passwordConfirm) { setPasswordError("Давтан оруулсан нууц үг таарахгүй байна."); return; }
    busyRef.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studentEmail: resetStudent.email, newPassword: password }), signal: AbortSignal.timeout(30_000) });
      const json = await response.json();
      if (!response.ok || !json.ok) { setPasswordError(json.error || "Нууц үг шинэчлэгдсэнгүй."); return; }
      setMessage({ type: "success", text: json.message || "Нууц үг амжилттай шинэчлэгдлээ." });
      setPassword(""); setPasswordConfirm(""); setResetStudent(null);
    } catch {
      setPasswordError("Хүсэлтийн үр дүнг баталгаажуулж чадсангүй. Холболтоо шалгаж, сурагчийн нэвтрэх боломжийг нягтална уу.");
    } finally { busyRef.current = false; setBusy(false); }
  }

  function editStudent(student: Student) {
    if (busyRef.current) return;
    setApplyToAll(false); setSelectedStudent(student.email); setAction("add"); setAmount("");
    formRef.current?.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    amountRef.current?.focus({ preventScroll: true });
  }

  function studentActions(student: Student) {
    return <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:justify-end">
      <button type="button" disabled={busy} onClick={() => editStudent(student)} aria-label={`${studentName(student)} сурагчийн XP өөрчлөх`} className="min-h-11 rounded-xl border border-violet-400/25 px-3 py-2 text-sm font-semibold text-violet-200 hover:bg-violet-500/10 disabled:opacity-50">XP засах</button>
      <button type="button" disabled={busy} onClick={() => openPassword(student)} aria-label={`${studentName(student)} сурагчийн нууц үг шинэчлэх`} className="min-h-11 rounded-xl border border-white/15 px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-white/5 disabled:opacity-50">Нууц үг</button>
      <button type="button" disabled={busy} onClick={() => openReview({ kind: "delete", student })} aria-label={`${studentName(student)} сурагчийг устгах`} className="min-h-11 rounded-xl border border-rose-500/25 px-3 py-2 text-sm font-semibold text-rose-300 hover:bg-rose-500/10 disabled:opacity-50">Устгах</button>
    </div>;
  }

  if (sessionLoading) return <DashboardLayout><div className="mv-page"><div className="mv-panel p-6" role="status">Хандах эрхийг шалгаж байна…</div></div></DashboardLayout>;
  if (session?.role !== "teacher") return <DashboardLayout><div className="mv-page"><section className="mv-panel p-6"><h1 className="mv-title">Багшийн хэсэг</h1><p className="mv-subtitle">Энэ хуудсанд багшийн эрхээр нэвтэрнэ.</p><Link href="/" className="mv-button-secondary mt-4">Нүүр хуудас руу</Link></section></div></DashboardLayout>;

  return <DashboardLayout><div className="mv-page">
    <header className="mv-page-header"><div><p className="mv-eyebrow">MINDVERSE · БАГШ</p><h1 className="mv-title">Сурагчдын удирдлага</h1><p className="mv-subtitle">Ахиц, XP болон нэвтрэх эрхийг нэг дор удирдаарай.</p></div><button type="button" onClick={refreshList} disabled={loading || busy} className="mv-button-secondary">{loading ? "Шинэчилж байна…" : "Жагсаалт шинэчлэх"}</button></header>
    {message && <div role={message.type === "error" ? "alert" : "status"} className={`rounded-2xl border p-4 text-sm leading-6 ${message.type === "success" ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-200" : "border-rose-400/25 bg-rose-500/10 text-rose-200"}`}>{message.text}</div>}

    <section className="mv-panel p-4 sm:p-6 lg:grid lg:grid-cols-[minmax(180px,0.3fr)_minmax(0,1fr)] lg:gap-8 xl:p-7" aria-labelledby="xp-title">
      <div className="mb-5 lg:mb-0"><p className="mb-3 text-sm font-semibold text-violet-300">Ахиц удирдах</p><h2 id="xp-title" className="text-xl font-bold text-white">XP өөрчлөх</h2><p className="mt-1 text-sm leading-6 text-slate-400">Нэг сурагч эсвэл сонгосон ангийн XP-г өөрчилнө. Хадгалахын өмнө дүнг шалгана.</p></div>
      <form ref={formRef} onSubmit={reviewXP} className="min-w-0 scroll-mt-24 space-y-4">
        <fieldset disabled={busy} className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div><label htmlFor="admin-grade" className="mv-label">Анги</label><select id="admin-grade" value={grade} onChange={event => { setGrade(event.target.value); setSelectedStudent(""); }} className="mv-field"><option value="all">Бүх анги</option>{["9", "10", "11", "12"].map(value => <option key={value} value={value}>{value}-р анги</option>)}</select></div>
          <div><span className="mv-label">Хамрах хүрээ</span><label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-white/15 px-4 py-3 text-sm text-slate-200"><input type="checkbox" checked={applyToAll} onChange={event => { setApplyToAll(event.target.checked); setSelectedStudent(""); }} className="h-4 w-4 accent-violet-500" /><span>{scopeLabel}дад үйлчлэх</span></label></div>
          <div className="min-w-0 sm:col-span-2 xl:col-span-1"><label htmlFor="admin-student" className="mv-label">Сурагч</label><select id="admin-student" value={selectedStudent} onChange={event => setSelectedStudent(event.target.value)} disabled={applyToAll || loading || !!loadError} required={!applyToAll} className="mv-field"><option value="">{applyToAll ? scopeLabel : loading ? "Сурагчдыг ачаалж байна…" : "Сурагчаа сонгоно уу"}</option>{students.map(student => <option key={student.email} value={student.email}>{studentName(student)} · {numberLabel(student.experience)} XP</option>)}</select>{selected && !applyToAll && <p className="mt-2 break-all text-sm leading-6 text-slate-400">{selected.email} · Одоогийн XP: {numberLabel(selected.experience)}</p>}</div>
          <div className="min-w-0 xl:col-span-2"><label htmlFor="admin-xp-action" className="mv-label">Үйлдэл</label><select id="admin-xp-action" value={action} onChange={event => setAction(event.target.value as "set" | "add")} className="mv-field"><option value="add">Одоогийн XP дээр нэмэх / хасах</option><option value="set">XP-г шинэ дүнгээр тогтоох</option></select></div>
          <div><label htmlFor="admin-xp-amount" className="mv-label">{action === "set" ? "Шинэ XP дүн" : "Нэмэх / хасах XP"}</label><input id="admin-xp-amount" ref={amountRef} type="number" inputMode="numeric" step="1" min={action === "set" ? 0 : undefined} value={amount} onChange={event => setAmount(event.target.value)} required className="mv-field" placeholder={action === "set" ? "Жишээ: 500" : "Жишээ: 100 эсвэл -20"} aria-describedby="xp-amount-help" /></div>
        </fieldset>
        <p id="xp-amount-help" className="text-sm leading-6 text-slate-400">{action === "set" ? "Өмнөх оноог оруулсан дүнгээр солино." : "Сөрөг тоо оруулбал одоогийн XP-ээс хасна."}{applyToAll && " Нэрийн хайлт энэ үйлдлийн хамрах хүрээг өөрчлөхгүй."}</p>
        <button type="submit" disabled={busy || loading || !!loadError || (!applyToAll && !selectedStudent)} className="mv-button-primary w-full justify-center sm:w-auto">Өөрчлөлтийг шалгах →</button>
      </form>
    </section>

    <section className="mv-panel overflow-hidden !p-0" aria-labelledby="students-title">
      <div className="space-y-4 border-b border-white/10 p-4 sm:p-6 xl:flex xl:items-end xl:justify-between xl:gap-6 xl:space-y-0"><div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-3 xl:justify-start"><div><h2 id="students-title" className="text-lg font-bold text-white">Сурагчдын жагсаалт</h2><p className="mt-1 max-w-xl text-sm leading-6 text-slate-400">9–12-р ангийн чансаанд бүртгэлтэй сурагчид. Анги сонголт дээрх XP хэсэгтэй ижил.</p></div><span role="status" className="rounded-full bg-violet-500/10 px-3 py-1.5 text-sm text-violet-200">{visibleStudents.length} / {students.length} сурагч</span></div><div className="w-full shrink-0 xl:w-80"><label htmlFor="admin-search" className="mv-label">Жагсаалтаас хайх</label><input id="admin-search" type="search" value={search} onChange={event => setSearch(event.target.value)} className="mv-field" placeholder="Нэр, хоч эсвэл имэйл" /></div></div>
      {loading ? <div className="space-y-3 p-5" role="status" aria-busy="true"><p className="text-sm text-slate-300">Жагсаалтыг ачаалж байна…</p>{[0, 1, 2].map(value => <div key={value} className="h-16 rounded-xl bg-slate-800/70 motion-safe:animate-pulse" aria-hidden="true" />)}</div>
        : loadError ? <div role="alert" className="space-y-4 p-6"><p className="text-sm leading-6 text-rose-200">{loadError}</p><button type="button" onClick={refreshList} className="mv-button-secondary">Дахин оролдох</button></div>
        : visibleStudents.length === 0 ? <div className="px-5 py-10 text-center"><h3 className="text-base font-semibold text-white">Сурагч олдсонгүй</h3><p className="mt-2 text-sm text-slate-400">{search ? "Нэр эсвэл имэйлээ өөрчлөөд дахин хайгаарай." : "Өөр анги сонгох эсвэл жагсаалтыг шинэчилнэ үү."}</p>{search && <button type="button" className="mv-button-secondary mt-4" onClick={() => setSearch("")}>Хайлт цэвэрлэх</button>}</div>
        : <><ul className="divide-y divide-white/10 xl:hidden">{visibleStudents.map(student => <li key={student.email} className="space-y-4 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><Link href={`/profile?user=${encodeURIComponent(student.email)}`} className="block break-words text-sm font-semibold text-slate-100 hover:text-violet-300">{studentName(student)}</Link><p className="mt-1 break-all text-sm leading-6 text-slate-400">{student.email}</p><p className="mt-1 text-sm text-slate-400">{student.grade ? `${student.grade}-р анги` : "Анги тохируулаагүй"}</p></div><span className="shrink-0 text-sm font-bold tabular-nums text-violet-200">{numberLabel(student.experience)} XP</span></div>{studentActions(student)}</li>)}</ul>
        <table className="hidden w-full table-fixed text-left xl:table"><caption className="sr-only">Сурагчид, анги, XP болон удирдах үйлдлүүд</caption><thead className="bg-slate-950/35 text-sm font-medium text-slate-400"><tr><th scope="col" className="px-5 py-3">Сурагч</th><th scope="col" className="w-20 py-3">Анги</th><th scope="col" className="w-24 py-3 text-right">XP</th><th scope="col" className="w-[340px] px-5 py-4 text-right">Үйлдэл</th></tr></thead><tbody className="divide-y divide-white/5">{visibleStudents.map(student => <tr key={student.email} className="hover:bg-white/[0.025]"><th scope="row" className="px-5 py-4 font-normal"><Link href={`/profile?user=${encodeURIComponent(student.email)}`} className="block break-words text-sm font-semibold text-white hover:text-violet-300">{studentName(student)}</Link><span className="mt-1 block break-all text-sm leading-6 text-slate-400">{student.email}</span></th><td className="py-4 text-sm text-slate-300">{student.grade || "—"}</td><td className="py-4 text-right text-base font-semibold tabular-nums text-violet-200">{numberLabel(student.experience)}</td><td className="px-5 py-4">{studentActions(student)}</td></tr>)}</tbody></table></>}
    </section>

    <section className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.025] p-4 sm:p-6" aria-labelledby="season-reset-title"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h2 id="season-reset-title" className="text-base font-bold text-rose-200">Шинэ улирал эхлүүлэх</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">Бүртгэлтэй бүх сурагчийн XP-г 0 болгоно. Сонгосон анги болон нэрийн хайлтаас үл хамаарна.</p></div><button type="button" onClick={() => openReview({ kind: "reset" })} disabled={busy || loading} className="min-h-11 shrink-0 rounded-xl border border-rose-500/35 px-4 py-3 text-sm font-semibold text-rose-200 hover:bg-rose-500/10 disabled:opacity-50">Бүх XP-г шинэчлэх</button></div></section>

    <Modal open={!!review} onClose={() => { if (!busyRef.current) setReview(null); }} title={review?.kind === "delete" ? "Сурагчийг бүрмөсөн устгах" : review?.kind === "reset" ? "Бүх сурагчийн XP-г 0 болгох" : "XP өөрчлөлтөө шалгах"} busy={busy} footer={<><button type="button" onClick={() => setReview(null)} disabled={busy} className="mv-button-secondary">Болих</button><button type="button" onClick={confirmReview} disabled={busy || (review?.kind === "delete" && confirmation !== review.student.email) || (review?.kind === "reset" && confirmation !== "0")} className={review?.kind === "xp" ? "mv-button-primary" : "min-h-11 rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50"}>{busy ? "Хадгалж байна…" : review?.kind === "delete" ? "Бүрмөсөн устгах" : "Баталгаажуулах"}</button></>}>
      <div className="space-y-5">{review?.kind === "xp" && <><dl className="space-y-4 rounded-2xl border border-white/10 p-4"><div><dt className="text-sm text-slate-400">Хэнд үйлчлэх</dt><dd className="mt-1 break-words text-base font-semibold text-white">{review.label}</dd>{review.payload.studentEmail && <dd className="mt-1 break-all text-sm leading-6 text-slate-400">{review.payload.studentEmail}</dd>}</div><div><dt className="text-sm text-slate-400">Өөрчлөлт</dt><dd className="mt-1 text-xl font-bold text-violet-200">{review.payload.action === "set" ? `${numberLabel(review.payload.amount)} XP болгож тогтоох` : `${review.payload.amount > 0 ? "+" : ""}${numberLabel(review.payload.amount)} XP`}</dd></div></dl><p className="text-sm leading-6 text-slate-300">{review.payload.action === "set" ? "Одоогийн XP дүн солигдоно." : "Одоогийн XP дээр энэ өөрчлөлт нэмэгдэнэ."}{review.payload.applyToAll && " Хамрах хүрээний бүх сурагчид үйлчилнэ."}</p></>}
      {review?.kind === "delete" && <><p className="break-words text-base font-semibold text-white">{studentName(review.student)}</p><p className="text-sm leading-7 text-slate-300">Энэ сурагчийн бүртгэл, бүтээл, сэтгэгдэл, үнэлгээ, мэдэгдэл болон илгээсэн даалгаврууд устна. Үйлдлийг буцаах боломжгүй.</p><div><label htmlFor="delete-confirm" className="mv-label">Баталгаажуулахын тулд сурагчийн имэйлийг бичнэ үү</label><p className="mb-2 select-all break-all text-sm text-rose-200">{review.student.email}</p><input id="delete-confirm" value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy} autoComplete="off" className="mv-field" /></div></>}
      {review?.kind === "reset" && <><p className="text-sm leading-7 text-slate-300">Бүх ангийн бүх сурагчийн одоогийн XP нь 0 болно. Өмнөх дүнг автоматаар буцаах боломжгүй.</p><div><label htmlFor="reset-confirm" className="mv-label">Баталгаажуулахын тулд 0 гэж бичнэ үү</label><input id="reset-confirm" value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy} inputMode="numeric" autoComplete="off" className="mv-field" /></div></>}
      {reviewError && <p role="alert" className="rounded-xl bg-rose-500/10 p-3 text-sm leading-6 text-rose-200">{reviewError}</p>}</div>
    </Modal>

    <Modal open={!!resetStudent} onClose={() => { if (!busyRef.current) { setResetStudent(null); setPassword(""); setPasswordConfirm(""); } }} title="Сурагчийн нууц үг шинэчлэх" busy={busy}>
      {resetStudent && <form onSubmit={resetPassword} className="space-y-5"><div className="rounded-xl border border-white/10 p-3"><p className="break-words text-sm font-semibold text-white">{studentName(resetStudent)}</p><p className="mt-1 break-all text-sm leading-6 text-slate-400">{resetStudent.email}</p></div><fieldset disabled={busy} className="space-y-4"><div><label htmlFor="student-new-password" className="mv-label">Шинэ нууц үг</label><input id="student-new-password" type={passwordVisible ? "text" : "password"} value={password} onChange={event => setPassword(event.target.value)} minLength={6} maxLength={72} autoComplete="new-password" required className="mv-field" aria-describedby="student-password-help" /></div><div><label htmlFor="student-confirm-password" className="mv-label">Нууц үгээ давтан оруулах</label><input id="student-confirm-password" type={passwordVisible ? "text" : "password"} value={passwordConfirm} onChange={event => setPasswordConfirm(event.target.value)} minLength={6} maxLength={72} autoComplete="new-password" required className="mv-field" /></div><label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-slate-300"><input type="checkbox" checked={passwordVisible} onChange={event => setPasswordVisible(event.target.checked)} className="h-4 w-4 accent-violet-500" />Нууц үгийг харуулах</label></fieldset><p id="student-password-help" className="text-sm leading-6 text-slate-400">6–72 тэмдэгттэй шинэ нууц үг оруулна. Хуучин нууц үг солигдоно.</p>{passwordError && <p role="alert" className="rounded-xl bg-rose-500/10 p-3 text-sm leading-6 text-rose-200">{passwordError}</p>}<div className="flex flex-wrap justify-end gap-2 border-t border-white/10 pt-4"><button type="button" onClick={() => { setResetStudent(null); setPassword(""); setPasswordConfirm(""); }} disabled={busy} className="mv-button-secondary">Болих</button><button type="submit" disabled={busy} className="mv-button-primary">{busy ? "Шинэчилж байна…" : "Нууц үг шинэчлэх"}</button></div></form>}
    </Modal>
  </div></DashboardLayout>;
}
