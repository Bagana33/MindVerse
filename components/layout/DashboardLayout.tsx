"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "../auth/useSession";
import { ReactNode, useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { BrandLogo } from "./BrandLogo";

const loadAssistant = () => import("../assistant/StudentAssistant");
const StudentAssistant = dynamic(loadAssistant, {
  ssr: false,
  loading: () => (
    <div role="status" className="fixed bottom-4 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600 text-white lg:bottom-6 lg:right-6">
      <span className="material-symbols-outlined animate-spin" aria-hidden="true">progress_activity</span>
      <span className="sr-only">Туслахыг нээж байна…</span>
    </div>
  ),
});

type NotificationItem = { id: string; type?: string; read: boolean; createdAt: string; message: string };
const navItems = [
  { href: "/", label: "Нүүр", icon: "home" },
  { href: "/contests", label: "Уралдаан", icon: "emoji_events" },
  { href: "/lessons", label: "Хичээл", icon: "school" },
  { href: "/poster-brief", label: "Постерын санаа", icon: "auto_awesome" },
  { href: "/leaderboard", label: "Шилдэг сурагчид", icon: "leaderboard" },
  { href: "/profile", label: "Миний хуудас", icon: "person", isProfile: true },
];
const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex="0"]';

export function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, loading: sessionLoading, logout } = useSession();
  const [funMenuOpen, setFunMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const [assistantLoaded, setAssistantLoaded] = useState(false);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileDrawerRef = useRef<HTMLElement>(null);
  const notificationDrawerRef = useRef<HTMLDivElement>(null);
  const dialogReturnFocusRef = useRef<HTMLElement | null>(null);
  const notificationRequestRef = useRef<AbortController | null>(null);
  const notificationActionRef = useRef(false);
  const [notificationActionBusy, setNotificationActionBusy] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const modalOpen = mobileMenuOpen || notifPanelOpen;

  useEffect(() => {
    setMobileMenuOpen(false);
    mainRef.current?.scrollTo({ top: 0, behavior: "instant" });
    setFunMenuOpen(pathname === '/game' || pathname === '/spinner');
    const pageName = pathname === '/' ? 'Бүтээлүүд' : ({
      lessons: 'Хичээлүүд', contests: 'Уралдаан', leaderboard: 'Шилдэг сурагчид', 'poster-brief': 'Постерын санаа',
      profile: 'Профайл', admin: 'Удирдлага', spinner: 'Азын хүрд', game: 'Бүтээлийн санал хураалт',
    } as Record<string, string>)[pathname.split('/')[1]];
    document.title = pageName ? `${pageName} · Mind Verse` : 'Mind Verse';
  }, [pathname]);

  useEffect(() => {
    const breakpoint = window.matchMedia("(min-width: 1024px)");
    const closeMobileMenu = () => { if (breakpoint.matches) setMobileMenuOpen(false); };
    breakpoint.addEventListener("change", closeMobileMenu);
    return () => breakpoint.removeEventListener("change", closeMobileMenu);
  }, []);

  // Drawers keep keyboard focus inside and restore it to their opener on close.
  useEffect(() => {
    const panel = notifPanelOpen ? notificationDrawerRef.current : mobileMenuOpen ? mobileDrawerRef.current : null;
    if (!panel) return;
    const previousFocus = dialogReturnFocusRef.current || (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const getFocusable = () => Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector)).filter((element) => element.getClientRects().length > 0);
    (getFocusable()[0] || panel).focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (notifPanelOpen) setNotifPanelOpen(false);
        else setMobileMenuOpen(false);
      }
      if (event.key !== "Tab") return;
      const focusable = getFocusable();
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first) { event.preventDefault(); panel.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const target = previousFocus?.closest("#mobile-navigation") ? mobileMenuButtonRef.current : previousFocus;
      if (target?.isConnected && !target.closest("[inert]")) target.focus();
    };
  }, [mobileMenuOpen, notifPanelOpen]);

  const loadNotifs = useCallback(async () => {
    if (!session?.email || document.visibilityState === "hidden" || notificationActionRef.current) return;
    notificationRequestRef.current?.abort();
    const controller = new AbortController();
    notificationRequestRef.current = controller;
    setLoadingNotifs(true);
    setNotificationError("");
    const timeout = window.setTimeout(() => controller.abort("timeout"), 15000);
    try {
      const res = await fetch("/api/notifications", { cache: "no-store", signal: controller.signal });
      if (!res.ok) throw new Error("Мэдэгдлүүдийг ачаалж чадсангүй.");
      const data = await res.json();
      if (!data.ok) throw new Error("Мэдэгдлүүдийг ачаалж чадсангүй.");
      if (!controller.signal.aborted) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount ?? 0);
      }
    } catch {
      if (!controller.signal.aborted || controller.signal.reason === "timeout") setNotificationError("Мэдэгдлүүдийг ачаалж чадсангүй. Дахин шинэчилнэ үү.");
    } finally {
      window.clearTimeout(timeout);
      if (notificationRequestRef.current === controller) setLoadingNotifs(false);
    }
  }, [session?.email]);

  useEffect(() => {
    if (!session?.email) {
      setNotifications([]);
      setUnreadCount(0);
      setNotificationError("");
      setLoadingNotifs(false);
      setNotifPanelOpen(false);
      return;
    }
    loadNotifs();
    const interval = setInterval(loadNotifs, 60000);
    window.addEventListener("focus", loadNotifs);
    document.addEventListener("visibilitychange", loadNotifs);
    return () => {
      notificationRequestRef.current?.abort();
      clearInterval(interval);
      window.removeEventListener("focus", loadNotifs);
      document.removeEventListener("visibilitychange", loadNotifs);
    };
  }, [session?.email, loadNotifs]);

  const updateNotifications = async (action: "read" | "read-all" | "clear", id?: string) => {
    if (notificationActionRef.current) return;
    notificationActionRef.current = true;
    notificationRequestRef.current?.abort();
    setLoadingNotifs(false);
    setNotificationActionBusy(true);
    setNotificationError("");
    try {
      const res = await fetch(action === "clear" ? "/api/notifications/clear" : "/api/notifications/mark-read", {
        method: "POST",
        ...(id ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) } : {}),
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error("notification-update-failed");
      if (action === "clear") {
        setNotifications([]);
        setUnreadCount(0);
      } else if (action === "read-all") {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(data.unreadCount ?? 0);
      } else {
        setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
        setUnreadCount((prev) => data.unreadCount ?? Math.max(0, prev - 1));
      }
    } catch {
      setNotificationError("Өөрчлөлтийг хадгалж чадсангүй. Дахин оролдоно уу.");
    } finally {
      notificationActionRef.current = false;
      setNotificationActionBusy(false);
    }
  };

  const clearAll = async () => {
    if (!confirm("Бүх мэдэгдлийг устгах уу?")) return;
    await updateNotifications("clear");
  };


  return (
    <div className="mv-shell flex h-dvh overflow-hidden">
      <a href="#main-content" inert={modalOpen} className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[110] focus:rounded-xl focus:bg-violet-600 focus:px-4 focus:py-3 focus:text-white">Үндсэн агуулга руу очих</a>
      {/* Mobile header + hamburger */}
      <header inert={modalOpen} className="lg:hidden fixed top-0 left-0 right-0 h-14 z-30 flex items-center justify-between px-4 bg-slate-950/95 backdrop-blur border-b border-slate-800/80">
        <button
          type="button"
          ref={mobileMenuButtonRef}
          onClick={() => {
            dialogReturnFocusRef.current = mobileMenuButtonRef.current;
            setMobileMenuOpen((o) => !o);
          }}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          aria-label={mobileMenuOpen ? "Цэс хаах" : "Цэс нээх"}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-navigation"
        >
          <span className="material-symbols-outlined text-[28px]" aria-hidden="true">menu</span>
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
        ref={mobileDrawerRef}
        id="mobile-navigation"
        role="dialog"
        aria-modal={mobileMenuOpen ? true : undefined}
        aria-label="Үндсэн цэс"
        aria-hidden={!mobileMenuOpen || undefined}
        inert={!mobileMenuOpen || notifPanelOpen}
        tabIndex={-1}
        className={`lg:hidden fixed top-0 left-0 z-50 w-[280px] max-w-[85vw] h-dvh overflow-y-auto overscroll-contain bg-slate-950 border-r border-slate-800/80 shadow-xl transform transition-transform duration-200 ease-out ${
          mobileMenuOpen ? "translate-x-0 visible" : "-translate-x-full invisible"
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
            <span className="material-symbols-outlined text-[24px]" aria-hidden="true">close</span>
          </button>
        </div>
        <nav aria-label="Үндсэн цэс" className="p-4 space-y-2">
          {navItems.map((item) => {
            const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-violet-600/20 text-violet-300 border border-violet-500/30 font-bold"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
                }`}
              >
                <span className="material-symbols-outlined text-[24px]" aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}

          {session && (
            <button
              type="button"
              onClick={() => {
                dialogReturnFocusRef.current = mobileMenuButtonRef.current;
                setMobileMenuOpen(false);
                setNotifPanelOpen(true);
                loadNotifs();
              }}
              aria-haspopup="dialog"
              aria-controls="notification-panel"
              aria-label={unreadCount > 0 ? `Мэдэгдэл, ${unreadCount} шинэ` : "Мэдэгдэл"}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:bg-slate-800/60 hover:text-white transition-all text-left"
            >
              <div className="relative flex items-center justify-center">
                <span className="material-symbols-outlined text-[24px]" aria-hidden="true">notifications</span>
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
            aria-current={pathname === "/spinner" ? "page" : undefined}
            onClick={() => setMobileMenuOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              pathname === "/spinner" ? "bg-violet-600/20 text-violet-300" : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
            }`}
          >
            <span className="material-symbols-outlined text-[24px]" aria-hidden="true">casino</span>
            <span>Азын хүрд</span>
          </Link>

          <Link
            href="/game"
            aria-current={pathname === "/game" ? "page" : undefined}
            onClick={() => setMobileMenuOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              pathname === "/game" ? "bg-violet-600/20 text-violet-300" : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
            }`}
          >
            <span className="material-symbols-outlined text-[24px]" aria-hidden="true">thumbs_up_down</span>
            <span>Санал өгөх тоглоом</span>
          </Link>

          {session?.role === "teacher" && (
            <Link
              href="/admin"
              aria-current={pathname.startsWith("/admin") ? "page" : undefined}
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-amber-400 hover:bg-slate-800/60"
            >
              <span className="material-symbols-outlined text-[24px]" aria-hidden="true">admin_panel_settings</span>
              <span>Удирдлага</span>
            </Link>
          )}

          {!session && (
            <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="flex min-h-12 items-center gap-3 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500">
              <span className="material-symbols-outlined text-[24px]" aria-hidden="true">login</span>
              Нэвтрэх
            </Link>
          )}
          {session && (
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                logout();
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <span className="material-symbols-outlined text-[24px]" aria-hidden="true">logout</span>
              <span>Гарах</span>
            </button>
          )}
        </nav>
      </aside>

      {/* Desktop navigation keeps a stable, readable width at every laptop size. */}
      <div inert={modalOpen} className="relative z-30 hidden h-full w-[232px] shrink-0 lg:block 2xl:w-64">
        <aside aria-label="Үндсэн цэс" className="mv-sidebar fixed inset-y-0 left-0 flex flex-col">
          <div className="flex h-24 shrink-0 items-center border-b border-white/[.07] px-5 2xl:px-6">
            <Link href="/" aria-label="Mind Verse нүүр хуудас" className="flex min-w-0 items-center gap-3">
              <BrandLogo size="md" className="shrink-0" />
              <div className="min-w-0">
                <p className="text-lg font-bold tracking-tight text-white">Mind Verse</p>
                <p className="mt-1 text-[10px] font-medium uppercase tracking-[.15em] text-slate-500">Дизайн лаборатори</p>
              </div>
            </Link>
          </div>
          <nav aria-label="Үндсэн цэс" className="mv-scroll-area flex-1 space-y-1 overflow-y-auto px-3 pb-5 2xl:px-4">
            <p className="mv-nav-caption">Нээж үзэх</p>
            {navItems.filter(item => !item.isProfile).map(item => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className="mv-nav-item">
                <span className="material-symbols-outlined" aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </Link>;
            })}
            <p className="mv-nav-caption">Миний орон зай</p>
            <Link href="/profile" aria-current={pathname.startsWith("/profile") ? "page" : undefined} className="mv-nav-item">
              <span className="material-symbols-outlined" aria-hidden="true">person</span><span>Миний хуудас</span>
            </Link>
            <button type="button" className="mv-nav-item" data-active={notifPanelOpen}
              aria-label={unreadCount > 0 ? `Мэдэгдэл, ${unreadCount} шинэ` : "Мэдэгдэл"}
              aria-haspopup="dialog" aria-expanded={notifPanelOpen} aria-controls="notification-panel"
              onClick={event => {
                if (!session) { router.push("/login"); return; }
                dialogReturnFocusRef.current = event.currentTarget;
                if (!notifPanelOpen) loadNotifs();
                setNotifPanelOpen(!notifPanelOpen);
              }}>
              <span className="material-symbols-outlined" aria-hidden="true">notifications</span><span>Мэдэгдэл</span>
              {unreadCount > 0 && <span className="ml-auto rounded-md bg-violet-500/20 px-2 py-0.5 text-xs font-semibold tabular-nums text-violet-200">{unreadCount}</span>}
            </button>
            <p className="mv-nav-caption">Хамтдаа</p>
            <button type="button" onClick={() => setFunMenuOpen(value => !value)} className="mv-nav-item"
              data-active={pathname === "/spinner" || pathname === "/game"} aria-label="Тоглоом" aria-expanded={funMenuOpen} aria-controls="desktop-games">
              <span className="material-symbols-outlined" aria-hidden="true">casino</span><span>Тоглоом</span>
              <span className={`material-symbols-outlined ml-auto !text-lg transition-transform ${funMenuOpen ? "rotate-90" : ""}`} aria-hidden="true">chevron_right</span>
            </button>
            {funMenuOpen && <div id="desktop-games" className="ml-6 space-y-1 border-l border-white/10 pl-3">
              <Link href="/spinner" aria-current={pathname === "/spinner" ? "page" : undefined} className={`flex min-h-11 items-center rounded-lg px-3 text-sm transition-colors ${pathname === "/spinner" ? "bg-violet-500/10 font-medium text-violet-200" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>Азын хүрд</Link>
              <Link href="/game" aria-current={pathname === "/game" ? "page" : undefined} className={`flex min-h-11 items-center rounded-lg px-3 text-sm transition-colors ${pathname === "/game" ? "bg-violet-500/10 font-medium text-violet-200" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>Бүтээлийн санал</Link>
            </div>}
            {session?.role === "teacher" && <Link href="/admin" aria-current={pathname.startsWith("/admin") ? "page" : undefined} className="mv-nav-item">
              <span className="material-symbols-outlined text-amber-300" aria-hidden="true">admin_panel_settings</span><span>Удирдлага</span>
            </Link>}
          </nav>
          <div className="shrink-0 border-t border-white/[.07] p-3 2xl:p-4">
            {sessionLoading ? <div aria-label="Бүртгэл ачаалж байна" className="flex h-16 items-center gap-3 rounded-xl bg-white/[.025] px-3"><span className="h-9 w-9 rounded-full bg-white/5 motion-safe:animate-pulse" /><span className="h-3 w-24 rounded bg-white/5 motion-safe:animate-pulse" /></div> : session ? <div className="flex items-center gap-1 rounded-xl bg-white/[.025] p-1">
              <Link href="/profile" aria-label="Миний хуудас" title={session.nickname || session.name || session.email} className="flex min-h-14 min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 text-left hover:bg-white/5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-violet-500/20 text-sm font-semibold text-violet-100">
                  {session.avatarUrl ? <img src={session.avatarUrl} alt="" className="h-full w-full object-cover" /> : (session.nickname || session.name || session.email)[0].toUpperCase()}
                </span>
                <span className="min-w-0"><span className="block truncate text-sm font-semibold text-white">{session.nickname || session.name || session.email.split("@")[0]}</span><span className="mt-0.5 block text-xs text-slate-400">{session.role === "teacher" ? "Багш" : "Сурагч"}</span></span>
              </Link>
              <button type="button" onClick={logout} aria-label="Гарах" title="Гарах" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-500/10 hover:text-rose-300"><span className="material-symbols-outlined text-xl" aria-hidden="true">logout</span></button>
            </div> : <Link href="/login" className="flex min-h-14 items-center gap-3 rounded-xl border border-violet-400/15 bg-violet-500/[.07] px-3 hover:bg-violet-500/15">
              <span className="material-symbols-outlined text-violet-300" aria-hidden="true">login</span><span><span className="block text-sm font-semibold text-white">Нэвтрэх</span><span className="mt-0.5 block text-xs text-slate-400">Бүтээлч аяллаа эхлүүлье</span></span>
            </Link>}
          </div>
        </aside>
      </div>

      {/* Main Content Area */}
      <main ref={mainRef} id="main-content" tabIndex={-1} inert={modalOpen} className="mv-main mv-scroll-area relative min-w-0 flex-1 overflow-y-auto pt-14 lg:pt-0">
        <div className="mv-workspace relative z-10">
          {children}
        </div>
      </main>

      {/* AI Design Assistant */}
      <div inert={modalOpen} className={modalOpen ? "invisible" : undefined}>
        {assistantLoaded ? <StudentAssistant initiallyOpen /> : (
          <button
            type="button"
            onClick={() => setAssistantLoaded(true)}
            onMouseEnter={() => { void loadAssistant().catch(() => undefined); }}
            onFocus={() => { void loadAssistant().catch(() => undefined); }}
            className="fixed bottom-4 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-indigo-600 text-white shadow-lg transition-colors hover:from-primary-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-400 lg:bottom-6 lg:right-6"
            aria-label="Дизайны туслах нээх"
            title="Дизайны туслах"
          >
            <span className="material-symbols-outlined text-2xl" aria-hidden="true">smart_toy</span>
          </button>
        )}
      </div>

      {/* Notification Slide-Over Drawer */}
      {notifPanelOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setNotifPanelOpen(false)}
            aria-hidden
          />
          <div
            ref={notificationDrawerRef}
            id="notification-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="notification-title"
            tabIndex={-1}
            className="fixed top-0 right-0 z-50 w-full max-w-md h-dvh bg-slate-950/95 backdrop-blur-2xl border-l border-slate-800/80 shadow-2xl flex flex-col animate-fade-in"
          >
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔔</span>
                <h2 id="notification-title" className="text-base font-bold text-white">Мэдэгдлүүд</h2>
                {unreadCount > 0 && (
                  <span className="bg-pink-500/20 text-pink-300 border border-pink-500/40 text-xs font-bold px-2 py-0.5 rounded-full">
                    {unreadCount} шинэ
                  </span>
                )}
              </div>
              <button
                onClick={() => setNotifPanelOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                aria-label="Хаах"
              >
                <span className="material-symbols-outlined text-[22px]" aria-hidden="true">close</span>
              </button>
            </div>

            {/* Quick Actions */}
            <div className="px-4 py-2.5 bg-slate-900/40 border-b border-slate-800/60 flex items-center justify-between gap-2">
              <button
                onClick={loadNotifs}
                disabled={loadingNotifs || notificationActionBusy}
                className="inline-flex min-h-11 items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
              >
                <span className={`material-symbols-outlined text-[16px] ${loadingNotifs ? "animate-spin" : ""}`} aria-hidden="true">
                  sync
                </span>
                <span>Шинэчлэх</span>
              </button>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={() => updateNotifications("read-all")}
                    disabled={notificationActionBusy}
                    className="min-h-11 text-xs px-2.5 py-2 rounded-lg bg-violet-600/30 hover:bg-violet-600/50 text-violet-200 border border-violet-500/40 transition-all"
                  >
                    Бүгдийг уншсан
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={clearAll}
                    disabled={notificationActionBusy}
                    className="min-h-11 text-xs px-2.5 py-2 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 transition-all"
                  >
                    Цэвэрлэх
                  </button>
                )}
              </div>
            </div>

            {notificationError && <p role="alert" className="mx-4 mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{notificationError}</p>}
            {/* Notification List */}
            <div aria-busy={loadingNotifs} className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-2.5">
              {loadingNotifs && notifications.length === 0 ? (
                <div role="status" className="space-y-2.5">
                  <span className="sr-only">Мэдэгдлүүдийг ачаалж байна…</span>
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
                    <button
                      type="button"
                      key={n.id}
                      disabled={notificationActionBusy}
                      aria-label={`${n.message}${n.read ? ", уншсан" : ", уншсанаар тэмдэглэх"}`}
                      onClick={() => {
                        if (!n.read) updateNotifications("read", n.id);
                      }}
                      className={`w-full text-left p-3.5 rounded-2xl border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400 ${
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
                      <p className="text-sm leading-relaxed text-slate-300">{n.message}</p>
                    </button>
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
                className="w-full min-h-11 py-3 px-4 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-white/5 text-xs text-slate-300 hover:text-white font-medium text-center transition-all"
              >
                Бүх мэдэгдлийг дэлгэрэнгүй үзэх →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
