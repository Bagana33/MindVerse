"use client";

import { useState, useEffect } from "react";
import { useSession } from "../auth/useSession";
import Medal3D from "./Medal3D";

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

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        const res = await fetch("/api/leaderboard");
        if (res.ok) {
          const json = await res.json();
          const data = json.leaderboard || [];
          setUsers(compact ? data.slice(0, 5) : data);
        }
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
      <div className="glass-panel rounded-3xl border-slate-700/50 px-5 py-5 shadow-[0_12px_40px_rgba(139,92,246,0.2)]">
        <h2 className="text-base font-bold bg-gradient-to-r from-violet-300 to-purple-300 bg-clip-text text-transparent mb-4">
          {compact ? "🏆 Top Students" : "🏆 Leaderboard"}
        </h2>
        <div className="space-y-2.5">
          {[...Array(compact ? 5 : 10)].map((_, i) => (
            <div key={i} className="glass-panel border-slate-800/50 px-3 py-3 rounded-xl animate-pulse">
              <div className="h-8 bg-slate-800/50 rounded-lg"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="glass-panel rounded-3xl border-slate-700/50 px-5 py-5 shadow-[0_12px_40px_rgba(139,92,246,0.2)]">
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
    <div className="glass-panel rounded-3xl border-slate-700/50 px-5 py-5 shadow-[0_12px_40px_rgba(139,92,246,0.2)]">
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
          
          return (
            <li
              key={u.email}
              className={`flex items-center justify-between gap-3 px-3 py-3 rounded-xl transition-all duration-300 ${
                isTop3 
                  ? "bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/30 shadow-[0_4px_16px_rgba(139,92,246,0.2)]" 
                  : `glass-panel border-slate-800/50 hover:border-slate-700/70 ${isMe ? 'border-violet-500/50 shadow-[0_0_18px_rgba(139,92,246,0.3)]' : ''}`
              }`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-lg ${
                  isTop3 
                    ? "bg-gradient-to-br from-violet-500 to-purple-500 text-white" 
                    : "bg-gradient-to-br from-slate-700 to-slate-800 text-slate-300"
                }`}>
                  {isTop3 ? (idx === 0 ? <Medal3D /> : medals[idx]) : idx + 1}
                </div>
                {(u.avatarUrl || u.avatarColor) ? (
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-lg overflow-hidden"
                    style={{ backgroundColor: u.avatarColor || '#1e293b' }}
                  >
                    {u.avatarUrl ? (
                      <img src={u.avatarUrl} alt={u.name || u.email} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white">{(u.nickname || u.name || u.email)[0]?.toUpperCase()}</span>
                    )}
                  </div>
                ) : null}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate text-slate-200">
                    {u.nickname || u.name || u.email.split('@')[0]} {isMe && <span className="ml-1 text-[10px] text-violet-300">(You)</span>}
                  </div>
                  <div className={`text-[10px] ${isTop3 ? 'text-violet-300' : 'text-slate-500'}`}>
                    {u.experience >= 1000 ? "⭐ Expert" : u.experience >= 500 ? "💎 Advanced" : u.experience >= 100 ? "🎯 Intermediate" : "🌱 Beginner"}
                  </div>
                </div>
              </div>
              <div className={`text-sm font-bold ${
                isTop3 
                  ? "bg-gradient-to-r from-violet-300 to-purple-300 bg-clip-text text-transparent" 
                  : "text-slate-400"
              }`}>
                {u.experience.toLocaleString()}
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

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        const res = await fetch("/api/leaderboard");
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
    fetchLeaderboard();
  }, []);

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
      filtered = filtered.filter(u => u.grade === gradeFilter);
    }

    setFilteredUsers(filtered);
  }, [searchQuery, rankFilter, gradeFilter, users]);

  if (loading) {
    return (
      <section className="bg-nc-panel/90 border border-nc-border rounded-2xl px-4 py-4 shadow-nc-soft">
        <h2 className="text-sm font-semibold mb-2">Top Students</h2>
        <p className="text-xs text-nc-muted">Loading...</p>
      </section>
    );
  }

  if (users.length === 0) {
    return (
      <section className="bg-nc-panel/90 border border-nc-border rounded-2xl px-4 py-4 shadow-nc-soft">
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
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-900/60 border border-slate-700 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
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
                  : "bg-slate-900/60 border border-slate-700 text-slate-300 hover:border-violet-500/40 hover:text-slate-100"
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
                    : "bg-slate-900/60 border border-slate-700 text-slate-300 hover:border-green-500/40 hover:text-slate-100"
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
          
          return (
            <div
              key={u.email}
              className={`grid grid-cols-[40px,1fr,110px,120px] gap-3 items-center px-2 py-2 rounded-xl border bg-white/5 hover:bg-nc-accent/5 hover:translate-x-0.5 transition-all ${isMe ? 'border-violet-500/50 shadow-[0_0_18px_rgba(139,92,246,0.3)]' : 'border-slate-800/80'}`}
            >
              <div className="flex items-center justify-center">
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-nc-accent to-nc-accentB text-[11px] flex items-center justify-center font-bold shadow-[0_0_16px_rgba(139,92,246,0.6)]">
                  {idx === 0 ? <Medal3D /> : idx + 1}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {u.avatarUrl ? (
                  <img 
                    src={u.avatarUrl} 
                    alt={u.nickname || u.name || u.email}
                    className="w-9 h-9 rounded-full object-cover border shadow-sm"
                    style={{ borderColor: u.avatarColor || '#6366f1' }}
                  />
                ) : (
                  <div 
                    className="w-9 h-9 rounded-full border flex items-center justify-center text-[11px] font-semibold shadow-sm"
                    style={{ 
                      background: `linear-gradient(to top right, ${u.avatarColor || '#6366f1'}, ${u.avatarColor || '#6366f1'}dd)`,
                      borderColor: u.avatarColor || '#6366f1'
                    }}
                  >
                    {(u.nickname || u.name || u.email)[0]?.toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {u.nickname || u.name || u.email}
                    {isMe && <span className="ml-1 text-[10px] text-violet-300 font-semibold">(You)</span>}
                  </div>
                  <div className="text-[10px] text-nc-muted">XP collector</div>
                </div>
              </div>
              <div className="text-[11px]">
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/60 px-2 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                  {rankTitle}
                </span>
              </div>
              <div className="text-[11px] flex flex-col items-end gap-1">
                <span className="font-semibold bg-gradient-to-r from-nc-accentC to-nc-accent bg-clip-text text-transparent">
                  {u.experience.toLocaleString()} XP
                </span>
                <span className="text-[10px] text-nc-muted">
                  {u.experience >= 1000 ? "� �🎖️ ✨" : u.experience >= 500 ? "�️ ✨" : u.experience >= 100 ? "✨" : "🌱"}
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
