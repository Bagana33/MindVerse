"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { DashboardLayout } from "../../../components/layout/DashboardLayout";
import { useSession } from "../../../components/auth/useSession";
import Modal from "../../../components/ui/Modal";
import { invalidateCache } from "../../../lib/fetchCache";
import Link from "next/link";

type ContestSubmission = {
  id: string;
  contestId: string;
  userEmail: string;
  userName: string;
  fileUrl: string;
  description?: string;
  votes: string[];
  submittedAt: string;
};

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
  submissions: ContestSubmission[];
  status: "upcoming" | "active" | "ended";
  createdAt: string;
};

function normalizeContest(contest: Contest): Contest {
  return {
    ...contest,
    targetGrades: contest.targetGrades || [],
    participants: contest.participants || [],
    submissions: (contest.submissions || []).map((submission) => ({
      ...submission,
      votes: submission.votes || [],
    })),
  };
}

export default function ContestDetailPage() {
  const { session } = useSession();
  const params = useParams();
  const contestId = String(params.id);
  const [contest, setContest] = useState<Contest | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [fileUrl, setFileUrl] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);
  const [votingId, setVotingId] = useState<string | null>(null);
  const [voteError, setVoteError] = useState("");
  const [notice, setNotice] = useState("");
  const requestRef = useRef(0);
  const actionRef = useRef(false);
  const uploadRef = useRef(false);
  const voteRef = useRef(false);

  const fetchContest = useCallback(async () => {
    const request = ++requestRef.current;
    setLoading(true);
    setLoadError("");
    try {
      const response = await fetch(`/api/contests/${contestId}`, {
        signal: AbortSignal.timeout(15000),
        cache: "no-store",
      });
      if (response.status === 404)
        throw new Error(
          "Энэ уралдаан олдсонгүй. Устгагдсан эсвэл холбоос нь өөрчлөгдсөн байж болно.",
        );
      const json = await response.json();
      if (!response.ok || !json.ok || !json.contest)
        throw new Error("Уралдааныг ачаалж чадсангүй. Дахин оролдоно уу.");
      if (request === requestRef.current)
        setContest(normalizeContest(json.contest));
    } catch (error) {
      if (request === requestRef.current)
        setLoadError(
          error instanceof Error &&
            ![
              "TimeoutError",
              "TypeError",
              "AbortError",
              "SyntaxError",
            ].includes(error.name)
            ? error.message
            : "Холболт удаан байна. Дахин оролдоно уу.",
        );
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [contestId]);
  useEffect(() => {
    setContest(null);
    setShowSubmitForm(false);
    setFileUrl("");
    setDescription("");
    setSubmitError("");
    setVoteError("");
    setNotice("");
    void fetchContest();
    return () => {
      requestRef.current += 1;
    };
  }, [fetchContest]);

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    const field = event.currentTarget;
    if (!file || uploadRef.current || actionRef.current) return;
    setSubmitError("");
    if (!file.type.startsWith("image/")) {
      setSubmitError("Зураг файл сонгоно уу.");
      field.value = "";
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setSubmitError("Зургийн хэмжээ 50 MB-аас бага байх ёстой.");
      field.value = "";
      return;
    }
    uploadRef.current = true;
    setUploadingFile(true);
    const request = requestRef.current;
    try {
      const signResponse = await fetch("/api/uploads/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: "neoncanvas/contests" }),
        signal: AbortSignal.timeout(15000),
      });
      const sign = await signResponse.json();
      if (
        !signResponse.ok ||
        !sign.ok ||
        !sign.cloudName ||
        !sign.apiKey ||
        !sign.signature
      )
        throw new Error(
          "Зураг байршуулах холболт амжилтгүй. Дахин оролдоно уу.",
        );
      const form = new FormData();
      form.append("file", file);
      form.append("api_key", sign.apiKey);
      form.append("timestamp", String(sign.timestamp));
      form.append("signature", sign.signature);
      form.append("folder", sign.folder);
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${sign.cloudName}/auto/upload`,
        { method: "POST", body: form, signal: AbortSignal.timeout(90000) },
      );
      const json = await response.json();
      if (!response.ok || !json.secure_url)
        throw new Error("Зургийг байршуулж чадсангүй. Дахин оролдоно уу.");
      if (request === requestRef.current) setFileUrl(json.secure_url);
    } catch {
      if (request === requestRef.current)
        setSubmitError(
          "Зураг байршуулалт амжилтгүй. Холболтоо шалгаад дахин оролдоно уу.",
        );
    } finally {
      uploadRef.current = false;
      setUploadingFile(false);
      field.value = "";
    }
  }
  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (actionRef.current || uploadRef.current) return;
    if (!fileUrl) {
      setSubmitError("Эхлээд бүтээлийн зургаа байршуулна уу.");
      return;
    }
    actionRef.current = true;
    setSubmitting(true);
    setSubmitError("");
    const request = requestRef.current;
    try {
      const response = await fetch(`/api/contests/${contestId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileUrl, description: description.trim() }),
        signal: AbortSignal.timeout(30000),
      });
      const json = await response.json();
      if (!response.ok || !json.ok || !json.contest)
        throw new Error(json.error || "Бүтээлийг илгээж чадсангүй.");
      if (request !== requestRef.current) return;
      setContest(normalizeContest(json.contest));
      invalidateCache("/api/contests");
      setShowSubmitForm(false);
      setFileUrl("");
      setDescription("");
      setNotice("Таны бүтээлийг хүлээн авлаа.");
    } catch (error) {
      if (request === requestRef.current)
        setSubmitError(
          error instanceof Error &&
            ![
              "TimeoutError",
              "TypeError",
              "AbortError",
              "SyntaxError",
            ].includes(error.name)
            ? error.message
            : "Хариу ирсэнгүй. Дахин илгээхээс өмнө уралдаанаа шинэчилж шалгана уу.",
        );
    } finally {
      actionRef.current = false;
      setSubmitting(false);
    }
  }
  async function handleVote(submissionId: string) {
    if (!session || voteRef.current) return;
    voteRef.current = true;
    setVotingId(submissionId);
    setVoteError("");
    const request = requestRef.current;
    try {
      const response = await fetch(`/api/contests/${contestId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId }),
        signal: AbortSignal.timeout(15000),
      });
      const json = await response.json();
      if (!response.ok || !json.ok || !json.contest)
        throw new Error(json.error || "Саналыг хадгалж чадсангүй.");
      if (request === requestRef.current) {
        setContest(normalizeContest(json.contest));
        invalidateCache("/api/contests");
        setNotice("Таны саналыг шинэчиллээ.");
      }
    } catch (error) {
      if (request === requestRef.current)
        setVoteError(
          error instanceof Error &&
            ![
              "TimeoutError",
              "TypeError",
              "AbortError",
              "SyntaxError",
            ].includes(error.name)
            ? error.message
            : "Саналын хариу ирсэнгүй. Хуудсаа шинэчилж шалгана уу.",
        );
    } finally {
      voteRef.current = false;
      setVotingId(null);
    }
  }

  if (loading || loadError || !contest)
    return (
      <DashboardLayout>
        <div className="mv-page space-y-5">
          <Link href="/contests" className="mv-button-secondary">
            ← Уралдаанууд
          </Link>
          <div className="mv-panel p-8" role={loading ? "status" : "alert"}>
            {loading ? (
              <p className="text-slate-300">Уралдааныг ачаалж байна…</p>
            ) : (
              <>
                <h1 className="text-xl font-semibold text-white">
                  Уралдааныг нээж чадсангүй
                </h1>
                <p className="mt-3 text-slate-300">
                  {loadError || "Мэдээлэл олдсонгүй."}
                </p>
                <button
                  type="button"
                  className="mv-button-primary mt-5"
                  onClick={() => void fetchContest()}
                >
                  Дахин оролдох
                </button>
              </>
            )}
          </div>
        </div>
      </DashboardLayout>
    );
  const hasSubmitted = contest.submissions.some(
    (submission) => submission.userEmail === session?.email,
  );
  const canSubmit =
    session?.role === "student" && contest.status === "active" && !hasSubmitted;
  const sortedSubmissions = [...contest.submissions].sort(
    (a, b) => b.votes.length - a.votes.length,
  );
  const statusLabel = {
    active: "Идэвхтэй",
    upcoming: "Удахгүй эхэлнэ",
    ended: "Дууссан",
  }[contest.status];
  const closeSubmit = () => {
    setShowSubmitForm(false);
    setSubmitError("");
  };
  return (
    <DashboardLayout>
      <div className="mv-page space-y-6 xl:space-y-8">
        <Link href="/contests" className="mv-button-secondary">
          ← Уралдаанууд
        </Link>
        <header className="mv-panel grid gap-6 p-5 sm:p-7 xl:grid-cols-[minmax(0,1fr)_320px] xl:gap-8 xl:p-8 2xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0">
            <p className="mv-eyebrow">{statusLabel}</p>
            <h1 className="mv-title max-w-3xl break-words">{contest.title}</h1>
            <p className="mt-5 max-w-[70ch] whitespace-pre-line break-words text-base leading-8 text-slate-300">
              {contest.description}
            </p>
          </div>
          <dl className="grid content-start gap-x-4 gap-y-5 border-t border-white/10 pt-5 sm:grid-cols-2 xl:border-l xl:border-t-0 xl:pl-7 xl:pt-1">
            {[
              {
                label: "Эхлэх хугацаа",
                value: new Date(contest.startDate).toLocaleString("mn-MN", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                  hourCycle: "h23",
                }),
              },
              {
                label: "Дуусах хугацаа",
                value: new Date(contest.endDate).toLocaleString("mn-MN", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                  hourCycle: "h23",
                }),
              },
              {
                label: "Оролцогч",
                value: `${contest.participants.length} сурагч`,
              },
              { label: "Шагнал", value: `${contest.prize} XP` },
            ].map((item) => (
              <div key={item.label}>
                <dt className="text-sm text-slate-400">{item.label}</dt>
                <dd className="mt-1.5 break-words text-base font-semibold leading-6 tabular-nums text-white">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
        </header>
        {notice && (
          <p
            role="status"
            className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-200"
          >
            {notice}
          </p>
        )}
        {canSubmit && (
          <section className="mv-panel flex flex-col gap-4 bg-violet-500/[0.035] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Бүтээлээ хуваалцаарай
              </h2>
              <p className="mt-1 text-sm leading-7 text-slate-400">
                Шаардлагаа шалгаад бүтээлийн зургаа байршуулна уу.
              </p>
            </div>
            <button
              type="button"
              className="mv-button-primary shrink-0"
              onClick={() => setShowSubmitForm(true)}
            >
              + Бүтээл илгээх
            </button>
          </section>
        )}
        {!session && contest.status === "active" && (
          <div className="mv-panel flex flex-wrap items-center justify-between gap-4 p-5">
            <p className="text-sm text-slate-300">
              Нэвтэрч бүтээл илгээх, санал өгөх боломжтой.
            </p>
            <Link href="/login" className="mv-button-primary">
              Нэвтрэх
            </Link>
          </div>
        )}
        {hasSubmitted && (
          <p className="rounded-xl border border-violet-500/25 bg-violet-500/10 p-4 text-sm text-violet-200">
            ✓ Таны бүтээл энэ уралдаанд бүртгэгдсэн.
          </p>
        )}
        {contest.status === "ended" && sortedSubmissions.length > 0 && (
          <div className="mv-panel border-amber-500/30 bg-amber-500/5 p-6">
            <p className="text-sm text-amber-300">🏆 Уралдааны ялагч</p>
            <h2 className="mt-2 break-words text-xl font-semibold text-white">
              {sortedSubmissions[0].userName}
            </h2>
            <p className="mt-1 text-sm text-amber-200">
              {sortedSubmissions[0].votes.length} санал · {contest.prize} XP
            </p>
          </div>
        )}
        <section aria-labelledby="contest-submissions-title">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <h2
              id="contest-submissions-title"
              className="text-xl font-semibold tracking-tight text-white sm:text-2xl"
            >
              Оролцогчдын бүтээлүүд{" "}
              <span className="ml-1 text-base text-slate-400">
                ({contest.submissions.length})
              </span>
            </h2>
            <span className="text-sm text-slate-400">
              Саналын тоогоор эрэмбэлсэн
            </span>
          </div>
          {voteError && (
            <p
              role="alert"
              className="mb-4 rounded-xl border border-rose-500/25 bg-rose-500/10 p-3 text-sm text-rose-200"
            >
              {voteError}
            </p>
          )}
          {!sortedSubmissions.length ? (
            <div className="mv-panel p-8 text-center">
              <h3 className="text-lg font-semibold text-white">
                Анхны бүтээлийг хүлээж байна
              </h3>
              <p className="mt-2 text-sm text-slate-400">
                Илгээсэн бүтээлүүд энд харагдана.
              </p>
            </div>
          ) : (
            <div className="grid items-stretch gap-5 sm:grid-cols-2 2xl:grid-cols-3">
              {sortedSubmissions.map((submission, index) => {
                const isOwn = submission.userEmail === session?.email;
                const hasVoted =
                  !!session && submission.votes.includes(session.email);
                return (
                  <article
                    key={submission.id}
                    className={`mv-panel flex min-w-0 flex-col overflow-hidden ${contest.status === "ended" && index === 0 ? "border-amber-500/40" : ""}`}
                  >
                    <a
                      href={submission.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${submission.userName}-ийн бүтээлийг бүтнээр нээх`}
                      className="group block overflow-hidden border-b border-white/10 bg-slate-950/60"
                    >
                      <img
                        src={submission.fileUrl}
                        alt={`${submission.userName}-ийн бүтээл`}
                        loading="lazy"
                        decoding="async"
                        className="aspect-[4/3] max-h-[480px] w-full object-contain transition-transform duration-300 motion-safe:group-hover:scale-[1.02]"
                      />
                    </a>
                    <div className="flex flex-1 flex-col p-5 sm:p-6">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="break-words text-lg font-semibold leading-7 tracking-tight text-white">
                          {submission.userName}
                        </h3>
                        {isOwn && (
                          <span className="rounded-lg bg-violet-500/15 px-2 py-1 text-sm text-violet-200">
                            Таны бүтээл
                          </span>
                        )}
                        {contest.status === "ended" && index === 0 && (
                          <span className="text-sm text-amber-300">
                            🏆 Ялагч
                          </span>
                        )}
                      </div>
                      {submission.description && (
                        <p className="mt-3 whitespace-pre-line break-words text-sm leading-7 text-slate-300">
                          {submission.description}
                        </p>
                      )}
                      <div className="min-h-5 flex-1" aria-hidden="true" />
                      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
                        <span className="text-sm text-slate-300">
                          👍 {submission.votes.length} санал
                        </span>
                        {contest.status === "active" && session && !isOwn && (
                          <button
                            type="button"
                            aria-pressed={hasVoted}
                            disabled={votingId !== null}
                            onClick={() => void handleVote(submission.id)}
                            className={
                              hasVoted
                                ? "mv-button-primary"
                                : "mv-button-secondary"
                            }
                          >
                            {votingId === submission.id
                              ? "Хадгалж байна…"
                              : hasVoted
                                ? "✓ Санал өгсөн"
                                : "Санал өгөх"}
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
      <Modal
        open={showSubmitForm && canSubmit}
        onClose={closeSubmit}
        title="Бүтээл илгээх"
        wide
        busy={submitting || uploadingFile}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="contest-artwork" className="mv-label">
              Бүтээлийн зураг *
            </label>
            <label
              htmlFor="contest-artwork"
              className={`relative inline-flex min-h-11 items-center gap-2 rounded-xl border border-violet-400/30 bg-violet-500/10 px-4 py-3 text-sm font-medium text-violet-200 transition-colors focus-within:ring-2 focus-within:ring-violet-400 focus-within:ring-offset-2 focus-within:ring-offset-slate-950 ${uploadingFile || submitting ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-violet-500/20"}`}
            >
              Зураг сонгох
              <input
                id="contest-artwork"
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={uploadingFile || submitting}
                className="sr-only"
                aria-describedby="contest-file-help"
              />
            </label>
            <p id="contest-file-help" className="mt-2 text-sm text-slate-400">
              Нэг зураг, хамгийн ихдээ 50 MB.
            </p>
            {uploadingFile && (
              <p role="status" className="mt-3 text-sm text-violet-300">
                Зургийг байршуулж байна…
              </p>
            )}
            {fileUrl && (
              <div className="mt-4 rounded-xl border border-white/10 p-3">
                <img
                  src={fileUrl}
                  alt="Илгээх бүтээлийн урьдчилсан харагдац"
                  className="mx-auto max-h-72 max-w-full rounded-lg object-contain"
                />
                <button
                  type="button"
                  disabled={submitting || uploadingFile}
                  onClick={() => setFileUrl("")}
                  className="mt-3 min-h-11 rounded-lg px-3 text-sm text-rose-300 hover:bg-rose-500/10"
                >
                  Зургийг хасах
                </button>
              </div>
            )}
          </div>
          <div>
            <label htmlFor="contest-artwork-description" className="mv-label">
              Бүтээлийн тайлбар
            </label>
            <textarea
              id="contest-artwork-description"
              value={description}
              disabled={submitting}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              className="mv-field"
              placeholder="Санаа, ашигласан арга, шийдлээ товч тайлбарлаарай…"
            />
          </div>
          {submitError && (
            <p
              role="alert"
              className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-200"
            >
              {submitError}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              className="mv-button-secondary"
              disabled={submitting || uploadingFile}
              onClick={closeSubmit}
            >
              Болих
            </button>
            <button
              type="submit"
              className="mv-button-primary"
              disabled={submitting || uploadingFile || !fileUrl}
            >
              {submitting ? "Илгээж байна…" : "Бүтээл илгээх"}
            </button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
