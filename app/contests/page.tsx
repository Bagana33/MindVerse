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
  startDate: string;
  endDate: string;
  prize: number;
  participants: string[];
  submissions?: Array<{
    id: string;
    userName: string;
    votes: string[];
  }>;
  status: "upcoming" | "active" | "ended";
  createdAt: string;
};

export default function ContestsPage() {
  const { session } = useSession();
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [prize, setPrize] = useState(50);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function handleCreateContest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);

    try {
      const res = await fetch("/api/contests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, startDate, endDate, prize }),
      });

      if (!res.ok) {
        const json = await res.json();
        setError(json.error || "Алдаа гарлаа");
        return;
      }

      const json = await res.json();
      setContests([json.contest, ...contests]);
      setTitle("");
      setDescription("");
      setStartDate("");
      setEndDate("");
      setPrize(50);
      setShowCreateForm(false);
    } catch (err: any) {
      setError(err.message || "Сүлжээний алдаа гарлаа");
    } finally {
      setCreating(false);
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "active":
        return <span className="px-2 py-1 rounded-full text-xs bg-green-500/20 text-green-400 border border-green-500/50">🟢 Идэвхтэй</span>;
      case "upcoming":
        return <span className="px-2 py-1 rounded-full text-xs bg-blue-500/20 text-blue-400 border border-blue-500/50">🔵 Удахгүй</span>;
      case "ended":
        return <span className="px-2 py-1 rounded-full text-xs bg-slate-500/20 text-slate-400 border border-slate-500/50">⚫ Дууссан</span>;
      default:
        return null;
    }
  }

  const activeContests = contests.filter(c => c.status === "active");
  const upcomingContests = contests.filter(c => c.status === "upcoming");
  const endedContests = contests.filter(c => c.status === "ended");

  return (
    <NeonLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Уралдаанууд</h1>
          {session && session.role === "teacher" && !showCreateForm && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-violet-500 to-purple-500 text-white text-sm font-medium shadow-[0_4px_16px_rgba(139,92,246,0.4)] hover:shadow-[0_6px_20px_rgba(139,92,246,0.6)] transition-all"
            >
              + Уралдаан зарлах
            </button>
          )}
        </div>

        {showCreateForm && session && session.role === "teacher" && (
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl px-6 py-5 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
            <h2 className="text-lg font-semibold mb-4">Шинэ уралдаан зарлах</h2>
            <form onSubmit={handleCreateContest} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Гарчиг</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg bg-slate-950/60 border border-slate-700 px-4 py-2 text-sm focus:outline-none focus:border-violet-500"
                  placeholder="Жишээ нь: React Component Challenge"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Тайлбар</label>
                <textarea
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg bg-slate-950/60 border border-slate-700 px-4 py-2 text-sm focus:outline-none focus:border-violet-500 resize-none"
                  placeholder="Уралдааны тайлбар"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Эхлэх огноо</label>
                  <input
                    type="datetime-local"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-lg bg-slate-950/60 border border-slate-700 px-4 py-2 text-sm focus:outline-none focus:border-violet-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Дуусах огноо</label>
                  <input
                    type="datetime-local"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-lg bg-slate-950/60 border border-slate-700 px-4 py-2 text-sm focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Шагнал (XP)</label>
                <input
                  type="number"
                  required
                  min="0"
                  max="1000"
                  value={prize}
                  onChange={(e) => setPrize(parseInt(e.target.value))}
                  className="w-full rounded-lg bg-slate-950/60 border border-slate-700 px-4 py-2 text-sm focus:outline-none focus:border-violet-500"
                />
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setTitle("");
                    setDescription("");
                    setStartDate("");
                    setEndDate("");
                    setPrize(50);
                    setError(null);
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-700 text-sm hover:bg-slate-800 transition-colors"
                >
                  Болих
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-6 py-2 rounded-lg bg-gradient-to-r from-violet-500 to-purple-500 text-white text-sm font-medium disabled:opacity-60"
                >
                  {creating ? "Үүсгэж байна..." : "Уралдаан зарлах"}
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <p className="text-slate-400 text-sm">Loading...</p>
        ) : contests.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl px-6 py-8 text-center">
            <p className="text-slate-400">Одоогоор уралдаан байхгүй байна</p>
          </div>
        ) : (
          <div className="space-y-6">
            {activeContests.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-3">🟢 Идэвхтэй уралдаанууд</h2>
                <div className="grid gap-4">
                  {activeContests.map((contest) => (
                    <Link
                      key={contest.id}
                      href={`/contests/${contest.id}`}
                      className="block bg-slate-900/40 border border-slate-800 rounded-2xl px-6 py-5 hover:border-green-500/50 hover:-translate-y-0.5 transition-all"
                    >
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-slate-200 mb-1">{contest.title}</h3>
                          <p className="text-sm text-slate-400 mb-2">{contest.description}</p>
                        </div>
                        {getStatusBadge(contest.status)}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>👤 {contest.authorName}</span>
                        <span>🎯 {contest.participants.length} оролцогч</span>
                        <span>🏆 {contest.prize} XP</span>
                        <span>📅 {new Date(contest.endDate).toLocaleDateString("mn-MN")}-н дуустай</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {upcomingContests.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-3">🔵 Удахгүй эхлэх</h2>
                <div className="grid gap-4">
                  {upcomingContests.map((contest) => (
                    <Link
                      key={contest.id}
                      href={`/contests/${contest.id}`}
                      className="block bg-slate-900/40 border border-slate-800 rounded-2xl px-6 py-5 hover:border-blue-500/50 hover:-translate-y-0.5 transition-all"
                    >
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-slate-200 mb-1">{contest.title}</h3>
                          <p className="text-sm text-slate-400 mb-2">{contest.description}</p>
                        </div>
                        {getStatusBadge(contest.status)}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>👤 {contest.authorName}</span>
                        <span>🏆 {contest.prize} XP</span>
                        <span>📅 {new Date(contest.startDate).toLocaleDateString("mn-MN")}-с эхэлнэ</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {endedContests.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-3">⚫ Дууссан уралдаанууд</h2>
                <div className="grid gap-4">
                  {endedContests.map((contest) => {
                    const winner = contest.submissions.length > 0 
                      ? contest.submissions.sort((a, b) => b.votes.length - a.votes.length)[0]
                      : null;
                    
                    return (
                      <Link
                        key={contest.id}
                        href={`/contests/${contest.id}`}
                        className="block bg-slate-900/40 border border-slate-800 rounded-2xl px-6 py-5 hover:border-slate-600/50 hover:-translate-y-0.5 transition-all opacity-75"
                      >
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-slate-200 mb-1">{contest.title}</h3>
                            <p className="text-sm text-slate-400 mb-2">{contest.description}</p>
                            {winner && (
                              <div className="mt-2 flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-1.5">
                                <span className="text-lg">🏆</span>
                                <span className="text-xs text-yellow-400 font-medium">
                                  Ялагч: {winner.userName} ({winner.votes.length} санал)
                                </span>
                              </div>
                            )}
                          </div>
                          {getStatusBadge(contest.status)}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <span>👤 {contest.authorName}</span>
                          <span>🎯 {contest.participants.length} оролцогч</span>
                          <span>🏆 {contest.prize} XP</span>
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
