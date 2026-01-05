"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "../auth/useSession";
import Medal3D from "./Medal3D";
import { cachedFetch } from "../../lib/fetchCache";

type LeaderboardUser = {
  email: string;
  name?: string;
  nickname?: string;
  avatarUrl?: string;
  avatarColor?: string;
  role: "student" | "teacher";
  grade?: string; // Student grade
  experience: number;
};

export function LeaderboardSidebar({ compact = false }: { compact?: boolean }) {
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const { session } = useSession();
  const router = useRouter();

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        const res = await cachedFetch("/api/leaderboard");
        const json = await res.json();
        const data = json.leaderboard || [];
        setUsers(compact ? data.slice(0, 5) : data);
      } catch (err) {
        console.error("Failed to fetch leaderboard:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchLeaderboard();
  }, [compact]);

  if (loading) {
    return (
      <div className="bg-dark-900 border border-white/5 rounded-3xl px-5 py-5">
        <h2 className="text-base font-bold bg-gradient-to-r from-violet-300 to-purple-300 bg-clip-text text-transparent mb-4">
          {compact ? "🏆 Top Students" : "🏆 Leaderboard"}
        </h2>
        <div className="space-y-2.5">
          {[...Array(compact ? 5 : 10)].map((_, i) => (
            <div key={i} className="bg-dark-800 border border-white/5 px-3 py-3 rounded-xl animate-pulse">
              <div className="h-8 bg-dark-700 rounded-lg"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="bg-dark-900 border border-white/5 rounded-3xl px-5 py-5">
        <h2 className="text-base font-bold bg-gradient-to-r from-violet-300 to-purple-300 bg-clip-text text-transparent mb-4">
          {compact ? "🏆 Top Students" : "🏆 Leaderboard"}
        </h2>
        <div className="text-center py-8">
          <div className="text-4xl mb-3 opacity-50">🎯</div>
          <p className="text-sm text-slate-400">Одоогоор хэрэглэгч байхгүй байна</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-dark-900 border border-white/5 rounded-3xl px-5 py-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold bg-gradient-to-r from-violet-300 to-purple-300 bg-clip-text text-transparent">
          {compact ? "🏆 Top Students" : "🏆 Leaderboard"}
        </h2>
        {compact && (
          <span className="text-[10px] text-violet-400 font-semibold uppercase tracking-wider">Live</span>
        )}
      </div>
      <ul className="space-y-2.5 text-xs">
        {users.map((u, idx) => {
          const isTop3 = idx < 3;
          const medals = ["🥇", "🥈", "🥉"];
          const isMe = session?.email === u.email;
          const topFrames = [
            {
              container: "relative overflow-hidden border-2 border-amber-400/70 bg-gradient-to-br from-amber-500/15 via-amber-300/5 to-amber-500/25 shadow-[0_15px_50px_rgba(251,191,36,0.35)]",
              badge: "bg-amber-500/20 text-amber-100",
              glow: "bg-amber-400/30",
              rankBg: "bg-gradient-to-br from-amber-400 via-yellow-300 to-amber-500",
              xp: "bg-gradient-to-r from-amber-200 to-yellow-200 bg-clip-text text-transparent",
              avatarRing: "ring-2 ring-amber-300 shadow-[0_0_25px_rgba(251,191,36,0.45)]"
            },
            {
              container: "relative overflow-hidden border-2 border-slate-200/70 bg-gradient-to-br from-slate-200/20 via-slate-50/5 to-slate-200/30 shadow-[0_15px_50px_rgba(148,163,184,0.35)]",
              badge: "bg-slate-200/20 text-slate-100",
              glow: "bg-slate-200/25",
              rankBg: "bg-gradient-to-br from-slate-100 via-slate-300 to-slate-500",
              xp: "bg-gradient-to-r from-slate-100 to-slate-200 bg-clip-text text-transparent",
              avatarRing: "ring-2 ring-slate-200 shadow-[0_0_25px_rgba(148,163,184,0.35)]"
            },
            {
              container: "relative overflow-hidden border-2 border-orange-300/70 bg-gradient-to-br from-orange-400/15 via-orange-200/5 to-orange-500/25 shadow-[0_15px_50px_rgba(249,115,22,0.35)]",
              badge: "bg-orange-400/20 text-orange-100",
              glow: "bg-orange-300/30",
              rankBg: "bg-gradient-to-br from-orange-300 via-orange-400 to-amber-500",
              xp: "bg-gradient-to-r from-orange-200 to-amber-200 bg-clip-text text-transparent",
              avatarRing: "ring-2 ring-orange-300 shadow-[0_0_25px_rgba(249,115,22,0.35)]"
            },
          ];
          const frame = isTop3 ? topFrames[idx] : null;

          return (
            <li
              key={u.email}
              className={`flex items-center justify-between gap-3 px-3 py-3 rounded-xl transition-all duration-300 ${
                frame
                  ? `${frame.container}`
                  : `bg-dark-800 border border-white/5 hover:border-white/10 ${isMe ? 'border-primary-500/50 shadow-[0_0_18px_rgba(139,92,246,0.3)]' : ''}`
              }`}
            >
              {frame && (
                <>
                  <div className={`absolute inset-0 blur-2xl opacity-60 ${frame.glow}`} aria-hidden="true"></div>
                  <div className="absolute inset-0 border border-white/5 rounded-xl pointer-events-none"></div>
                </>
              )}
              <div className="flex items-center gap-3 flex-1 min-w-0 relative z-10">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-lg ${
                  frame ? "text-slate-900" : "bg-gradient-to-br from-slate-700 to-slate-800 text-slate-300"
                } ${frame ? frame.rankBg : ""}`}>
                  {isTop3 ? (idx === 0 ? <Medal3D /> : medals[idx]) : idx + 1}
                </div>
                {(u.avatarUrl || u.avatarColor) ? (
                  <button
                    type="button"
                    title={`${(u.nickname || u.name || u.email)}-н profile харах`}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/profile?user=${encodeURIComponent(u.email)}`); }}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-violet-400/50 ${frame ? frame.avatarRing : ''}`}
                    style={{ backgroundColor: u.avatarColor || '#1e293b' }}
                  >
                    {u.avatarUrl ? (
                      <img src={u.avatarUrl} alt={u.name || u.email} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white">{(u.nickname || u.name || u.email)[0]?.toUpperCase()}</span>
                    )}
                  </button>
                ) : null}
                <div className="flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/profile?user=${encodeURIComponent(u.email)}`); }}
                    className={`font-semibold truncate text-left transition-colors ${frame ? 'text-white drop-shadow' : 'text-slate-200 hover:text-violet-300'}`}
                    title={`${(u.nickname || u.name || u.email)}-н profile харах`}
                  >
                    {u.nickname || u.name || u.email.split('@')[0]} {isMe && <span className="ml-1 text-[10px] text-violet-300">(You)</span>}
                  </button>
                  <div className={`text-[10px] ${frame ? 'text-white/80' : 'text-slate-500'}`}>
                    {u.experience >= 1000 ? "⭐ Expert" : u.experience >= 500 ? "💎 Advanced" : u.experience >= 100 ? "🎯 Intermediate" : "🌱 Beginner"}
                  </div>
                </div>
              </div>
              <div className={`text-sm font-bold relative z-10 ${
                frame
                  ? frame.xp
                  : "text-slate-400"
              }`}>
                {Math.round(u.experience)}
                <span className="text-[10px] ml-0.5">XP</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function LeaderboardFull() {
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [rankFilter, setRankFilter] = useState<string>("all");
  const [gradeFilter, setGradeFilter] = useState<string>("all"); // New grade filter
  const { session } = useSession();
  const router = useRouter();

  useEffect(() => {
    async function fetchLeaderboard(grade?: string) {
      try {
        setLoading(true);
        const url = grade && grade !== 'all' ? `/api/leaderboard?grade=${grade}` : "/api/leaderboard";
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          setUsers(json.leaderboard || []);
          setFilteredUsers(json.leaderboard || []);
        }
      } catch (err) {
        console.error("Failed to fetch leaderboard:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchLeaderboard(gradeFilter);
  }, [gradeFilter]);

  useEffect(() => {
    let filtered = [...users];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(u => 
        (u.nickname || u.name || u.email).toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query)
      );
    }

    // Filter by rank
    if (rankFilter !== "all") {
      filtered = filtered.filter(u => {
        const rank = u.experience >= 1000 ? "expert" :
                     u.experience >= 500 ? "advanced" :
                     u.experience >= 100 ? "intermediate" : "beginner";
        return rank === rankFilter;
      });
    }

    // Filter by grade
    if (gradeFilter !== "all") {
      filtered = filtered.filter(u => {
        // Only show users who have explicitly set their grade to the selected value
        return u.grade !== null && u.grade !== undefined && u.grade === gradeFilter;
      });
    }

    setFilteredUsers(filtered);
  }, [searchQuery, rankFilter, gradeFilter, users]);

  if (loading) {
    return (
      <section className="bg-dark-900 border border-white/5 rounded-2xl px-4 py-4">
        <h2 className="text-sm font-semibold mb-2">Top Students</h2>
        <p className="text-xs text-nc-muted">Loading...</p>
      </section>
    );
  }

  if (users.length === 0) {
    return (
      <section className="bg-dark-900 border border-white/5 rounded-2xl px-4 py-4">
        <h2 className="text-sm font-semibold mb-2">Top Students</h2>
        <p className="text-xs text-nc-muted">No students yet. Start creating posts and getting reactions!</p>
      </section>
    );
  }

  return (
    <section className="bg-nc-panel/90 border border-nc-border rounded-2xl px-4 py-4 shadow-nc-soft">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold">Top Students</h2>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400">{filteredUsers.length} / {users.length}</span>
        </div>
      </div>

      {/* Search and Filter Section */}
      <div className="mb-4 space-y-3">
        {/* Search Bar */}
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M21 21L16.65 16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Нэрээр хайх..."
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-dark-800 border border-white/5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </div>

        {/* Rank Filter */}
        <div className="flex flex-wrap gap-2">
          {[
            { id: "all", label: "Бүгд" },
            { id: "expert", label: "Expert" },
            { id: "advanced", label: "Advanced" },
            { id: "intermediate", label: "Intermediate" },
            { id: "beginner", label: "Beginner" }
          ].map(rank => (
            <button
              key={rank.id}
              onClick={() => setRankFilter(rank.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                rankFilter === rank.id
                  ? "bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-[0_4px_12px_rgba(139,92,246,0.4)]"
                  : "bg-dark-800 border border-white/5 text-slate-300 hover:border-primary-500/40 hover:text-slate-100"
              }`}
            >
              {rank.label}
            </button>
          ))}
        </div>

        {/* Grade Filter */}
        <div>
          <label className="block text-xs text-slate-400 mb-2 font-medium">🎒 Анги</label>
          <div className="flex flex-wrap gap-2">
            {[
              { id: "all", label: "Бүгд" },
              { id: "10", label: "10 анги" },
              { id: "11", label: "11 анги" },
              { id: "12", label: "12 анги" }
            ].map(grade => (
              <button
                key={grade.id}
                onClick={() => setGradeFilter(grade.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  gradeFilter === grade.id
                    ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-[0_4px_12px_rgba(34,197,94,0.4)]"
                    : "bg-dark-800 border border-white/5 text-slate-300 hover:border-green-500/40 hover:text-slate-100"
                }`}
              >
                {grade.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filteredUsers.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-4xl mb-3 opacity-50">🔍</div>
          <p className="text-sm text-slate-400">
            {searchQuery || rankFilter !== "all" 
              ? "Хайлтын үр дүн олдсонгүй" 
              : "Одоогоор хэрэглэгч байхгүй байна"}
          </p>
        </div>
      ) : (
        <div className="mt-3 space-y-1 text-xs">
        <div className="grid grid-cols-[40px,1fr,110px,120px] gap-3 px-2 py-2 rounded-xl bg-black/40 border border-nc-accent/30 text-slate-200">
          <span>#</span>
          <span>Student</span>
          <span>Rank</span>
          <span>Experience</span>
        </div>
        {filteredUsers.map((u, idx) => {
          const rankTitle = 
            u.experience >= 1000 ? "Expert" :
            u.experience >= 500 ? "Advanced" :
            u.experience >= 100 ? "Intermediate" : "Beginner";
          const isMe = session?.email === u.email;
          const topFrames = [
            {
              container: "relative overflow-hidden border-2 border-amber-400/70 bg-gradient-to-br from-amber-500/12 via-amber-300/6 to-amber-500/18 shadow-[0_15px_50px_rgba(251,191,36,0.25)]",
              glow: "bg-amber-400/25",
              rankBg: "bg-gradient-to-br from-amber-400 via-yellow-300 to-amber-500 text-slate-900",
              avatarRing: "ring-2 ring-amber-300 shadow-[0_0_25px_rgba(251,191,36,0.35)]",
              xp: "bg-gradient-to-r from-amber-200 to-yellow-200 bg-clip-text text-transparent"
            },
            {
              container: "relative overflow-hidden border-2 border-slate-200/70 bg-gradient-to-br from-slate-200/18 via-slate-100/8 to-slate-200/20 shadow-[0_15px_50px_rgba(148,163,184,0.25)]",
              glow: "bg-slate-200/20",
              rankBg: "bg-gradient-to-br from-slate-100 via-slate-300 to-slate-500 text-slate-900",
              avatarRing: "ring-2 ring-slate-200 shadow-[0_0_25px_rgba(148,163,184,0.35)]",
              xp: "bg-gradient-to-r from-slate-100 to-slate-200 bg-clip-text text-transparent"
            },
            {
              container: "relative overflow-hidden border-2 border-orange-300/70 bg-gradient-to-br from-orange-400/12 via-orange-200/6 to-orange-500/18 shadow-[0_15px_50px_rgba(249,115,22,0.25)]",
              glow: "bg-orange-300/25",
              rankBg: "bg-gradient-to-br from-orange-300 via-orange-400 to-amber-500 text-slate-900",
              avatarRing: "ring-2 ring-orange-300 shadow-[0_0_25px_rgba(249,115,22,0.35)]",
              xp: "bg-gradient-to-r from-orange-200 to-amber-200 bg-clip-text text-transparent"
            },
          ];
          const isTop3 = idx < 3;
          const frame = isTop3 ? topFrames[idx] : null;
          
          return (
            <div
              key={u.email}
              className={`grid grid-cols-[40px,1fr,110px,120px] gap-3 items-center px-3 py-3 rounded-xl transition-all ${
                frame
                  ? `${frame.container}`
                  : `border bg-dark-800 hover:bg-dark-700 hover:translate-x-0.5 ${isMe ? 'border-primary-500/50 shadow-[0_0_18px_rgba(139,92,246,0.3)]' : 'border-white/5'}`
              }`}
            >
              {frame && (
                <>
                  <div className={`absolute inset-0 blur-2xl opacity-60 ${frame.glow}`} aria-hidden="true"></div>
                  <div className="absolute inset-0 border border-white/5 rounded-xl pointer-events-none"></div>
                </>
              )}
              <div className="flex items-center justify-center">
                <div className={`w-7 h-7 rounded-full text-[11px] flex items-center justify-center font-bold shadow-[0_0_16px_rgba(139,92,246,0.6)] ${
                  frame ? frame.rankBg : 'bg-gradient-to-tr from-nc-accent to-nc-accentB'
                }`}>
                  {isTop3 ? (idx === 0 ? <Medal3D /> : idx + 1) : idx + 1}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {u.avatarUrl ? (
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/profile?user=${encodeURIComponent(u.email)}`); }}
                    title={`${(u.nickname || u.name || u.email)}-н profile харах`}
                    className={`w-9 h-9 rounded-full border shadow-sm overflow-hidden cursor-pointer hover:ring-2 hover:ring-violet-400/50 ${frame ? frame.avatarRing : ''}`}
                    style={{ borderColor: u.avatarColor || '#6366f1' }}
                  >
                    <img 
                      src={u.avatarUrl} 
                      alt={u.nickname || u.name || u.email}
                      className="w-full h-full rounded-full object-cover"
                    />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/profile?user=${encodeURIComponent(u.email)}`); }}
                    title={`${(u.nickname || u.name || u.email)}-н profile харах`}
                    className={`w-9 h-9 rounded-full border flex items-center justify-center text-[11px] font-semibold shadow-sm cursor-pointer hover:ring-2 hover:ring-violet-400/50 ${frame ? frame.avatarRing : ''}`}
                    style={{ 
                      background: `linear-gradient(to top right, ${u.avatarColor || '#6366f1'}, ${u.avatarColor || '#6366f1'}dd)`,
                      borderColor: u.avatarColor || '#6366f1'
                    }}
                  >
                    {(u.nickname || u.name || u.email)[0]?.toUpperCase()}
                  </button>
                )}
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/profile?user=${encodeURIComponent(u.email)}`); }}
                    className="font-medium truncate text-left hover:text-violet-300 transition-colors"
                    title={`${(u.nickname || u.name || u.email)}-н profile харах`}
                  >
                    {u.nickname || u.name || u.email}
                    {isMe && <span className="ml-1 text-[10px] text-violet-300 font-semibold">(You)</span>}
                  </button>
                  <div className="text-[10px] text-nc-muted">XP collector</div>
                </div>
              </div>
              <div className="text-[11px]">
                <span className="inline-flex items-center gap-1 rounded-full border border-white/5 bg-dark-800 px-2 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                  {rankTitle}
                </span>
              </div>
                <div className="text-[11px] flex flex-col items-end gap-1">
                  <span className={`font-semibold ${frame ? frame.xp : 'bg-gradient-to-r from-nc-accentC to-nc-accent bg-clip-text text-transparent'}`}>
                    {Math.round(u.experience)} XP
                  </span>
                  <span className="text-[10px] text-nc-muted">
                    {u.experience >= 1000 ? "🏵️ 🎖️ ✨" : u.experience >= 500 ? "🎖️ ✨" : u.experience >= 100 ? "✨" : "🌱"}
                  </span>
                </div>
              </div>
          );
        })}
        </div>
      )}
    </section>
  );
}
