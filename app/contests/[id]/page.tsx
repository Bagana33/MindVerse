"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { DashboardLayout } from "../../../components/layout/DashboardLayout";
import { useSession } from "../../../components/auth/useSession";
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

export default function ContestDetailPage() {
  const { session } = useSession();
  const params = useParams();
  const router = useRouter();
  const [contest, setContest] = useState<Contest | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Submission states
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [fileUrl, setFileUrl] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [votingId, setVotingId] = useState<string | null>(null);

  useEffect(() => {
    fetchContest();
  }, [params.id]);

  async function fetchContest() {
    try {
      const res = await fetch(`/api/contests/${params.id}`);
      if (res.ok) {
        const json = await res.json();
        setContest(json.contest);
      } else {
        router.push("/contests");
      }
    } catch (err) {
      console.error("Failed to fetch contest:", err);
      router.push("/contests");
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setSubmitError(null);

    if (file.size > 50 * 1024 * 1024) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      setSubmitError(`Файлын хэмжээ 50MB-аас бага байх ёстой (${mb}MB илэрлээ)`);
      return;
    }

    setUploadingFile(true);
    try {
      const signRes = await fetch("/api/uploads/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        }),
      });

      const signData = await signRes.json();
      if (!signData.ok || !signData.uploadUrl) {
        throw new Error("Upload URL авах боломжгүй");
      }

      const uploadRes = await fetch(signData.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      if (!uploadRes.ok) {
        throw new Error("Файл upload хийхэд алдаа гарлаа");
      }

      const fileUrl = signData.publicUrl;
      setFileUrl(fileUrl);
      setFilePreview(fileUrl);
    } catch (err: any) {
      console.error("Upload error:", err);
      setSubmitError(err.message || "Файл upload хийхэд алдаа гарлаа");
    } finally {
      setUploadingFile(false);
    }
  }

  async function handleSubmit() {
    if (!fileUrl) {
      setSubmitError("Файл upload хийх шаардлагатай");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/contests/${params.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileUrl, description }),
      });

        const json = await res.json();
      if (json.ok) {
        setContest(json.contest);
        setShowSubmitForm(false);
        setFileUrl("");
      setDescription("");
        setFilePreview(null);
      } else {
        setSubmitError(json.error || "Илгээхэд алдаа гарлаа");
      }
    } catch (err) {
      console.error("Submit error:", err);
      setSubmitError("Илгээхэд алдаа гарлаа");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVote(submissionId: string) {
    if (!session) return;
    setVotingId(submissionId);
    try {
      const res = await fetch(`/api/contests/${params.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId }),
      });

      const json = await res.json();
      if (json.ok) {
      setContest(json.contest);
      }
    } catch (err) {
      console.error("Vote error:", err);
    } finally {
      setVotingId(null);
    }
  }

  if (loading || !contest) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-slate-400">Ачаалж байна...</div>
        </div>
      </DashboardLayout>
    );
  }

  const hasSubmitted = contest.submissions.some(s => s.userEmail === session?.email);
  const canSubmit = session?.role === "student" && contest.status === "active" && !hasSubmitted;
  const sortedSubmissions = [...contest.submissions].sort((a, b) => b.votes.length - a.votes.length);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Link href="/contests" className="text-sm text-violet-400 hover:text-violet-300">
          ← Буцах
        </Link>

        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <div>
              <h1 className="text-2xl font-bold mb-2">{contest.title}</h1>
              <p className="text-slate-400 mb-4">{contest.description}</p>

            <div className="flex items-center gap-4 mb-4">
              {contest.status === "active" && (
                <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/40 text-sm">
                  Идэвхтэй
                </span>
              )}
              {contest.status === "upcoming" && (
                <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/40 text-sm">
                  Удахгүй
                </span>
              )}
              {contest.status === "ended" && (
                <span className="px-3 py-1 rounded-full bg-slate-500/20 text-slate-400 border border-slate-500/40 text-sm">
                  Дууссан
                </span>
              )}
          </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-slate-500 mb-1">Эхлэх огноо</div>
              <div className="font-medium">{new Date(contest.startDate).toLocaleDateString("mn-MN")}</div>
            </div>
              <div>
                <div className="text-slate-500 mb-1">Дуусах огноо</div>
              <div className="font-medium">{new Date(contest.endDate).toLocaleDateString("mn-MN")}</div>
            </div>
              <div>
                <div className="text-slate-500 mb-1">Оролцогч</div>
              <div className="font-medium">{contest.participants.length}</div>
            </div>
              <div>
                <div className="text-slate-500 mb-1">Шагнал</div>
              <div className="font-medium text-violet-400">{contest.prize} XP</div>
              </div>
            </div>
            </div>
          </div>

          {canSubmit && (
          <div className="glass-panel p-6 rounded-2xl space-y-4">
            <h2 className="text-xl font-semibold text-slate-200">Бүтээл илгээх</h2>
            {!showSubmitForm ? (
              <button
                onClick={() => setShowSubmitForm(true)}
                className="px-6 py-3 rounded-full bg-gradient-to-r from-violet-500 to-purple-500 text-white font-medium hover:shadow-lg transition-all"
              >
                + Бүтээл илгээх
              </button>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Файл</label>
                    <input
                      type="file"
                      accept="image/*"
                    onChange={handleFileUpload}
                    disabled={uploadingFile}
                    className="w-full px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-100"
                    />
                  {uploadingFile && <p className="text-xs text-slate-400 mt-1">Upload хийж байна...</p>}
                  {filePreview && (
                    <div className="mt-4 relative">
                      <img src={filePreview} alt="Preview" className="max-w-full max-h-64 rounded-lg" />
                      <button
                        onClick={() => {
                          setFilePreview(null);
                          setFileUrl("");
                        }}
                        className="absolute top-2 right-2 px-2 py-1 rounded bg-slate-900/80 text-white text-xs"
                      >
                        Устгах
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Тайлбар (сонголттой)</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-100"
                    placeholder="Бүтээлийн тайлбар..."
                  />
              </div>
                {submitError && <p className="text-sm text-red-400">{submitError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || !fileUrl}
                    className="px-6 py-2 rounded-full bg-gradient-to-r from-violet-500 to-purple-500 text-white font-medium hover:shadow-lg transition-all disabled:opacity-50"
                  >
                    {submitting ? "Илгээж байна..." : "Илгээх"}
                  </button>
                <button
                  onClick={() => {
                    setShowSubmitForm(false);
                      setFileUrl("");
                    setDescription("");
                      setFilePreview(null);
                      setSubmitError(null);
                  }}
                    className="px-6 py-2 rounded-full bg-slate-700/50 text-slate-300 hover:bg-slate-700 transition-all"
                >
                    Цуцлах
                </button>
                </div>
              </div>
            )}
          </div>
        )}

        {hasSubmitted && contest.status === "active" && (
          <div className="glass-panel p-4 rounded-2xl bg-green-500/10 border border-green-500/30">
            <p className="text-green-400 text-sm">✅ Та аль хэдийн бүтээл илгээсэн байна.</p>
          </div>
        )}

        {contest.status === "ended" && contest.submissions.length > 0 && (
          <div className="glass-panel p-6 rounded-2xl bg-yellow-500/10 border border-yellow-500/30">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🏆</span>
        <div>
                <div className="font-semibold text-yellow-400">
                  Ялагч: {sortedSubmissions[0].userName}
                </div>
                <div className="text-sm text-yellow-300/80">
                  +{contest.prize} XP
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="glass-panel p-6 rounded-2xl">
          <h2 className="text-xl font-semibold text-slate-200 mb-4">
            Оролцогчдын бүтээлүүд ({contest.submissions.length})
          </h2>
          {contest.submissions.length === 0 ? (
            <p className="text-slate-400 text-center py-8">Одоогоор бүтээл байхгүй байна.</p>
          ) : (
            <div className="grid gap-6">
              {sortedSubmissions.map((submission, index) => {
                const isWinner = contest.status === "ended" && index === 0;
                const isOwnSubmission = submission.userEmail === session?.email;
                const hasVoted = session && submission.votes.includes(session.email);

                return (
                  <div
                    key={submission.id}
                    className={`p-4 rounded-xl border ${
                      isWinner
                        ? "bg-yellow-500/10 border-yellow-500/40"
                        : "bg-slate-800/30 border-slate-700/50"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-slate-200">{submission.userName}</span>
                    {isWinner && (
                            <span className="px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-xs border border-yellow-500/40">
                              🏆 Ялагч! +{contest.prize} XP
                            </span>
                          )}
                          {isOwnSubmission && (
                            <span className="px-2 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs border border-blue-500/40">
                              Таны бүтээл
                            </span>
                          )}
                        </div>
                        {submission.description && (
                          <p className="text-sm text-slate-400 mt-1">{submission.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-400">👍 {submission.votes.length}</span>
                        {contest.status === "active" && session && !isOwnSubmission && (
                          <button
                            onClick={() => handleVote(submission.id)}
                            disabled={votingId === submission.id}
                            className={`px-3 py-1 rounded-full text-xs transition-all ${
                              hasVoted
                                ? "bg-violet-500 text-white"
                                : "bg-slate-700/50 text-slate-300 hover:bg-slate-700"
                            }`}
                          >
                            {hasVoted ? "✓ Санал өгсөн" : "Санал өгөх"}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="mt-3">
                      <img 
                        src={submission.fileUrl}
                        alt={`${submission.userName}-н бүтээл`}
                        className="w-full rounded-lg max-h-96 object-contain bg-slate-900/50"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
