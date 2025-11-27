"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { NeonLayout } from "../../../components/layout/NeonLayout";
import { useSession } from "../../../components/auth/useSession";
import Link from "next/link";

type ContestSubmission = {
  id: string;
  userEmail: string;
  userName: string;
  title: string;
  description: string;
  imageUrl?: string;
  submittedAt: string;
  votes: string[];
};

type Contest = {
  id: string;
  title: string;
  description: string;
  authorEmail?: string;
  authorName: string;
  startDate: string;
  endDate: string;
  prize: number;
  participants: string[];
  submissions: ContestSubmission[];
  status: "upcoming" | "active" | "ended";
};

export default function ContestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { session } = useSession();
  const [contest, setContest] = useState<Contest | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  
  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    if (!file.type.startsWith("image/")) {
      setError("Зураг файл сонгоно уу");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Зургийн хэмжээ 5MB-аас бага байх ёстой");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setImagePreview(result);
      setImageUrl(result);
    };
    reader.onerror = () => {
      setError("Зураг уншихад алдаа гарлаа");
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch(`/api/contests/${params.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, imageUrl }),
      });

      if (!res.ok) {
        const json = await res.json();
        setError(json.error || "Алдаа гарлаа");
        return;
      }

      await fetchContest();
      setTitle("");
      setDescription("");
      setImageUrl("");
      setImagePreview(null);
      setShowSubmitForm(false);
      alert("Амжилттай оролцлоо! +20 XP авлаа");
    } catch (err: any) {
      setError(err.message || "Сүлжээний алдаа гарлаа");
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

      if (!res.ok) {
        const json = await res.json();
        alert(json.error || "Алдаа гарлаа");
        return;
      }

      const json = await res.json();
      setContest(json.contest);
    } catch (err: any) {
      alert(err.message || "Сүлжээний алдаа гарлаа");
    } finally {
      setVotingId(null);
    }
  }

  if (loading) {
    return (
      <NeonLayout>
        <div className="text-center py-8">
          <p className="text-slate-400">Loading...</p>
        </div>
      </NeonLayout>
    );
  }

  if (!contest) {
    return null;
  }

  const hasSubmitted = contest.submissions.some(s => s.userEmail === session?.email);
  const canSubmit = session?.role === "student" && contest.status === "active" && !hasSubmitted;
  const sortedSubmissions = [...contest.submissions].sort((a, b) => b.votes.length - a.votes.length);

  return (
    <NeonLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <Link href="/contests" className="text-sm text-violet-400 hover:text-violet-300">
          ← Буцах
        </Link>

        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl px-6 py-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1">
              <h1 className="text-2xl font-bold mb-2">{contest.title}</h1>
              <p className="text-slate-400 mb-4">{contest.description}</p>
            </div>
            <div>
              {contest.status === "active" && (
                <span className="px-3 py-1.5 rounded-full text-sm bg-green-500/20 text-green-400 border border-green-500/50">🟢 Идэвхтэй</span>
              )}
              {contest.status === "upcoming" && (
                <span className="px-3 py-1.5 rounded-full text-sm bg-blue-500/20 text-blue-400 border border-blue-500/50">🔵 Удахгүй</span>
              )}
              {contest.status === "ended" && (
                <span className="px-3 py-1.5 rounded-full text-sm bg-slate-500/20 text-slate-400 border border-slate-500/50">⚫ Дууссан</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div className="bg-slate-950/60 rounded-lg px-4 py-3">
              <div className="text-slate-500 text-xs mb-1">Эхлэх</div>
              <div className="font-medium">{new Date(contest.startDate).toLocaleDateString("mn-MN")}</div>
            </div>
            <div className="bg-slate-950/60 rounded-lg px-4 py-3">
              <div className="text-slate-500 text-xs mb-1">Дуусах</div>
              <div className="font-medium">{new Date(contest.endDate).toLocaleDateString("mn-MN")}</div>
            </div>
            <div className="bg-slate-950/60 rounded-lg px-4 py-3">
              <div className="text-slate-500 text-xs mb-1">Оролцогчид</div>
              <div className="font-medium">{contest.participants.length}</div>
            </div>
            <div className="bg-slate-950/60 rounded-lg px-4 py-3">
              <div className="text-slate-500 text-xs mb-1">Шагнал</div>
              <div className="font-medium text-violet-400">{contest.prize} XP</div>
            </div>
          </div>

          {canSubmit && (
            <div className="mt-4">
              <button
                onClick={() => setShowSubmitForm(true)}
                className="w-full py-3 rounded-lg bg-gradient-to-r from-violet-500 to-purple-500 text-white font-medium hover:shadow-lg transition-shadow"
              >
                Оролцох (+20 XP)
              </button>
            </div>
          )}

          {hasSubmitted && contest.status === "active" && (
            <div className="mt-4 bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3 text-sm text-green-400">
              ✓ Та оролцсон байна
            </div>
          )}

          {contest.status === "ended" && contest.submissions.length > 0 && (
            <div className="mt-4 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-2 border-yellow-500/50 rounded-xl px-6 py-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-4xl">🏆</span>
                <div>
                  <h3 className="text-lg font-bold text-yellow-400">Тэмцээн дууссан - Ялагч тодорлоо!</h3>
                  <p className="text-xs text-yellow-300/80">Хамгийн их санал авсан</p>
                </div>
              </div>
              {sortedSubmissions[0] && (
                <div className="bg-slate-950/60 rounded-lg px-4 py-3 border border-yellow-500/30">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-2xl font-bold text-white shadow-lg">
                      1
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-white">{sortedSubmissions[0].userName}</h4>
                      <p className="text-sm text-slate-300">{sortedSubmissions[0].title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded-full">
                          ❤️ {sortedSubmissions[0].votes.length} санал
                        </span>
                        <span className="text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full">
                          +{contest.prize} XP
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {showSubmitForm && canSubmit && (
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl px-6 py-5">
            <h2 className="text-lg font-semibold mb-4">Бүтээлээ илгээх</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Гарчиг</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg bg-slate-950/60 border border-slate-700 px-4 py-2 text-sm focus:outline-none focus:border-violet-500"
                  placeholder="Бүтээлийн гарчиг"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Тайлбар</label>
                <textarea
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg bg-slate-950/60 border border-slate-700 px-4 py-2 text-sm focus:outline-none focus:border-violet-500 resize-none"
                  placeholder="Бүтээлийнхээ тухай бичих..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Зураг <span className="text-violet-400">(Сурагч зураг оруулна)</span>
                </label>
                <div className="space-y-2">
                  <label className="cursor-pointer flex items-center justify-center gap-2 w-full px-4 py-8 rounded-lg border-2 border-dashed border-slate-700 hover:border-violet-500 text-sm transition-colors bg-slate-950/40">
                    <span className="text-3xl">�️</span>
                    <div className="text-center">
                      <p className="font-medium text-slate-300">Зураг нэмэх</p>
                      <p className="text-xs text-slate-500 mt-1">PNG, JPG, GIF (5MB хүртэл)</p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                  {imagePreview && (
                    <div className="mt-3 relative inline-block">
                      <img 
                        src={imagePreview} 
                        alt="Preview" 
                        className="max-w-full h-auto rounded-xl max-h-64 object-cover border border-slate-700"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setImagePreview(null);
                          setImageUrl("");
                        }}
                        className="absolute top-2 right-2 bg-slate-900/90 hover:bg-slate-800 text-white rounded-full w-7 h-7 flex items-center justify-center text-lg font-bold"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowSubmitForm(false);
                    setTitle("");
                    setDescription("");
                    setImageUrl("");
                    setImagePreview(null);
                    setError(null);
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-700 text-sm hover:bg-slate-800 transition-colors"
                >
                  Болих
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 rounded-lg bg-gradient-to-r from-violet-500 to-purple-500 text-white text-sm font-medium disabled:opacity-60"
                >
                  {submitting ? "Илгээж байна..." : "Илгээх"}
                </button>
              </div>
            </form>
          </div>
        )}

        <div>
          <h2 className="text-xl font-semibold mb-4">
            Оролцогчдын бүтээлүүд ({contest.submissions.length})
          </h2>
          {contest.submissions.length === 0 ? (
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl px-6 py-8 text-center">
              <p className="text-slate-400">Одоогоор оролцогч байхгүй байна</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedSubmissions.map((submission, index) => {
                const isWinner = contest.status === "ended" && index === 0;
                const hasVoted = submission.votes.includes(session?.email || "");
                const isOwnSubmission = submission.userEmail === session?.email;

                return (
                  <div
                    key={submission.id}
                    className={`bg-slate-900/40 border rounded-2xl px-6 py-5 ${
                      isWinner ? "border-yellow-500/50 bg-yellow-500/5" : "border-slate-800"
                    }`}
                  >
                    {isWinner && (
                      <div className="flex items-center gap-2 mb-3 text-yellow-400">
                        <span className="text-2xl">🏆</span>
                        <span className="font-bold">Ялагч! +{contest.prize} XP</span>
                      </div>
                    )}
                    
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg mb-1">{submission.title}</h3>
                        <p className="text-sm text-slate-400 mb-2">{submission.description}</p>
                        <div className="text-xs text-slate-500">
                          👤 {submission.userName} • {new Date(submission.submittedAt).toLocaleDateString("mn-MN")}
                        </div>
                      </div>
                    </div>

                    {submission.imageUrl && (
                      <img 
                        src={submission.imageUrl} 
                        alt={submission.title}
                        className="w-full rounded-xl object-cover max-h-96 mb-3"
                      />
                    )}

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleVote(submission.id)}
                        disabled={!session || contest.status !== "active" || isOwnSubmission || votingId === submission.id}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          hasVoted
                            ? "bg-violet-500/20 text-violet-300 border border-violet-500/50"
                            : "bg-slate-800/50 text-slate-400 border border-slate-700 hover:bg-slate-700/50"
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        <span>{hasVoted ? "❤️" : "🤍"}</span>
                        <span>{submission.votes.length}</span>
                      </button>
                      {isOwnSubmission && (
                        <span className="text-xs text-emerald-400">Таны бүтээл</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </NeonLayout>
  );
}
