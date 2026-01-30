"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "../auth/useSession";
import { ReactNode, useState, useEffect } from "react";
import StudentAssistant from "../assistant/StudentAssistant";

export function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { session } = useSession();
  const [funMenuOpen, setFunMenuOpen] = useState(false);
  const [funMenuTimeout, setFunMenuTimeout] = useState<NodeJS.Timeout | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const sidebarItems = [
    { href: "/", label: "Home", icon: "dashboard" },
    { href: "/contests", label: "Contests", icon: "emoji_events", badge: 3 },
    { href: "/lessons", label: "Lessons", icon: "school" },
    { href: "/leaderboard", label: "Leaderboard", icon: "leaderboard" },
    { href: "/profile", label: "Profile", icon: "person" },
  ];

  const communities = [
    { name: "R-Class Design", color: "bg-rose-500" },
    { name: "Typographers", color: "bg-amber-400" },
    { name: "3D Motion", color: "bg-emerald-400" },
  ];

  const sidebarContent = (
    <div className="p-6 pb-2 flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-2 mb-8">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-primary-500/20">
          MV
        </div>
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">Mind Verse</h1>
          <p className="text-[11px] font-medium text-slate-500 uppercase tracking-widest">Design Lab</p>
        </div>
      </div>

      {/* Navigation */}
      <div className="space-y-1 flex-1">
        {sidebarItems.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className={`sidebar-item flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all hover:bg-white/5 hover:text-white group ${
                isActive
                  ? "active bg-primary-500/10 text-primary-500 border-r-[3px] border-primary-500"
                  : "text-slate-400"
              }`}
            >
              <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
              <span>{item.label}</span>
              {item.badge && (
                <span className="ml-auto bg-primary-500/10 text-primary-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}

        {/* Fun Menu */}
        <div
          className="relative"
          onMouseEnter={() => {
            if (funMenuTimeout) {
              clearTimeout(funMenuTimeout);
              setFunMenuTimeout(null);
            }
            setFunMenuOpen(true);
          }}
          onMouseLeave={() => {
            const timeout = setTimeout(() => setFunMenuOpen(false), 200);
            setFunMenuTimeout(timeout);
          }}
        >
          <button
            className={`sidebar-item flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all hover:bg-white/5 hover:text-white group w-full ${
              pathname === "/spinner" || pathname === "/game"
                ? "active bg-primary-500/10 text-primary-500 border-r-[3px] border-primary-500"
                : "text-slate-400"
            }`}
          >
            <span className="material-symbols-outlined text-[22px]">casino</span>
            <span>Fun</span>
            <span className="ml-auto material-symbols-outlined text-[18px]">chevron_right</span>
          </button>
          {funMenuOpen && (
            <div
              className="absolute left-full top-0 ml-1 rounded-xl bg-dark-800 border border-white/10 shadow-xl overflow-hidden z-50 min-w-[140px]"
              onMouseEnter={() => {
                if (funMenuTimeout) {
                  clearTimeout(funMenuTimeout);
                  setFunMenuTimeout(null);
                }
                setFunMenuOpen(true);
              }}
              onMouseLeave={() => {
                setFunMenuTimeout(setTimeout(() => setFunMenuOpen(false), 200));
              }}
            >
              <Link
                href="/spinner"
                onClick={() => {
                  setFunMenuOpen(false);
                  setMobileMenuOpen(false);
                  if (funMenuTimeout) {
                    clearTimeout(funMenuTimeout);
                    setFunMenuTimeout(null);
                  }
                }}
                className={`block px-4 py-2.5 text-sm font-medium transition-all ${
                  pathname === "/spinner"
                    ? "bg-primary-500/20 text-primary-400"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                🎰 Spinner
              </Link>
              <Link
                href="/game"
                onClick={() => {
                  setFunMenuOpen(false);
                  setMobileMenuOpen(false);
                  if (funMenuTimeout) {
                    clearTimeout(funMenuTimeout);
                    setFunMenuTimeout(null);
                  }
                }}
                className={`block px-4 py-2.5 text-sm font-medium transition-all ${
                  pathname === "/game"
                    ? "bg-primary-500/20 text-primary-400"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                🖼️ Vote
              </Link>
            </div>
          )}
        </div>

        {/* Communities */}
        <div className="mt-8 px-4">
          <p className="text-xs font-semibold text-slate-500 mb-4 uppercase tracking-wider">Your Communities</p>
          <div className="space-y-3">
            {communities.map((community) => (
              <div key={community.name} className="flex items-center gap-3 cursor-pointer group">
                <span className={`w-2 h-2 rounded-full ${community.color} shadow-[0_0_8px_rgba(244,63,94,0.6)]`}></span>
                <span className="text-sm text-slate-400 group-hover:text-white transition-colors">{community.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Profile Footer */}
      <div className="mt-auto p-4 border-t border-white/5">
        {session ? (
          <button className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors text-left">
            <div className="w-10 h-10 rounded-full border border-white/10 bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center text-white font-bold">
              {(session?.nickname || session?.name || session?.email || "U")[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-white truncate">
                  {session?.nickname || session?.name || session?.email?.split("@")[0] || "User"}
                </h4>
                {session?.role === "teacher" && (
                  <span className="text-[9px] uppercase tracking-wider text-green-400 font-bold bg-green-500/10 px-1.5 rounded">
                    Pro
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 truncate">
                {session?.role === "teacher" ? "Teacher Account" : "Student Account"}
              </p>
            </div>
            <span className="material-symbols-outlined text-slate-500 text-lg">more_vert</span>
          </button>
        ) : (
          <Link
            href="/login"
            onClick={() => setMobileMenuOpen(false)}
            className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors text-left border border-dashed border-white/10 hover:border-primary-500/30"
          >
            <div className="w-10 h-10 rounded-full border border-white/10 bg-dark-700 flex items-center justify-center text-primary-400">
              <span className="material-symbols-outlined text-xl">login</span>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-white">Нэвтрэх</h4>
              <p className="text-xs text-slate-500">Бүтээл хуваалцах, XP цуглуулах</p>
            </div>
            <span className="material-symbols-outlined text-slate-500 text-lg">arrow_forward</span>
          </Link>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile header + hamburger */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 z-30 flex items-center justify-between px-4 bg-dark-900/95 backdrop-blur border-b border-white/5">
        <button
          type="button"
          onClick={() => setMobileMenuOpen((o) => !o)}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          aria-label="Цэс нээх"
        >
          <span className="material-symbols-outlined text-[28px]">menu</span>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
            MV
          </div>
          <span className="font-bold text-white">Mind Verse</span>
        </div>
        <div className="w-10" />
      </header>

      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden
        />
      )}

      {/* Mobile sidebar drawer */}
      <aside
        className={`lg:hidden fixed top-0 left-0 z-50 w-[280px] max-w-[85vw] h-full bg-dark-900 border-r border-white/5 shadow-xl transform transition-transform duration-200 ease-out ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <span className="font-bold text-white">Цэс</span>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
            aria-label="Цэс хаах"
          >
            <span className="material-symbols-outlined text-[24px]">close</span>
          </button>
        </div>
        <div className="overflow-y-auto h-[calc(100%-56px)]">{sidebarContent}</div>
      </aside>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-72 bg-dark-900 border-r border-white/5 h-full relative z-20 shrink-0">
        {sidebarContent}
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative bg-dark-950 bg-hero-pattern pt-14 lg:pt-0">
        {/* Background gradients */}
        <div className="fixed top-0 left-64 w-[500px] h-[500px] bg-primary-900/20 rounded-full blur-[120px] pointer-events-none hidden lg:block"></div>
        <div className="fixed bottom-0 right-0 w-[600px] h-[600px] bg-blue-900/10 rounded-full blur-[120px] pointer-events-none hidden lg:block"></div>
        
        <div className="max-w-[1600px] mx-auto p-4 lg:p-8 relative z-10">
          {children}
        </div>
      </main>
      
      {/* AI Design Assistant */}
      <StudentAssistant />
    </div>
  );
}

