"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "../auth/useSession";
import { ReactNode } from "react";

export function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { session } = useSession();

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

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-72 bg-dark-900 border-r border-white/5 h-full relative z-20">
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
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative bg-dark-950 bg-hero-pattern">
        {/* Background gradients */}
        <div className="fixed top-0 left-64 w-[500px] h-[500px] bg-primary-900/20 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="fixed bottom-0 right-0 w-[600px] h-[600px] bg-blue-900/10 rounded-full blur-[120px] pointer-events-none"></div>
        
        <div className="max-w-[1600px] mx-auto p-4 lg:p-8 relative z-10">
          {children}
        </div>
      </main>
    </div>
  );
}

