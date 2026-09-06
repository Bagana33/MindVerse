"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "../auth/useSession";
import { ReactNode, useState, useEffect } from "react";
import StudentAssistant from "../assistant/StudentAssistant";
import { BrandLogo } from "./BrandLogo";
import { cachedFetch } from "../../lib/fetchCache";

export function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, logout } = useSession();
  const [funMenuOpen, setFunMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Fetch notifications count and list for instant reactive updates
  const loadNotifs = async () => {
    if (!session?.email) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    try {
      setLoadingNotifs(true);
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          setNotifications(data.notifications || []);
          setUnreadCount(data.unreadCount ?? 0);
        }
      }
    } catch {
      // silent
    } finally {
      setLoadingNotifs(false);
    }
  };

  useEffect(() => {
    loadNotifs();
    const interval = setInterval(loadNotifs, 30000);
    const handleFocus = () => loadNotifs();
    window.addEventListener("focus", handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [session]);

  const markNotificationRead = async (id: string) => {
    try {
      const res = await fetch("/api/notifications/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch {}
  };

  const markAllRead = async () => {
    try {
      const res = await fetch("/api/notifications/mark-read", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
      }
    } catch {}
  };

  const clearAll = async () => {
    if (!confirm("Бүх мэдэгдлийг устгах уу?")) return;
    try {
      const res = await fetch("/api/notifications/clear", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setNotifications([]);
        setUnreadCount(0);
      }
    } catch {}
  };


  const navItems = [
    { href: "/", label: "Home", icon: "home" },
    { href: "/contests", label: "Contests", icon: "emoji_events", badge: 3 },
    { href: "/lessons", label: "Lessons", icon: "school" },
    { href: "/leaderboard", label: "Leaderboard", icon: "leaderboard" },
    { href: "/profile", label: "Profile", icon: "person", isProfile: true },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      {/* Mobile header + hamburger */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 z-30 flex items-center justify-between px-4 bg-slate-950/95 backdrop-blur border-b border-slate-800/80">
        <button
          type="button"
          onClick={() => setMobileMenuOpen((o) => !o)}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          aria-label="Цэс нээх"
        >
          <span className="material-symbols-outlined text-[28px]">menu</span>
        </button>
        <div className="flex items-center gap-2">
          <BrandLogo size="sm" />
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
        className={`lg:hidden fixed top-0 left-0 z-50 w-[280px] max-w-[85vw] h-full bg-slate-950 border-r border-slate-800/80 shadow-xl transform transition-transform duration-200 ease-out ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <BrandLogo size="sm" />
            <span className="font-bold text-white">Mind Verse</span>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
            aria-label="Цэс хаах"
          >
            <span className="material-symbols-outlined text-[24px]">close</span>
          </button>
        </div>
        <div className="p-4 space-y-2">
          {navItems.map((item) => {
            const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-violet-600/20 text-violet-300 border border-violet-500/30 font-bold"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
                }`}
              >
                <span className="material-symbols-outlined text-[24px]">{item.icon}</span>
                <span>{item.label}</span>
                {item.badge && (
                  <span className="ml-auto bg-pink-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}

          {session && (
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setNotifPanelOpen(true);
                loadNotifs();
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:bg-slate-800/60 hover:text-white transition-all text-left"
            >
              <div className="relative flex items-center justify-center">
                <span className="material-symbols-outlined text-[24px]">notifications</span>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-pink-500 rounded-full border border-slate-950 animate-pulse" />
                )}
              </div>
              <span>Мэдэгдэл</span>
              {unreadCount > 0 && (
                <span className="ml-auto bg-pink-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </button>
          )}

          <Link
            href="/spinner"
            onClick={() => setMobileMenuOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              pathname === "/spinner" ? "bg-violet-600/20 text-violet-300" : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
            }`}
          >
            <span className="material-symbols-outlined text-[24px]">casino</span>
            <span>Spinner</span>
          </Link>

          <Link
            href="/game"
            onClick={() => setMobileMenuOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              pathname === "/game" ? "bg-violet-600/20 text-violet-300" : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
            }`}
          >
            <span className="material-symbols-outlined text-[24px]">thumbs_up_down</span>
            <span>Vote Game</span>
          </Link>

          {session?.role === "teacher" && (
            <Link
              href="/admin"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-amber-400 hover:bg-slate-800/60"
            >
              <span className="material-symbols-outlined text-[24px]">admin_panel_settings</span>
              <span>Admin</span>
            </Link>
          )}

          {session && (
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                logout();
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <span className="material-symbols-outlined text-[24px]">logout</span>
              <span>Гарах</span>
            </button>
          )}
        </div>
      </aside>

      {/* Desktop Hover-Expandable Left Sidebar Outer Space Container (Fixed 72px space, so main container never jumps) */}
      <div className="hidden lg:block w-[72px] shrink-0 h-full relative z-30">
        <aside
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => {
            setIsHovered(false);
            setFunMenuOpen(false);
          }}
          className={`fixed top-0 left-0 bottom-0 z-40 flex flex-col bg-slate-950/95 backdrop-blur-2xl border-r border-slate-800/80 transition-all duration-300 ease-in-out overflow-hidden ${
            isHovered
              ? "w-64 shadow-[16px_0_40px_rgba(0,0,0,0.7)] border-slate-700/60"
              : "w-[72px]"
          }`}
        >
          {/* Logo Header */}
          <div className="h-16 flex items-center px-4 border-b border-slate-800/50 shrink-0">
            <Link href="/" className="flex items-center gap-3.5 w-full">
              <BrandLogo size="md" className="shrink-0 transition-transform duration-300 hover:scale-105" />
              <div
                className={`transition-all duration-300 whitespace-nowrap overflow-hidden ${
                  isHovered ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 pointer-events-none"
                }`}
              >
                <h1 className="text-base font-bold bg-gradient-to-r from-violet-300 via-purple-300 to-pink-300 bg-clip-text text-transparent">
                  Mind Verse
                </h1>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">
                  Design Lab
                </p>
              </div>
            </Link>
          </div>

          {/* Navigation Items */}
          <div className="flex-1 py-4 px-2.5 space-y-1.5 overflow-y-auto overflow-x-hidden">
            {navItems.map((item) => {
              const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group/item flex items-center h-12 px-3 rounded-2xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-gradient-to-r from-violet-600/25 to-purple-600/25 text-white border border-violet-500/40 shadow-[0_4px_16px_rgba(139,92,246,0.3)]"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                  }`}
                  title={item.label}
                >
                  <div className="w-8 h-8 flex items-center justify-center shrink-0">
                    {item.isProfile && session?.avatarUrl ? (
                      <img
                        src={session.avatarUrl}
                        alt="Profile"
                        className="w-7 h-7 rounded-full object-cover border border-white/20"
                      />
                    ) : (
                      <span className={`material-symbols-outlined text-[26px] transition-transform duration-200 group-hover/item:scale-110 ${isActive ? "text-violet-400" : ""}`}>
                        {item.icon}
                      </span>
                    )}
                  </div>

                  <div
                    className={`flex items-center justify-between flex-1 min-w-0 ml-3.5 transition-all duration-300 ${
                      isHovered ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 pointer-events-none"
                    }`}
                  >
                    <span className="truncate whitespace-nowrap font-medium text-slate-200 group-hover/item:text-white">
                      {item.label}
                    </span>
                    {item.badge && (
                      <span className="bg-pink-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg">
                        {item.badge}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}

            {/* Notifications Item */}
            <button
              type="button"
              onClick={() => {
                if (!session) {
                  router.push("/login");
                  return;
                }
                setNotifPanelOpen((prev) => {
                  const next = !prev;
                  if (next) loadNotifs();
                  return next;
                });
              }}
              className={`w-full group/item flex items-center h-12 px-3 rounded-2xl text-sm font-medium transition-all duration-200 ${
                notifPanelOpen
                  ? "bg-violet-600/25 text-white border border-violet-500/40 shadow-[0_4px_16px_rgba(139,92,246,0.3)] font-bold"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
              title="Notifications"
            >
              <div className="w-8 h-8 flex items-center justify-center shrink-0 relative">
                <span className="material-symbols-outlined text-[26px] group-hover/item:scale-110 transition-transform">
                  notifications
                </span>
                {unreadCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 bg-pink-500 rounded-full border-2 border-slate-950 animate-pulse" />
                )}
              </div>

              <div
                className={`flex items-center justify-between flex-1 min-w-0 ml-3.5 transition-all duration-300 ${
                  isHovered ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 pointer-events-none"
                }`}
              >
                <span className="truncate whitespace-nowrap font-medium text-slate-200 group-hover/item:text-white">
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <span className="bg-pink-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg">
                    {unreadCount}
                  </span>
                )}
              </div>
            </button>

            {/* Fun Games Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setFunMenuOpen((o) => !o)}
                className={`w-full group/item flex items-center h-12 px-3 rounded-2xl text-sm font-medium transition-all duration-200 ${
                  pathname === "/spinner" || pathname === "/game"
                    ? "bg-violet-600/20 text-white border border-violet-500/40"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                }`}
                title="Fun Games"
              >
                <div className="w-8 h-8 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[26px] group-hover/item:scale-110 transition-transform">
                    casino
                  </span>
                </div>
                <div
                  className={`flex items-center justify-between flex-1 min-w-0 ml-3.5 transition-all duration-300 ${
                    isHovered ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 pointer-events-none"
                  }`}
                >
                  <span className="truncate whitespace-nowrap font-medium text-slate-200 group-hover/item:text-white">
                    Fun Games
                  </span>
                  <span className={`material-symbols-outlined text-sm transition-transform ${funMenuOpen ? "rotate-90" : ""}`}>
                    chevron_right
                  </span>
                </div>
              </button>

              {/* Submenu when open & hovered */}
              {funMenuOpen && isHovered && (
                <div className="mt-1 ml-5 pl-3 border-l border-slate-800 space-y-1">
                  <Link
                    href="/spinner"
                    className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-xl transition-all ${
                      pathname === "/spinner" ? "text-violet-300 bg-violet-500/20 font-bold" : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                    }`}
                  >
                    <span>🎰 Spinner</span>
                  </Link>
                  <Link
                    href="/game"
                    className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-xl transition-all ${
                      pathname === "/game" ? "text-violet-300 bg-violet-500/20 font-bold" : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                    }`}
                  >
                    <span>🖼️ Vote Game</span>
                  </Link>
                </div>
              )}
            </div>

            {/* Admin link for Teachers */}
            {session?.role === "teacher" && (
              <Link
                href="/admin"
                className={`group/item flex items-center h-12 px-3 rounded-2xl text-sm font-medium transition-all duration-200 ${
                  pathname.startsWith("/admin")
                    ? "bg-violet-600/20 text-white border border-violet-500/40"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                }`}
                title="Admin"
              >
                <div className="w-8 h-8 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[26px] text-amber-400">
                    admin_panel_settings
                  </span>
                </div>
                <div
                  className={`flex items-center flex-1 min-w-0 ml-3.5 transition-all duration-300 ${
                    isHovered ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 pointer-events-none"
                  }`}
                >
                  <span className="truncate whitespace-nowrap font-medium text-slate-200 group-hover/item:text-white">
                    Admin Panel
                  </span>
                </div>
              </Link>
            )}
          </div>

          {/* User Account / Footer */}
          <div className="p-2 border-t border-slate-800/60 shrink-0">
            {session ? (
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => router.push("/profile")}
                  className="flex-1 flex items-center h-12 px-2.5 rounded-xl hover:bg-slate-800/60 transition-all text-left min-w-0"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden border border-white/20">
                    {session.avatarUrl ? (
                      <img src={session.avatarUrl} alt="User" className="w-full h-full object-cover" />
                    ) : (
                      (session.nickname || session.name || session.email)[0].toUpperCase()
                    )}
                  </div>
                  <div
                    className={`flex-1 min-w-0 ml-3.5 transition-all duration-300 ${
                      isHovered ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 pointer-events-none"
                    }`}
                  >
                    <p className="text-xs font-bold text-white truncate">
                      {session.nickname || session.name || session.email.split("@")[0]}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {session.role === "teacher" ? "👨‍🏫 Багш" : "👨‍🎓 Сурагч"}
                    </p>
                  </div>
                </button>
                {isHovered && (
                  <button
                    onClick={logout}
                    className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Гарах"
                  >
                    <span className="material-symbols-outlined text-[20px]">logout</span>
                  </button>
                )}
              </div>
            ) : (
              <Link
                href="/login"
                className="w-full flex items-center h-12 px-2.5 rounded-xl hover:bg-slate-800/60 transition-all text-left text-slate-400 hover:text-white"
              >
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px]">login</span>
                </div>
                <div
                  className={`flex-1 min-w-0 ml-3.5 transition-all duration-300 ${
                    isHovered ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 pointer-events-none"
                  }`}
                >
                  <p className="text-xs font-bold text-white">Нэвтрэх</p>
                  <p className="text-[10px] text-slate-500">Sign in</p>
                </div>
              </Link>
            )}
          </div>
        </aside>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto relative bg-slate-950 pt-14 lg:pt-0">
        <div className="max-w-[1600px] mx-auto p-4 lg:p-8 relative z-10">
          {children}
        </div>
      </main>

      {/* AI Design Assistant */}
      <StudentAssistant />

      {/* Notification Slide-Over Drawer */}
      {notifPanelOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setNotifPanelOpen(false)}
            aria-hidden
          />
          <div
            className="fixed top-0 right-0 z-50 w-full max-w-md h-full bg-slate-950/95 backdrop-blur-2xl border-l border-slate-800/80 shadow-2xl flex flex-col animate-fade-in"
          >
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔔</span>
                <h2 className="text-base font-bold text-white">Мэдэгдлүүд</h2>
                {unreadCount > 0 && (
                  <span className="bg-pink-500/20 text-pink-300 border border-pink-500/40 text-xs font-bold px-2 py-0.5 rounded-full">
                    {unreadCount} шинэ
                  </span>
                )}
              </div>
              <button
                onClick={() => setNotifPanelOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                aria-label="Хаах"
              >
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>

            {/* Quick Actions */}
            <div className="px-4 py-2.5 bg-slate-900/40 border-b border-slate-800/60 flex items-center justify-between gap-2">
              <button
                onClick={loadNotifs}
                disabled={loadingNotifs}
                className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
              >
                <span className={`material-symbols-outlined text-[16px] ${loadingNotifs ? "animate-spin" : ""}`}>
                  sync
                </span>
                <span>Шинэчлэх</span>
              </button>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-xs px-2.5 py-1 rounded-lg bg-violet-600/30 hover:bg-violet-600/50 text-violet-200 border border-violet-500/40 transition-all"
                  >
                    Бүгдийг уншсан
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={clearAll}
                    className="text-xs px-2.5 py-1 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 transition-all"
                  >
                    Цэвэрлэх
                  </button>
                )}
              </div>
            </div>

            {/* Notification List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {loadingNotifs && notifications.length === 0 ? (
                <div className="space-y-2.5">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 animate-pulse h-20" />
                  ))}
                </div>
              ) : notifications.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="text-4xl mb-3">🎉</div>
                  <h3 className="text-sm font-semibold text-slate-300 mb-1">Мэдэгдэл алга байна</h3>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    Танд шинэ реакц, үнэлгээ, сэтгэгдэл ирэх үед энд автоматаар харагдах болно.
                  </p>
                </div>
              ) : (
                notifications.map((n) => {
                  const type = n.type || "LIKE";
                  const badgeConfig = {
                    LIKE: { label: "❤️ Реакц", bg: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
                    COMMENT: { label: "💬 Сэтгэгдэл", bg: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
                    GRADE: { label: "📝 Үнэлгээ", bg: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
                    CONTEST_WIN: { label: "🏆 Уралдаан", bg: "bg-purple-500/15 text-purple-300 border-purple-500/30" },
                    LESSON: { label: "📚 Хичээл", bg: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
                  }[type as string] || { label: "🔔 Мэдэгдэл", bg: "bg-violet-500/15 text-violet-300 border-violet-500/30" };

                  return (
                    <div
                      key={n.id}
                      onClick={() => {
                        if (!n.read) markNotificationRead(n.id);
                      }}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                        n.read
                          ? "bg-slate-900/40 border-slate-800/80 text-slate-400 hover:bg-slate-800/40"
                          : "bg-violet-950/40 border-violet-500/40 shadow-[0_0_15px_rgba(139,92,246,0.15)] text-slate-200 hover:bg-violet-900/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeConfig.bg}`}>
                          {badgeConfig.label}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-400">
                            {new Date(n.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          {!n.read && (
                            <span className="w-2 h-2 rounded-full bg-pink-500 shadow-[0_0_6px_rgba(236,72,153,0.8)]" />
                          )}
                        </div>
                      </div>
                      <p className="text-xs leading-relaxed text-slate-300">{n.message}</p>
                    </div>
                  );
                })
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-3.5 border-t border-slate-800/80 bg-slate-900/40">
              <button
                onClick={() => {
                  setNotifPanelOpen(false);
                  router.push("/profile?tab=notifications");
                }}
                className="w-full py-2 px-4 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-white/5 text-xs text-slate-300 hover:text-white font-medium text-center transition-all"
              >
                Бүх мэдэгдлийг дэлгэрэнгүй үзэх (Profile) →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
