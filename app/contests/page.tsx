"use client";

import { useState, useEffect } from "react";
import { useSession } from "../../components/auth/useSession";
import { NeonLayout } from "../../components/layout/NeonLayout";
import Link from "next/link";

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
  submissions: any[];
  status: "upcoming" | "active" | "ended";
  createdAt: string;
};

export default function ContestsPage() {
  const { session } = useSession();
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [prize, setPrize] = useState(100);
  const [targetGrades, setTargetGrades] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchContests();
  }, []);

  async function fetchContests() {
    try {
      const res = await fetch("/api/contests");
      if (res.ok) {
        const json = await res.json();
        setContests(json.contests || []);
      }
    } catch (err) {
      console.error("Failed to fetch contests:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveContest(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !startDate || !endDate) {
      alert("Бүх талбарыг бөглөнө үү");
      return;
    }

    setCreating(true);
    try {
      const endpoint = editingId ? `/api/contests/${editingId}` : "/api/contests";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          startDate,
          endDate,
          prize,
          targetGrades,
        }),
      });

      const json = await res.json();
      if (json.ok) {
      if (editingId) {
        setContests(contests.map(c => c.id === editingId ? json.contest : c));
      } else {
        setContests([json.contest, ...contests]);
      }
        resetForm();
      } else {
        alert(json.error || "Алдаа гарлаа");
      }
    } catch (err) {
      console.error("Failed to save contest:", err);
      alert("Алдаа гарлаа");
    } finally {
      setCreating(false);
    }
  }

  function resetForm() {
    setTitle("");
    setDescription("");
    setStartDate("");
    setEndDate("");
    setPrize(100);
    setTargetGrades([]);
    setEditingId(null);
    setShowCreateForm(false);
  }

  function startEdit(contest: Contest) {
    setEditingId(contest.id);
    setTitle(contest.title);
    setDescription(contest.description);
    setStartDate(contest.startDate.slice(0, 16));
    setEndDate(contest.endDate.slice(0, 16));
    setPrize(contest.prize);
    setTargetGrades(contest.targetGrades || []);
    setShowCreateForm(true);
  }

  async function handleDelete(id: string) {
    if (!confirm("Устгахдаа итгэлтэй байна уу?")) return;
    try {
      const res = await fetch(`/api/contests/${id}`, { method: "DELETE" });
        const json = await res.json();
      if (json.ok) {
      setContests(contests.filter(c => c.id !== id));
      } else {
        alert(json.error || "Устгах боломжгүй");
      }
    } catch (err) {
      console.error("Failed to delete contest:", err);
      alert("Алдаа гарлаа");
    }
  }

  function toggleGrade(grade: string) {
    setTargetGrades(prev => 
      prev.includes(grade) 
        ? prev.filter(g => g !== grade)
        : [...prev, grade]
    );
  }

  function getStatusBadge(status: string) {
    const styles = {
      active: "bg-green-500/20 text-green-400 border-green-500/40",
      upcoming: "bg-blue-500/20 text-blue-400 border-blue-500/40",
      ended: "bg-slate-500/20 text-slate-400 border-slate-500/40",
    };
    const labels = {
      active: "Идэвхтэй",
      upcoming: "Удахгүй",
      ended: "Дууссан",
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs border ${styles[status as keyof typeof styles] || styles.ended}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    );
  }

  if (loading) {
    return (
      <NeonLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-slate-400">Ачаалж байна...</div>
        </div>
      </NeonLayout>
    );
  }

  const activeContests = contests.filter(c => c.status === "active");
  const upcomingContests = contests.filter(c => c.status === "upcoming");
  const endedContests = contests.filter(c => c.status === "ended");

  return (
    <NeonLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-300 via-purple-300 to-pink-300 bg-clip-text text-transparent">
            Уралдаан
          </h1>
          {session?.role === "teacher" && (
            <button
              onClick={() => {
                resetForm();
                setShowCreateForm(!showCreateForm);
              }}
              className="px-4 py-2 rounded-full bg-gradient-to-r from-violet-500 to-purple-500 text-white font-medium hover:shadow-lg transition-all"
            >
              {showCreateForm ? "✕ Цуцлах" : "+ Шинэ уралдаан"}
            </button>
          )}
        </div>

        {showCreateForm && session?.role === "teacher" && (
          <div className="glass-panel p-6 rounded-2xl space-y-4">
            <h2 className="text-xl font-semibold text-slate-200">
              {editingId ? "Уралдаан засах" : "Шинэ уралдаан үүсгэх"}
            </h2>
            <form onSubmit={handleSaveContest} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Гарчиг</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Тайлбар</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Эхлэх огноо</label>
                  <input
                    type="datetime-local"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Дуусах огноо</label>
                  <input
                    type="datetime-local"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Шагнал (XP)</label>
                <input
                  type="number"
                  value={prize}
                  onChange={(e) => setPrize(Number(e.target.value))}
                  min="0"
                  className="w-full px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Зорилтот анги (хоосон = бүх анги)</label>
                <div className="flex gap-2">
                  {["10", "11", "12"].map(grade => (
                    <button
                      key={grade}
                      type="button"
                      onClick={() => toggleGrade(grade)}
                      className={`px-3 py-1 rounded-full text-sm transition-all ${
                        targetGrades.includes(grade)
                          ? "bg-violet-500 text-white"
                          : "bg-slate-700/50 text-slate-300 hover:bg-slate-700"
                      }`}
                    >
                      {grade}р анги
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={creating}
                  className="px-6 py-2 rounded-full bg-gradient-to-r from-violet-500 to-purple-500 text-white font-medium hover:shadow-lg transition-all disabled:opacity-50"
                >
                  {creating ? "Хадгалж байна..." : editingId ? "Хадгалах" : "Үүсгэх"}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-2 rounded-full bg-slate-700/50 text-slate-300 hover:bg-slate-700 transition-all"
                >
                  Цуцлах
                </button>
              </div>
            </form>
          </div>
        )}

        {contests.length === 0 ? (
          <div className="glass-panel p-12 rounded-2xl text-center">
            <p className="text-slate-400">Одоогоор уралдаан байхгүй байна.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {activeContests.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-slate-200 mb-4">Идэвхтэй уралдаан</h2>
                <div className="grid gap-4">
                  {activeContests.map((contest) => {
                    const isAuthor = session?.role === "teacher" && session.email === contest.authorEmail;
                    return (
                      <Link
                        key={contest.id}
                        href={`/contests/${contest.id}`}
                        className="glass-panel p-6 rounded-2xl hover:border-violet-500/50 transition-all block"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-slate-200 mb-1">{contest.title}</h3>
                            <p className="text-sm text-slate-400 mb-2">{contest.description}</p>
                            <div className="flex items-center gap-4 mb-3">
                            {getStatusBadge(contest.status)}
                            {isAuthor && (
                              <div className="flex gap-2">
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    startEdit(contest);
                                  }}
                                    className="px-3 py-1 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-xs"
                                >
                                  Засах
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleDelete(contest.id);
                                  }}
                                    className="px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs"
                                >
                                  Устгах
                                </button>
                              </div>
                            )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <span>👤 {contest.authorName}</span>
                          <span>🎯 {contest.participants.length} оролцогч</span>
                          <span>🏆 {contest.prize} XP</span>
                          <span>📅 {new Date(contest.endDate).toLocaleDateString("mn-MN")}-н дуустай</span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {upcomingContests.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-slate-200 mb-4">Удахгүй эхлэх уралдаан</h2>
                <div className="grid gap-4">
                  {upcomingContests.map((contest) => {
                    const isAuthor = session?.role === "teacher" && session.email === contest.authorEmail;
                    return (
                      <Link
                        key={contest.id}
                        href={`/contests/${contest.id}`}
                        className="glass-panel p-6 rounded-2xl hover:border-violet-500/50 transition-all block"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-slate-200 mb-1">{contest.title}</h3>
                            <p className="text-sm text-slate-400 mb-2">{contest.description}</p>
                            <div className="flex items-center gap-4 mb-3">
                            {getStatusBadge(contest.status)}
                            {isAuthor && (
                              <div className="flex gap-2">
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    startEdit(contest);
                                  }}
                                    className="px-3 py-1 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-xs"
                                >
                                  Засах
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleDelete(contest.id);
                                  }}
                                    className="px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs"
                                >
                                  Устгах
                                </button>
                              </div>
                            )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <span>👤 {contest.authorName}</span>
                          <span>🏆 {contest.prize} XP</span>
                          <span>📅 {new Date(contest.startDate).toLocaleDateString("mn-MN")}-с эхэлнэ</span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {endedContests.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-slate-200 mb-4">Дууссан уралдаан</h2>
                <div className="grid gap-4">
                  {endedContests.map((contest) => {
                    const winner = contest.submissions.length > 0 
                      ? contest.submissions.sort((a, b) => b.votes.length - a.votes.length)[0]
                      : null;
                    const isAuthor = session?.role === "teacher" && session.email === contest.authorEmail;
                    return (
                      <Link
                        key={contest.id}
                        href={`/contests/${contest.id}`}
                        className="glass-panel p-6 rounded-2xl hover:border-violet-500/50 transition-all block"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-slate-200 mb-1">{contest.title}</h3>
                            <p className="text-sm text-slate-400 mb-2">{contest.description}</p>
                            {winner && (
                              <div className="mb-2 px-3 py-1 rounded-lg bg-yellow-500/20 text-yellow-400 text-xs inline-block">
                                🏆 Ялагч: {winner.userName}
                              </div>
                            )}
                            <div className="flex items-center gap-4 mb-3">
                            {getStatusBadge(contest.status)}
                            {isAuthor && (
                              <div className="flex gap-2">
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    startEdit(contest);
                                  }}
                                    className="px-3 py-1 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-xs"
                                >
                                  Засах
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleDelete(contest.id);
                                  }}
                                    className="px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs"
                                >
                                  Устгах
                                </button>
                              </div>
                            )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <span>👤 {contest.authorName}</span>
                          <span>🎯 {contest.participants.length} оролцогч</span>
                          <span>🏆 {contest.prize} XP</span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </NeonLayout>
  );
}
