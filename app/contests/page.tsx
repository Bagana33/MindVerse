"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSession } from "../../components/auth/useSession";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import Modal from "../../components/ui/Modal";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cachedFetch, invalidateCache } from "../../lib/fetchCache";

type Contest = {
  id: string;
  title: string;
  description: string;
  authorName: string;
  authorEmail: string;
  startDate: string;
  endDate: string;
  prize: number;
  targetGrades: string[];
  participants: string[];
  submissions: { userName: string; votes: string[] }[];
  status: "upcoming" | "active" | "ended";
  createdAt: string;
};
const statusInfo = {
  active: {
    label: "Идэвхтэй",
    heading: "Одоо оролцох уралдаан",
    color: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  },
  upcoming: {
    label: "Удахгүй",
    heading: "Удахгүй эхлэх уралдаан",
    color: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  },
  ended: {
    label: "Дууссан",
    heading: "Өмнөх уралдаанууд",
    color: "border-slate-600 bg-slate-800 text-slate-300",
  },
};
const localDateInput = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Date(date.getTime() - date.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
};

function ContestsContent() {
  const { session } = useSession();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(
    searchParams?.get("search") || "",
  );
  const [statusFilter, setStatusFilter] = useState("all");
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Contest | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [prize, setPrize] = useState(100);
  const [targetGrades, setTargetGrades] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const requestRef = useRef(0);
  const actionRef = useRef(false);

  useEffect(() => {
    setSearchInput(searchParams?.get("search") || "");
  }, [searchParams]);
  const fetchContests = useCallback(async () => {
    const request = ++requestRef.current;
    setLoading(true);
    setLoadError(null);
    try {
      const response = await cachedFetch("/api/contests");
      const json = await response.json();
      if (!response.ok || !json.ok || !Array.isArray(json.contests))
        throw new Error("unavailable");
      if (requestRef.current === request)
        setContests(
          json.contests.map((contest: Contest) => ({
            ...contest,
            participants: contest.participants || [],
            submissions: contest.submissions || [],
            targetGrades: contest.targetGrades || [],
          })),
        );
    } catch {
      if (requestRef.current === request)
        setLoadError(
          "Уралдаануудыг ачаалж чадсангүй. Холболтоо шалгаад дахин оролдоно уу.",
        );
    } finally {
      if (requestRef.current === request) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void fetchContests();
    return () => {
      requestRef.current += 1;
    };
  }, [fetchContests]);

  function resetForm() {
    setTitle("");
    setDescription("");
    setStartDate("");
    setEndDate("");
    setPrize(100);
    setTargetGrades([]);
    setEditingId(null);
    setShowCreateForm(false);
    setActionError(null);
  }
  function startEdit(contest: Contest) {
    setEditingId(contest.id);
    setTitle(contest.title);
    setDescription(contest.description);
    setStartDate(localDateInput(contest.startDate));
    setEndDate(localDateInput(contest.endDate));
    setPrize(contest.prize);
    setTargetGrades(contest.targetGrades);
    setActionError(null);
    setShowCreateForm(true);
  }
  async function handleSaveContest(event: React.FormEvent) {
    event.preventDefault();
    if (actionRef.current) return;
    if (!title.trim() || !description.trim() || !startDate || !endDate) {
      setActionError("Заавал бөглөх талбаруудаа шалгана уу.");
      return;
    }
    if (new Date(endDate) <= new Date(startDate)) {
      setActionError("Дуусах хугацаа эхлэх хугацаанаас хойш байх ёстой.");
      return;
    }
    if (!Number.isFinite(prize) || prize < 0) {
      setActionError("Шагналын XP нь 0 буюу түүнээс их тоо байна.");
      return;
    }
    actionRef.current = true;
    setBusy(true);
    setActionError(null);
    try {
      const response = await fetch(
        editingId ? `/api/contests/${editingId}` : "/api/contests",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(30000),
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim(),
            startDate: new Date(startDate).toISOString(),
            endDate: new Date(endDate).toISOString(),
            prize,
            targetGrades,
          }),
        },
      );
      const json = await response.json();
      if (!response.ok || !json.ok || !json.contest)
        throw new Error(json.error || "Уралдааныг хадгалж чадсангүй.");
      // A read started before this write must not replace the confirmed result.
      requestRef.current += 1;
      setLoading(false);
      setLoadError(null);
      setContests((current) =>
        editingId
          ? current.map((contest) =>
              contest.id === editingId ? json.contest : contest,
            )
          : [json.contest, ...current],
      );
      invalidateCache("/api/contests");
      setNotice(
        editingId
          ? "Уралдааны өөрчлөлтийг хадгаллаа."
          : "Шинэ уралдаан үүслээ.",
      );
      resetForm();
    } catch (error) {
      setActionError(
        error instanceof Error &&
          !["TimeoutError", "TypeError", "AbortError", "SyntaxError"].includes(
            error.name,
          )
          ? error.message
          : "Хариу хүлээх хугацаа дууслаа. Дахин илгээхээс өмнө жагсаалтаа шинэчилж шалгана уу.",
      );
    } finally {
      actionRef.current = false;
      setBusy(false);
    }
  }
  async function handleDelete() {
    if (!deleteTarget || actionRef.current) return;
    actionRef.current = true;
    setBusy(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/contests/${deleteTarget.id}`, {
        method: "DELETE",
        signal: AbortSignal.timeout(30000),
      });
      const json = await response.json();
      if (!response.ok || !json.ok)
        throw new Error(json.error || "Уралдааныг устгаж чадсангүй.");
      requestRef.current += 1;
      setLoading(false);
      setLoadError(null);
      setContests((current) =>
        current.filter((contest) => contest.id !== deleteTarget.id),
      );
      invalidateCache("/api/contests");
      setNotice("Уралдааныг устгалаа.");
      setDeleteTarget(null);
    } catch {
      setActionError(
        "Устгалын хариу ирсэнгүй. Жагсаалтаа шинэчилж шалгана уу.",
      );
    } finally {
      actionRef.current = false;
      setBusy(false);
    }
  }

  const query = searchInput.trim().toLowerCase();
  const filteredContests = contests.filter(
    (contest) =>
      (statusFilter === "all" || contest.status === statusFilter) &&
      (!query ||
        [
          contest.title,
          contest.description,
          contest.authorName,
          contest.authorEmail,
        ].some((value) => value?.toLowerCase().includes(query))),
  );
  return (
    <DashboardLayout>
      <div className="mv-page space-y-6 xl:space-y-8">
        <header className="mv-page-header">
          <div>
            <p className="mv-eyebrow">БҮТЭЭЛЧ СОРИЛТ</p>
            <h1 className="mv-title">Уралдаанууд</h1>
            <p className="mv-subtitle">
              Шинэ санаагаа бүтээл болгож, бусдаас суралцаарай.
            </p>
          </div>
          {session?.role === "teacher" && (
            <button
              type="button"
              className="mv-button-primary"
              onClick={() => {
                resetForm();
                setShowCreateForm(true);
              }}
            >
              + Уралдаан нэмэх
            </button>
          )}
        </header>
        {notice && (
          <p
            role="status"
            className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-200"
          >
            {notice}
          </p>
        )}
        <div className="mv-panel grid gap-4 p-4 sm:p-5 xl:grid-cols-[minmax(240px,1fr)_auto] xl:items-end">
          <div className="min-w-0">
            <label htmlFor="contest-search" className="mv-label">
              Уралдаан хайх
            </label>
            <input
              id="contest-search"
              type="search"
              className="mv-field"
              placeholder="Уралдааны нэр, сэдэв, багш…"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </div>
          <div
            role="group"
            aria-label="Уралдааны төлөв"
            className="flex flex-wrap gap-2 xl:justify-end"
          >
            {[
              { id: "all", label: "Бүгд" },
              ...Object.entries(statusInfo).map(([id, item]) => ({
                id,
                label: item.label,
              })),
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={statusFilter === item.id}
                onClick={() => setStatusFilter(item.id)}
                className={`min-h-11 rounded-xl border px-4 py-2 text-sm transition-colors ${statusFilter === item.id ? "border-violet-400/50 bg-violet-500/15 text-violet-200" : "border-white/10 text-slate-300 hover:bg-white/5"}`}
              >
                {item.label}{" "}
                <span className="ml-1 tabular-nums opacity-70">
                  {item.id === "all"
                    ? contests.length
                    : contests.filter((contest) => contest.status === item.id)
                        .length}
                </span>
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <div role="status" className="mv-panel p-8 text-slate-300">
            Уралдаануудыг ачаалж байна…
          </div>
        ) : loadError ? (
          <div role="alert" className="mv-panel p-8 text-center">
            <p className="text-slate-300">{loadError}</p>
            <button
              type="button"
              className="mv-button-primary mt-4"
              onClick={() => {
                invalidateCache("/api/contests");
                void fetchContests();
              }}
            >
              Дахин оролдох
            </button>
          </div>
        ) : filteredContests.length === 0 ? (
          <div className="mv-panel p-8 text-center">
            <h2 className="text-lg font-semibold text-white">
              {query || statusFilter !== "all"
                ? "Тохирох уралдаан олдсонгүй"
                : "Шинэ уралдааныг хүлээж байна"}
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              {query || statusFilter !== "all"
                ? "Өөр үгээр хайх эсвэл шүүлтүүрээ цэвэрлээрэй."
                : "Уралдаан нэмэгдэхэд хугацаа, сэдэв, шагнал нь энд харагдана."}
            </p>
            {(query || statusFilter !== "all") && (
              <button
                type="button"
                className="mv-button-secondary mt-4"
                onClick={() => {
                  setSearchInput("");
                  setStatusFilter("all");
                }}
              >
                Шүүлтүүр цэвэрлэх
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {(Object.keys(statusInfo) as Array<Contest["status"]>).map(
              (status) => {
                const group = filteredContests.filter(
                  (contest) => contest.status === status,
                );
                if (!group.length) return null;
                return (
                  <section
                    key={status}
                    aria-labelledby={`contest-group-${status}`}
                  >
                    <h2
                      id={`contest-group-${status}`}
                      className="mb-4 flex flex-wrap items-center gap-3 text-xl font-semibold tracking-tight text-white"
                    >
                      {statusInfo[status].heading}
                      <span className="rounded-lg bg-white/5 px-2.5 py-1 text-sm font-medium tabular-nums text-slate-400">
                        {group.length}
                      </span>
                    </h2>
                    <div className="grid items-stretch gap-5 xl:grid-cols-2 2xl:grid-cols-3">
                      {group.map((contest) => {
                        const winner =
                          status === "ended"
                            ? [...(contest.submissions || [])].sort(
                                (a, b) =>
                                  (b.votes?.length || 0) -
                                  (a.votes?.length || 0),
                              )[0]
                            : null;
                        const isAuthor =
                          session?.role === "teacher" &&
                          session.email === contest.authorEmail;
                        return (
                          <article
                            key={contest.id}
                            className="mv-panel flex min-w-0 flex-col p-5 transition-colors hover:border-violet-500/40 sm:p-6"
                          >
                            <div className="mb-4 flex items-center justify-between gap-3">
                              <span
                                className={`rounded-lg border px-3 py-1 text-sm font-medium ${statusInfo[status].color}`}
                              >
                                {statusInfo[status].label}
                              </span>
                              <span className="text-lg font-semibold tabular-nums tracking-tight text-violet-300">
                                {contest.prize} XP
                              </span>
                            </div>
                            <Link
                              href={`/contests/${contest.id}`}
                              className="min-w-0 flex-1"
                            >
                              <h3 className="break-words text-xl font-semibold leading-7 tracking-tight text-white hover:text-violet-300">
                                {contest.title}
                              </h3>
                              <p className="mt-3 line-clamp-3 whitespace-pre-line break-words text-sm leading-7 text-slate-300">
                                {contest.description}
                              </p>
                            </Link>
                            <dl className="mt-5 grid grid-cols-1 gap-3 text-sm text-slate-300 sm:grid-cols-2">
                              <div>
                                <dt className="text-sm text-slate-400">Багш</dt>
                                <dd className="mt-1 break-words font-medium text-slate-200">
                                  {contest.authorName}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-sm text-slate-400">
                                  {status === "upcoming"
                                    ? "Эхлэх хугацаа"
                                    : "Дуусах хугацаа"}
                                </dt>
                                <dd className="mt-1 tabular-nums">
                                  <time
                                    dateTime={
                                      status === "upcoming"
                                        ? contest.startDate
                                        : contest.endDate
                                    }
                                  >
                                    {new Date(
                                      status === "upcoming"
                                        ? contest.startDate
                                        : contest.endDate,
                                    ).toLocaleString("mn-MN", {
                                      year: "numeric",
                                      month: "2-digit",
                                      day: "2-digit",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      hourCycle: "h23",
                                    })}
                                  </time>
                                </dd>
                              </div>
                            </dl>
                            {winner && (
                              <p className="mt-4 rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                                🏆 Ялагч: {winner.userName}
                              </p>
                            )}
                            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
                              <Link
                                href={`/contests/${contest.id}`}
                                className="mv-button-secondary"
                                aria-label={`${contest.title} — дэлгэрэнгүй`}
                              >
                                Дэлгэрэнгүй →
                              </Link>
                              {isAuthor ? (
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    className="min-h-11 rounded-xl px-3 text-sm text-sky-300 hover:bg-sky-500/10"
                                    onClick={() => startEdit(contest)}
                                    aria-label={`${contest.title} засах`}
                                  >
                                    Засах
                                  </button>
                                  <button
                                    type="button"
                                    className="min-h-11 rounded-xl px-3 text-sm text-rose-300 hover:bg-rose-500/10"
                                    onClick={() => {
                                      setDeleteTarget(contest);
                                      setActionError(null);
                                    }}
                                    aria-label={`${contest.title} устгах`}
                                  >
                                    Устгах
                                  </button>
                                </div>
                              ) : (
                                <span className="text-sm text-slate-400">
                                  {contest.participants?.length || 0} оролцогч
                                </span>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                );
              },
            )}
          </div>
        )}
      </div>
      <Modal
        open={showCreateForm && session?.role === "teacher"}
        onClose={resetForm}
        title={editingId ? "Уралдаан засах" : "Шинэ уралдаан"}
        wide
        busy={busy}
      >
        <form onSubmit={handleSaveContest} className="space-y-5">
          <fieldset disabled={busy} className="space-y-5">
            <div>
              <label htmlFor="contest-title" className="mv-label">
                Гарчиг *
              </label>
              <input
                id="contest-title"
                className="mv-field"
                required
                maxLength={200}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="contest-description" className="mv-label">
                Сэдэв, шаардлага *
              </label>
              <textarea
                id="contest-description"
                className="mv-field"
                rows={5}
                required
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="contest-start" className="mv-label">
                  Эхлэх хугацаа *
                </label>
                <input
                  id="contest-start"
                  type="datetime-local"
                  className="mv-field"
                  required
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </div>
              <div>
                <label htmlFor="contest-end" className="mv-label">
                  Дуусах хугацаа *
                </label>
                <input
                  id="contest-end"
                  type="datetime-local"
                  className="mv-field"
                  required
                  min={startDate || undefined}
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              </div>
            </div>
            <p className="text-sm text-slate-400">
              Огноо, цаг таны төхөөрөмжийн цагийн бүсээр харагдана.
            </p>
            <div>
              <label htmlFor="contest-prize" className="mv-label">
                Шагналын XP *
              </label>
              <input
                id="contest-prize"
                type="number"
                min={0}
                step={1}
                required
                className="mv-field"
                value={prize}
                onChange={(event) => setPrize(Number(event.target.value))}
              />
            </div>
            <fieldset>
              <legend className="mv-label">Хамрагдах анги</legend>
              <p className="mb-3 text-sm text-slate-400">
                Анги сонгоогүй бол бүх ангид харагдана.
              </p>
              <div className="flex flex-wrap gap-2">
                {["9", "10", "11", "12"].map((grade) => (
                  <button
                    key={grade}
                    type="button"
                    aria-pressed={targetGrades.includes(grade)}
                    onClick={() =>
                      setTargetGrades((current) =>
                        current.includes(grade)
                          ? current.filter((value) => value !== grade)
                          : [...current, grade],
                      )
                    }
                    className={`min-h-11 rounded-xl border px-4 text-sm ${targetGrades.includes(grade) ? "border-violet-400 bg-violet-500/20 text-white" : "border-slate-700 text-slate-300"}`}
                  >
                    {grade}-р анги
                  </button>
                ))}
              </div>
            </fieldset>
          </fieldset>
          {actionError && (
            <p
              role="alert"
              className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-200"
            >
              {actionError}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              className="mv-button-secondary"
              disabled={busy}
              onClick={resetForm}
            >
              Цуцлах
            </button>
            <button type="submit" className="mv-button-primary" disabled={busy}>
              {busy
                ? "Хадгалж байна…"
                : editingId
                  ? "Өөрчлөлт хадгалах"
                  : "Уралдаан үүсгэх"}
            </button>
          </div>
        </form>
      </Modal>
      <Modal
        open={!!deleteTarget}
        onClose={() => {
          setDeleteTarget(null);
          setActionError(null);
        }}
        title="Уралдаан устгах"
        busy={busy}
      >
        <p className="break-words text-slate-300">
          “{deleteTarget?.title}” уралдааныг устгах уу? Энэ үйлдлийг буцаах
          боломжгүй.
        </p>
        {actionError && (
          <p role="alert" className="mt-3 text-sm text-rose-200">
            {actionError}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            className="mv-button-secondary"
            disabled={busy}
            onClick={() => setDeleteTarget(null)}
          >
            Болих
          </button>
          <button
            type="button"
            className="mv-button-primary !bg-rose-600"
            disabled={busy}
            onClick={() => void handleDelete()}
          >
            {busy ? "Устгаж байна…" : "Устгах"}
          </button>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
export default function ContestsPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout>
          <p role="status" className="mv-page text-slate-300">
            Уралдаануудыг ачаалж байна…
          </p>
        </DashboardLayout>
      }
    >
      <ContestsContent />
    </Suspense>
  );
}
