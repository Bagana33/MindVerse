"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "../auth/useSession";
import { useEffect, useState, useCallback } from "react";

export function Topbar() {
  const pathname = usePathname();
  const { session, logout } = useSession();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [xp, setXp] = useState<number | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!session) return;
    try {
      setLoadingNotifs(true);
      const res = await fetch('/api/notifications');
      const data = await res.json();
      if (data.ok) {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      }
    } catch (e) {
      // silent
    } finally {
      setLoadingNotifs(false);
    }
  }, [session]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // poll every 30s
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Fetch current user's XP for topbar pill
  useEffect(() => {
    let active = true;
    async function loadXp() {
      if (!session?.email) { setXp(null); return; }
      try {
        const res = await fetch(`/api/user?email=${encodeURIComponent(session.email)}`);
        if (!res.ok) { setXp(null); return; }
        const data = await res.json();
        if (active) setXp(data.user?.experience ?? null);
      } catch {
        if (active) setXp(null);
      }
    }
    loadXp();
  }, [session?.email]);

  const markAllRead = async () => {
    try {
      const res = await fetch('/api/notifications/mark-read', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setUnreadCount(0);
        // Update local notifications as read
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      }
    } catch {}
  };

  const tabs = [
    { href: "/", label: "Home" },
    { href: "/contests", label: "Contests" },
    { href: "/lessons", label: "Lessons" },
    { href: "/profile", label: "Profile" },
    { href: "/leaderboard", label: "Leaderboard" },
  ];

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/50">
      <div className="max-w-6xl mx-auto px-4 pt-4 pb-2">
        <div className="flex items-center gap-3">
          <div className="relative w-12 h-12 rounded-full flex items-center justify-center bg-gradient-to-tr from-violet-500 to-pink-500 shadow-[0_8px_24px_rgba(139,92,246,0.4)] font-bold neon-glow animate-pulse">
            <span className="text-white">MV</span>
          </div>
          <div>
            <h1 className="text-base font-bold bg-gradient-to-r from-violet-300 via-purple-300 to-pink-300 bg-clip-text text-transparent">Mind Verse</h1>
            <p className="text-xs text-slate-400">
              Graphic design lab · Creative challenges
            </p>
          </div>
        </div>

        <nav className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1 rounded-full glass-panel backdrop-blur-md px-1.5 py-1.5 shadow-lg">
            {tabs.map((tab) => {
              const isActive =
                tab.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={[
                    "px-4 py-2 text-xs font-medium rounded-full transition-all duration-300",
                    isActive
                      ? "bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-[0_4px_16px_rgba(139,92,246,0.5)] scale-105"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50",
                  ].join(" ")}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="🔍 Дизайн, tag хайх..."
              className="hidden md:block w-56 glass-panel rounded-full px-4 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
            />
            {session ? (
              <div className="inline-flex items-center gap-2">
                <div className="relative">
                  <button
                    onClick={() => setOpen(o => !o)}
                    className="relative rounded-full w-10 h-10 flex items-center justify-center glass-panel hover:bg-slate-800/60 transition-all"
                    aria-label="Notifications"
                  >
                    <span className="text-lg">🔔</span>
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-pink-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-lg animate-pulse">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                  {open && (
                    <div className="absolute right-0 mt-2 w-72 max-h-96 overflow-auto rounded-2xl glass-panel backdrop-blur-xl border border-slate-700/40 shadow-xl p-3 z-50 animate-fade-in">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-slate-300">Мэдэгдэл</span>
                        <div className="flex items-center gap-2">
                          <button onClick={fetchNotifications} className="text-[10px] px-2 py-1 rounded-full bg-slate-800/50 hover:bg-slate-700/60 text-slate-300">↻</button>
                          <button onClick={markAllRead} className="text-[10px] px-2 py-1 rounded-full bg-violet-600/40 hover:bg-violet-600 text-violet-100">Бүгдийг уншсан</button>
                        </div>
                      </div>
                      {loadingNotifs && notifications.length === 0 && (
                        <div className="text-xs text-slate-500 py-4 text-center">Ачаалж байна...</div>
                      )}
                      {notifications.length === 0 && !loadingNotifs && (
                        <div className="text-xs text-slate-500 py-4 text-center">Мэдэгдэл алга</div>
                      )}
                      <ul className="space-y-2">
                        {notifications.map(n => (
                          <li key={n.id} className={[
                            "rounded-xl px-3 py-2 text-xs flex flex-col gap-1 border transition-all",
                            n.read ? "border-slate-700/40 bg-slate-800/40" : "border-violet-500/40 bg-violet-950/60 shadow-[0_0_0_1px_rgba(139,92,246,0.4)]"
                          ].join(" ")}> 
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-slate-200">
                                {n.type === 'LIKE' && '👍 Like'}
                                {n.type === 'GRADE' && '📝 Grade'}
                                {n.type === 'CONTEST_WIN' && '🏆 Winner'}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-300 leading-snug">{n.message}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <div className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs glass-panel">
                  <span className="w-6 h-6 rounded-full bg-gradient-to-tr from-sky-500 to-violet-500 flex items-center justify-center text-[10px] font-bold shadow-lg">
                    {session.name?.[0]?.toUpperCase() || session.email[0]?.toUpperCase() || "U"}
                  </span>
                  <span className="text-slate-200 font-medium">{session.name || session.email.split('@')[0]}</span>
                  <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400 font-medium">
                    {session.role === "teacher" ? "✨ Багш" : "👨‍🎓 Сурагч"}
                  </span>
                  {session.role === "student" && typeof xp === 'number' && (
                    <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-violet-500/40 bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-200 font-semibold">
                      ⚡ {xp} XP
                    </span>
                  )}
                </div>
                <button 
                  onClick={logout} 
                  className="rounded-full px-4 py-2 text-xs glass-panel text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-all duration-300"
                >
                  Гарах
                </button>
              </div>
            ) : (
              <Link href="/login" className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs glass-panel hover:bg-slate-800 transition-all duration-300">
                <span className="w-6 h-6 rounded-full bg-gradient-to-tr from-sky-500 to-violet-500 flex items-center justify-center text-[10px] font-bold">
                  ?
                </span>
                <span className="text-slate-300">Нэвтрэх</span>
              </Link>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
