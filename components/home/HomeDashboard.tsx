"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "../auth/useSession";
import { LeaderboardSidebar } from "../leaderboard/LeaderboardTable";
import { cachedFetch } from "../../lib/fetchCache";

type UserPost = {
  id: string;
  title: string;
  description: string;
  author: string;
  authorEmail: string;
  points: number;
  createdAt: string;
  imageUrl?: string;
  reactions: Array<{ userEmail: string; type: string }>;
};

type LeaderboardUser = {
  email: string;
  name?: string;
  nickname?: string;
  avatarUrl?: string;
  experience: number;
};

function formatRelativeTime(dateString: string) {
  const timestamp = new Date(dateString).getTime();
  if (Number.isNaN(timestamp)) return "";
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** Subsequence: query-ийн үсгүүд text дотор дарааллаар гарч байна уу (дутуу бичих зөвшөөрнө) */
function isSubsequence(text: string, query: string): boolean {
  let j = 0;
  for (let i = 0; i < query.length; i++) {
    const pos = text.indexOf(query[i], j);
    if (pos === -1) return false;
    j = pos + 1;
  }
  return true;
}

/** Fuzzy match: яг таарна, дэд мөр, үгний эх, subsequence, нэг үсэг алдаа зөвшөөрнө */
function fuzzyMatch(text: string | undefined, query: string): boolean {
  if (!text || !query) return false;
  const t = text.toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return false;
  if (t.includes(q)) return true;
  const words = t.split(/\s+/);
  for (const w of words) {
    if (w.startsWith(q) || (q.length >= 2 && w.length >= 2 && q.startsWith(w.slice(0, 2)))) return true;
  }
  if (isSubsequence(t, q)) return true;
  if (q.length >= 3) {
    for (let skip = 0; skip < q.length; skip++) {
      const sub = q.slice(0, skip) + q.slice(skip + 1);
      if (isSubsequence(t, sub)) return true;
    }
  }
  return false;
}

export function HomeDashboard() {
  const { session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [posts, setPosts] = useState<UserPost[]>([]);
  const [topStudents, setTopStudents] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [imageUploading, setImageUploading] = useState(false);

  // Sync search from URL (e.g. from Topbar or shared link)
  useEffect(() => {
    const q = searchParams.get("search");
    if (q != null) setSearchQuery(q);
  }, [searchParams]);
  const [selectedGrade, setSelectedGrade] = useState("all");
  const [activeTab, setActiveTab] = useState<"feed" | "following" | "classroom">("feed");
  const [userXp, setUserXp] = useState<number | null>(null);
  const [xpMap, setXpMap] = useState<Record<string, number>>({});
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [reactingPostId, setReactingPostId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Array<{ id: string; type: string; message: string; createdAt: string; read: boolean }>>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    if (!session?.email) return;
    try {
      setLoadingNotifs(true);
      const res = await fetch("/api/notifications");
      const data = await res.json();
      if (data.ok) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount ?? 0);
      }
    } catch {
      // silent
    } finally {
      setLoadingNotifs(false);
    }
  }, [session?.email]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    }
    if (notifOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [notifOpen]);

  const markAllNotifsRead = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/mark-read", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setUnreadCount(0);
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      }
    } catch {}
  }, []);

  const clearAllNotifs = useCallback(async () => {
    if (!confirm("Бүх мэдэгдлийг устгах уу?")) return;
    try {
      const res = await fetch("/api/notifications/clear", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setNotifications([]);
        setUnreadCount(0);
      }
    } catch {}
  }, []);

  // Fetch user XP
  useEffect(() => {
    async function fetchUserXp() {
      if (!session?.email) return;
      try {
        const res = await fetch(`/api/user?email=${encodeURIComponent(session.email)}`);
        if (res.ok) {
          const data = await res.json();
          setUserXp(data.user?.experience ?? null);
        }
      } catch {}
    }
    fetchUserXp();
  }, [session]);

  // Calculate weekly XP goal (user's current XP as current, goal is current + 100)
  const weeklyXp = userXp !== null 
    ? { current: userXp, goal: Math.max(userXp + 100, 100) }
    : { current: 0, goal: 100 };

  // Fetch posts (first page)
  useEffect(() => {
    setHasMore(true);
    async function fetchPosts() {
      try {
        const gradeParam = selectedGrade !== "all" ? `&grade=${encodeURIComponent(selectedGrade)}` : "";
        const res = await fetch(`/api/posts?limit=10${gradeParam}`);
        if (res.ok) {
          const json = await res.json();
          const list = json.posts || [];
          setPosts(list);
          setHasMore(list.length >= 10);
        }
      } catch (err) {
        console.error("Failed to fetch posts:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchPosts();
  }, [selectedGrade]);

  async function loadOlderPosts() {
    if (loadingOlder || !hasMore || posts.length === 0) return;
    const lastPost = posts[posts.length - 1];
    const before = lastPost?.createdAt;
    if (!before) return;
    setLoadingOlder(true);
    try {
      const gradeParam = selectedGrade !== "all" ? `&grade=${encodeURIComponent(selectedGrade)}` : "";
      const res = await fetch(`/api/posts?limit=10&before=${encodeURIComponent(before)}${gradeParam}`);
      if (res.ok) {
        const json = await res.json();
        const list = json.posts || [];
        setPosts((prev) => [...prev, ...list]);
        setHasMore(list.length >= 10);
      }
    } catch (err) {
      console.error("Failed to load older posts:", err);
    } finally {
      setLoadingOlder(false);
    }
  }

  // Fetch top students and create XP map
  useEffect(() => {
    async function fetchTopStudents() {
      try {
        const res = await cachedFetch("/api/leaderboard");
        const json = await res.json();
        const leaderboard = json.leaderboard || [];
        setTopStudents(leaderboard.slice(0, 5));
        
        // Create XP map for post authors
        const map: Record<string, number> = {};
        leaderboard.forEach((u: LeaderboardUser) => {
          if (u.email) {
            map[u.email] = u.experience ?? 0;
          }
        });
        setXpMap(map);
      } catch (err) {
        console.error("Failed to fetch leaderboard:", err);
      }
    }
    fetchTopStudents();
  }, []);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const q = searchQuery.trim();
      const params = new URLSearchParams(searchParams.toString());
      if (q) params.set("search", q);
      else params.delete("search");
      router.push(`/?${params.toString()}`);
    }
  };

  // Filter posts by fuzzy search (гарчиг, тайлбар, зохиогч — дутуу/алдаатай бичихэд ч гарна)
  const filteredPosts = (() => {
    const q = searchQuery.trim();
    if (!q) return posts;
    return posts.filter(
      (p) =>
        fuzzyMatch(p.title, q) ||
        fuzzyMatch(p.description, q) ||
        fuzzyMatch(p.author, q) ||
        fuzzyMatch(p.authorEmail, q)
    );
  })();

  const reactionCounts = (post: UserPost) => ({
    fire: post.reactions.filter((r) => r.type === "FIRE").length,
    wow: post.reactions.filter((r) => r.type === "WOW").length,
    love: post.reactions.filter((r) => r.type === "LOVE").length,
    cool: post.reactions.filter((r) => r.type === "COOL").length,
  });

  const handleReaction = useCallback(
    async (postId: string, type: "FIRE" | "WOW" | "LOVE" | "COOL") => {
      if (!session?.email) {
        router.push("/login");
        return;
      }
      const post = posts.find((p) => p.id === postId);
      if (!post) return;

      const reactions = [...post.reactions];
      const idx = reactions.findIndex((r) => r.userEmail === session.email);
      const currentType = idx >= 0 ? reactions[idx].type : null;

      const nextReactions =
        currentType === type
          ? reactions.filter((_, i) => i !== idx)
          : idx >= 0
            ? reactions.map((r, i) => (i === idx ? { ...r, type } : r))
            : [...reactions, { userEmail: session.email, type }];

      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, reactions: nextReactions } : p))
      );
      setReactingPostId(postId);
      try {
        const res = await fetch(`/api/posts/react?id=${encodeURIComponent(postId)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setPosts((prev) =>
            prev.map((p) => (p.id === postId ? { ...p, reactions: post.reactions } : p))
          );
          alert(json.error || "Реакц хийхэд алдаа гарлаа");
          return;
        }
        // Optimistic state is already correct; server confirmed success
      } catch (err: any) {
        setPosts((prev) =>
          prev.map((p) => (p.id === postId ? { ...p, reactions: post.reactions } : p))
        );
        alert(err?.message || "Сүлжээний алдаа");
      } finally {
        setReactingPostId(null);
      }
    },
    [session?.email, posts, router]
  );

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setCreateError(null);
    setImageUploading(true);

    if (!file.type.startsWith("image/")) {
      setCreateError("Зураг файл сонгоно уу");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setCreateError("Зургийн хэмжээ 5MB-аас бага байх ёстой");
      return;
    }

    try {
      const localUrl = URL.createObjectURL(file);
      setImagePreview(localUrl);
    } catch {}

    try {
      const signRes = await fetch('/api/uploads/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: 'neoncanvas/posts' })
      });
      if (!signRes.ok) throw new Error('sign failed');
      const signJson = await signRes.json();
      if (!signJson?.ok) throw new Error('sign error');

      const { cloudName, apiKey, folder, timestamp, signature } = signJson;
      const form = new FormData();
      form.append('file', file);
      form.append('api_key', apiKey);
      form.append('timestamp', String(timestamp));
      form.append('signature', signature);
      form.append('folder', folder);

      const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: form
      });
      if (!uploadRes.ok) throw new Error('upload failed');
      const uploadJson = await uploadRes.json();
      if (!uploadJson?.secure_url) throw new Error('no secure_url');

      setImageUrl(uploadJson.secure_url as string);
      setImagePreview(uploadJson.secure_url as string);
      setImageUploading(false);
    } catch (err) {
      try {
        const reader = new FileReader();
        reader.onload = (event) => {
          const result = event.target?.result as string;
          setImagePreview(result);
          setImageUrl(result);
          setImageUploading(false);
        };
        reader.onerror = () => {
          setImageUploading(false);
          setCreateError("Зураг уншихад алдаа гарлаа");
        };
        reader.readAsDataURL(file);
      } catch (e) {
        setImageUploading(false);
        setCreateError("Зураг байршуулж чадсангүй");
      }
    }
  }

  async function handleCreatePost(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);

    if (imageUploading) {
      setCreateError("Зураг байршуулж дуусахаас өмнө түр хүлээнэ үү.");
      return;
    }

    if (title.trim().length < 3) {
      setCreateError("Гарчиг хамгийн багадаа 3 тэмдэгт байх ёстой");
      return;
    }

    if (description.trim().length < 10) {
      setCreateError("Тайлбар хамгийн багадаа 10 тэмдэгт байх ёстой");
      return;
    }

    setCreating(true);

    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description: description.trim(), imageUrl, visibility: 'PUBLIC' }),
      });

      if (!res.ok) {
        const json = await res.json();
        setCreateError(json.error || "Алдаа гарлаа");
        return;
      }

      const json = await res.json();
      setPosts([json.post, ...posts]);
      setTitle("");
      setDescription("");
      setImageUrl("");
      setImagePreview(null);
      setShowCreateForm(false);
    } catch (err: any) {
      setCreateError(err.message || "Сүлжээний алдаа гарлаа");
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      {/* Header */}
      <header className="flex items-center justify-between mb-8 gap-4">
        <div className="lg:hidden flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs">
            MV
          </div>
          <span className="font-bold text-white">Mind Verse</span>
        </div>
        <div className="hidden lg:block">
          <h2 className="text-2xl font-bold text-white">Dashboard</h2>
          <p className="text-slate-500 text-sm">Welcome back, get ready to create.</p>
        </div>
        <div className="flex items-center gap-4 flex-1 lg:flex-none justify-end">
          <div className="relative hidden md:block group">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-500 group-focus-within:text-primary-500 transition-colors text-[20px]">
              search
            </span>
            <input
              className={`bg-dark-800 border border-white/10 text-sm rounded-full pl-10 py-2.5 w-64 focus:w-80 transition-all outline-none text-white focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 placeholder-slate-600 ${searchQuery.trim() ? "pr-10" : "pr-4"}`}
              placeholder="Гарчиг, зохиогчоор хайх..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
            {searchQuery.trim() && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  const params = new URLSearchParams(searchParams.toString());
                  params.delete("search");
                  router.push(params.toString() ? `/?${params.toString()}` : "/");
                }}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-white transition-colors"
                aria-label="Хайлт цэвэрлэх"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )}
          </div>
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => session && setNotifOpen((o) => !o)}
              className="relative p-2.5 rounded-full bg-dark-800 border border-white/5 hover:bg-dark-700 transition-colors text-slate-400 hover:text-white"
              aria-label="Мэдэгдэл"
            >
              <span className="material-symbols-outlined text-[20px]">notifications</span>
              {session && unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 bg-rose-500 text-white text-[10px] font-bold rounded-full border-2 border-dark-800">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
            {notifOpen && session && (
              <div className="absolute right-0 mt-2 w-72 max-h-96 overflow-auto rounded-2xl bg-dark-900 border border-white/10 shadow-xl p-3 z-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-300">Мэдэгдэл</span>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={fetchNotifications} className="text-[10px] px-2 py-1 rounded-full bg-dark-700 hover:bg-dark-600 text-slate-300">
                      ↻
                    </button>
                    <button type="button" onClick={markAllNotifsRead} className="text-[10px] px-2 py-1 rounded-full bg-primary-600/40 hover:bg-primary-600 text-primary-200">
                      Уншсан
                    </button>
                    <button type="button" onClick={clearAllNotifs} className="text-[10px] px-2 py-1 rounded-full bg-red-600/40 hover:bg-red-600 text-red-100">
                      Устгах
                    </button>
                  </div>
                </div>
                {loadingNotifs && notifications.length === 0 && (
                  <div className="text-xs text-slate-500 py-4 text-center">Ачаалж байна...</div>
                )}
                {notifications.length === 0 && !loadingNotifs && (
                  <div className="text-xs text-slate-500 py-4 text-center">Мэдэгдэл алга</div>
                )}
                <ul className="space-y-2">
                  {notifications.map((n) => (
                    <li
                      key={n.id}
                      className={`rounded-xl px-3 py-2 text-xs flex flex-col gap-1 border transition-all ${
                        n.read ? "border-white/5 bg-dark-800/60" : "border-primary-500/40 bg-primary-950/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-200">
                          {n.type === "LIKE" && "👍 Like"}
                          {n.type === "GRADE" && "📝 Grade"}
                          {n.type === "CONTEST_WIN" && "🏆 Winner"}
                          {!["LIKE", "GRADE", "CONTEST_WIN"].includes(n.type) && "🔔"}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(n.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-300 leading-snug">{n.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <button
            onClick={() => router.push("/contests")}
            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-primary-600/20 to-indigo-600/20 border border-primary-500/30 text-primary-300 text-xs font-bold hover:bg-primary-600/30 transition-all"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>Create</span>
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-10 items-start">
        <div className="lg:col-span-8 relative rounded-3xl overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-950 to-violet-950"></div>
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
          <div className="absolute right-[-10%] top-[-20%] w-[400px] h-[400px] bg-primary-500/30 rounded-full blur-[80px]"></div>
          <div className="relative z-10 p-8 h-full flex flex-col justify-between min-h-[280px]">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 text-white border border-white/10 uppercase tracking-wide">
                  Daily Challenge
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                <span className="text-xs font-semibold text-green-400">Active Now</span>
              </div>
              <h1 className="text-3xl lg:text-5xl font-extrabold text-white leading-tight mb-4 max-w-2xl">
                Craft something <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-pink-400 glow-text">visually bold</span> today.
              </h1>
              <p className="text-indigo-200/80 max-w-lg text-lg mb-6">
                Post your latest graphic design work, react to others, earn XP and climb the leaderboard.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-white hover:bg-white/10 hover:border-primary-500/50 cursor-pointer transition-all">
                #Tear
              </span>
              <span className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-white hover:bg-white/10 hover:border-primary-500/50 cursor-pointer transition-all">
                #Yourself
              </span>
              <span className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-white hover:bg-white/10 hover:border-primary-500/50 cursor-pointer transition-all">
                #Destroy
              </span>
              <span className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-white hover:bg-white/10 hover:border-primary-500/50 cursor-pointer transition-all">
                #Blind
              </span>
            </div>
          </div>
        </div>

        {/* Weekly Goal & Share Progress */}
        <div className="lg:col-span-4">
          <div className="sticky top-8 flex flex-col gap-6 w-full">
            <div className="glass-card rounded-3xl p-6 relative overflow-hidden group hover:border-primary-500/30 transition-all">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-bold text-white text-lg">Weekly Goal</h3>
                  <p className="text-xs text-slate-400">3 days streak</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-gradient-to-b from-primary-500 to-indigo-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-white text-xl">local_fire_department</span>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-xs font-bold text-slate-300 mb-1">
                  <span>Your XP</span>
                  <span>
                    {userXp !== null ? Math.round(userXp).toLocaleString() : "0"} XP
                  </span>
                </div>
                {userXp !== null && (
                  <div className="w-full bg-dark-700 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-primary-500 to-pink-500 h-full rounded-full transition-all"
                      style={{ width: `${Math.min((userXp / weeklyXp.goal) * 100, 100)}%` }}
                    ></div>
                  </div>
                )}
              </div>
            </div>

            <div
              onClick={() => (session ? setShowCreateForm(true) : router.push("/login"))}
              className="glass-card rounded-3xl p-6 flex flex-col justify-center items-center text-center hover:bg-dark-800 transition-all cursor-pointer border-dashed border-2 border-dark-700 hover:border-primary-500/50"
            >
              <div className="w-12 h-12 rounded-full bg-dark-700 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-primary-400 text-2xl">add_photo_alternate</span>
              </div>
              <h3 className="font-bold text-white text-sm">Share Progress Drop</h3>
              <p className="text-xs text-slate-500 mt-1">
                {session ? "Drag & drop or click to upload" : "Нэвтэрч бүтээлээ хуваалцана уу"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Create Post Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-900 border border-white/5 rounded-3xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Create Post</h2>
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  setTitle("");
                  setDescription("");
                  setImageUrl("");
                  setImagePreview(null);
                  setCreateError(null);
                }}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>

            <form onSubmit={handleCreatePost} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-dark-800 border border-white/5 text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                  placeholder="Post title..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 rounded-lg bg-dark-800 border border-white/5 text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 resize-none"
                  placeholder="Describe your work..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Image</label>
                {imagePreview ? (
                  <div className="relative">
                    <img src={imagePreview} alt="Preview" className="w-full rounded-lg max-h-64 object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        setImagePreview(null);
                        setImageUrl("");
                      }}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-2 hover:bg-red-600 transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer flex items-center justify-center w-full h-32 border-2 border-dashed border-white/10 rounded-lg hover:border-primary-500/50 transition-colors">
                    <div className="text-center">
                      <span className="material-symbols-outlined text-4xl text-slate-400 mb-2">add_photo_alternate</span>
                      <p className="text-sm text-slate-400">Click to upload image</p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {createError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  <p className="text-sm text-red-400">{createError}</p>
                </div>
              )}

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setTitle("");
                    setDescription("");
                    setImageUrl("");
                    setImagePreview(null);
                    setCreateError(null);
                  }}
                  className="px-6 py-2 rounded-lg bg-dark-800 border border-white/5 text-slate-300 hover:bg-dark-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || imageUploading}
                  className="px-6 py-2 rounded-lg bg-gradient-to-r from-primary-500 to-purple-500 text-white font-medium hover:shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {creating || imageUploading ? "Publishing..." : "Publish"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Lightbox — зураг дарж томоор харах */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Зургийг томоор харах"
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Хаах"
          >
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
          <img
            src={lightbox.src}
            alt={lightbox.alt}
            className="max-w-full max-h-[90vh] w-auto h-auto object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Feed Section */}
        <div className="xl:col-span-8 space-y-6">
          {/* Feed Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-dark-900/50 backdrop-blur-sm p-2 rounded-2xl border border-white/5 sticky top-0 z-30 shadow-2xl shadow-black/50">
            <div className="flex items-center gap-1 overflow-x-auto hide-scrollbar">
              <button
                onClick={() => setActiveTab("feed")}
                className={`px-5 py-2 rounded-xl text-sm font-bold transition-colors ${
                  activeTab === "feed"
                    ? "bg-primary-600 text-white shadow-lg shadow-primary-500/20"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                Feed
              </button>
              <button
                onClick={() => setActiveTab("following")}
                className={`px-5 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === "following"
                    ? "bg-primary-600 text-white shadow-lg shadow-primary-500/20"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                Following
              </button>
              <button
                onClick={() => setActiveTab("classroom")}
                className={`px-5 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === "classroom"
                    ? "bg-primary-600 text-white shadow-lg shadow-primary-500/20"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                Classroom
              </button>
            </div>
            <div className="flex items-center gap-2 pr-2">
              <span className="text-xs text-slate-500 uppercase font-bold tracking-wider hidden sm:block">Filter:</span>
              <select
                className="bg-dark-800 border-none text-xs text-white font-medium rounded-lg py-1.5 pl-3 pr-8 focus:ring-1 focus:ring-primary-500/50 cursor-pointer"
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
              >
                <option value="all">All Grades</option>
                <option value="10">10th Grade</option>
                <option value="11">11th Grade</option>
                <option value="12">12th Grade</option>
              </select>
            </div>
          </div>

          {/* Posts */}
          {loading ? (
            <div className="text-center py-12 text-slate-500">Loading posts...</div>
          ) : filteredPosts.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              {searchQuery.trim()
                ? `"${searchQuery}" хайлтаар олдсон пост байхгүй.`
                : "No posts yet. Be the first to share!"}
            </div>
          ) : (
            filteredPosts.map((post) => {
              const reactions = reactionCounts(post);
              const myReaction = post.reactions.find((r) => r.userEmail === session?.email)?.type ?? null;
              const isReacting = reactingPostId === post.id;
              return (
                <article
                  key={post.id}
                  className="p-6 rounded-[32px] bg-dark-900 border border-white/5 shadow-sm hover:border-primary-500/30 transition-all duration-300"
                >
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          if (post.authorEmail && post.authorEmail !== "news-bot" && post.authorEmail !== "ai-assistant") {
                            router.push(`/profile?user=${encodeURIComponent(post.authorEmail)}`);
                          }
                        }}
                        className={`flex items-center gap-3 text-left rounded-xl transition-colors ${
                          post.authorEmail && post.authorEmail !== "news-bot" && post.authorEmail !== "ai-assistant"
                            ? "hover:bg-white/5 cursor-pointer"
                            : "cursor-default"
                        }`}
                        title={post.authorEmail && post.authorEmail !== "news-bot" && post.authorEmail !== "ai-assistant" ? `${post.author}-н profile харах` : undefined}
                      >
                        <div className="w-12 h-12 rounded-full bg-dark-800 flex items-center justify-center text-slate-300 font-bold text-lg border border-white/10 relative overflow-hidden shrink-0">
                          {post.authorEmail && (
                            <img
                              alt="User Avatar"
                              className="w-full h-full object-cover"
                              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(post.author)}&background=8b5cf6&color=fff`}
                            />
                          )}
                        </div>
                        <div>
                          <h3 className="font-bold text-white text-base">{post.author}</h3>
                          <p className="text-xs text-slate-500 font-medium mt-0.5">{formatRelativeTime(post.createdAt)}</p>
                        </div>
                      </button>
                    </div>
                    <div className="px-3 py-1 rounded-full border border-primary-500/20 bg-primary-500/10 text-primary-400 text-[11px] font-bold tracking-wide">
                      XP {xpMap[post.authorEmail] !== undefined ? Math.round(xpMap[post.authorEmail]) : 0}
                    </div>
                  </div>

                  <div className="mb-5">
                    <h2 className="text-xl font-bold text-white mb-2 leading-tight">{post.title}</h2>
                    <p className="text-slate-400 text-[15px] leading-relaxed font-light">{post.description}</p>
                  </div>

                  {post.imageUrl && (
                    <button
                      type="button"
                      onClick={() => setLightbox({ src: post.imageUrl!, alt: post.title })}
                      className="relative w-full rounded-2xl overflow-hidden mb-5 bg-dark-800 border border-white/5 group text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 pointer-events-none" />
                      <div className="aspect-[16/10] bg-gradient-to-br from-indigo-500/20 to-purple-500/20 relative">
                        <img
                          alt="Post Content"
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          src={post.imageUrl}
                        />
                      </div>
                      <span className="absolute bottom-3 right-3 z-20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/50 text-white text-xs font-medium">
                        <span className="material-symbols-outlined text-[16px]">fullscreen</span>
                        Томоор харах
                      </span>
                    </button>
                  )}

                  <div className="flex items-center gap-3 flex-wrap">
                    <button className="flex items-center gap-2 px-4 py-2 rounded-full bg-dark-800/50 border border-white/5 hover:bg-dark-700 hover:border-primary-500/30 transition-all group">
                      <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                      <span className="text-xs font-semibold text-slate-300 group-hover:text-white">0 comments</span>
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 rounded-full bg-dark-800/50 border border-white/5 hover:bg-dark-700 hover:border-primary-500/30 transition-all group">
                      <span className="material-symbols-outlined text-[16px] text-blue-400">ios_share</span>
                      <span className="text-xs font-semibold text-slate-300 group-hover:text-white">Share</span>
                    </button>
                    <div className="flex items-center gap-2 ml-auto sm:ml-0">
                      <button
                        type="button"
                        disabled={!session || isReacting}
                        onClick={() => handleReaction(post.id, "FIRE")}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-full bg-dark-800/50 border transition-all group disabled:opacity-60 disabled:pointer-events-none ${
                          myReaction === "FIRE" ? "border-orange-500/50 bg-orange-500/10" : "border-white/5 hover:bg-dark-700 hover:border-orange-500/30"
                        }`}
                      >
                        <span className="text-sm">🔥</span>
                        <span className={`text-xs font-bold ${myReaction === "FIRE" ? "text-orange-400" : "text-slate-400 group-hover:text-orange-400"}`}>{reactions.fire}</span>
                      </button>
                      <button
                        type="button"
                        disabled={!session || isReacting}
                        onClick={() => handleReaction(post.id, "WOW")}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-full bg-dark-800/50 border transition-all group disabled:opacity-60 disabled:pointer-events-none ${
                          myReaction === "WOW" ? "border-yellow-500/50 bg-yellow-500/10" : "border-white/5 hover:bg-dark-700 hover:border-yellow-500/30"
                        }`}
                      >
                        <span className="text-sm">😯</span>
                        <span className={`text-xs font-bold ${myReaction === "WOW" ? "text-yellow-400" : "text-slate-400 group-hover:text-yellow-400"}`}>{reactions.wow}</span>
                      </button>
                      <button
                        type="button"
                        disabled={!session || isReacting}
                        onClick={() => handleReaction(post.id, "LOVE")}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-full bg-dark-800/50 border transition-all group disabled:opacity-60 disabled:pointer-events-none ${
                          myReaction === "LOVE" ? "border-pink-500/50 bg-pink-500/10" : "border-white/5 hover:bg-dark-700 hover:border-pink-500/30"
                        }`}
                      >
                        <span className="text-sm">💖</span>
                        <span className={`text-xs font-bold ${myReaction === "LOVE" ? "text-pink-400" : "text-slate-400 group-hover:text-pink-400"}`}>{reactions.love}</span>
                      </button>
                      <button
                        type="button"
                        disabled={!session || isReacting}
                        onClick={() => handleReaction(post.id, "COOL")}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-full bg-dark-800/50 border transition-all group disabled:opacity-60 disabled:pointer-events-none ${
                          myReaction === "COOL" ? "border-emerald-500/50 bg-emerald-500/10" : "border-white/5 hover:bg-dark-700 hover:border-emerald-500/30"
                        }`}
                      >
                        <span className="text-sm">😎</span>
                        <span className={`text-xs font-bold ${myReaction === "COOL" ? "text-emerald-400" : "text-slate-400 group-hover:text-emerald-400"}`}>{reactions.cool}</span>
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-white/5">
                    <button className="flex items-center gap-3 w-full text-left group">
                      <span className="material-symbols-outlined text-slate-500 group-hover:text-slate-300 text-[20px] transition-colors">
                        chat_bubble_outline
                      </span>
                      <span className="text-sm text-slate-500 group-hover:text-slate-300 font-medium transition-colors">Add a comment...</span>
                    </button>
                  </div>
                </article>
              );
            })
          )}

          <div className="py-8 text-center">
            {hasMore ? (
              <button
                type="button"
                onClick={loadOlderPosts}
                disabled={loadingOlder}
                className="text-sm font-bold text-slate-500 hover:text-primary-400 transition-colors flex items-center justify-center gap-2 mx-auto disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span className={`material-symbols-outlined text-lg ${loadingOlder ? "animate-spin" : ""}`}>
                  {loadingOlder ? "refresh" : "expand_more"}
                </span>
                {loadingOlder ? "Уншиж байна..." : "Хуучин постууд"}
              </button>
            ) : (
              <p className="text-sm text-slate-500">Илүү пост байхгүй</p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="xl:col-span-4 space-y-6">
          <div className="sticky top-4 space-y-6">
            <LeaderboardSidebar compact />
            
            {/* Upcoming Deadlines */}
            <div className="bg-dark-900 border border-white/5 rounded-3xl p-6">
            <h3 className="font-bold text-white mb-4 text-sm">Upcoming Deadlines</h3>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="flex flex-col items-center justify-center w-10 h-12 bg-white/5 rounded-lg border border-white/10">
                  <span className="text-[9px] text-slate-500 uppercase font-bold">Feb</span>
                  <span className="text-sm font-bold text-white">24</span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200 leading-tight">Typography Final</h4>
                  <p className="text-[10px] text-slate-500 mt-1">11th Grade · 2 days left</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex flex-col items-center justify-center w-10 h-12 bg-white/5 rounded-lg border border-white/10">
                  <span className="text-[9px] text-slate-500 uppercase font-bold">Feb</span>
                  <span className="text-sm font-bold text-white">28</span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200 leading-tight">Logo Contest Sub.</h4>
                  <p className="text-[10px] text-slate-500 mt-1">Global · 6 days left</p>
                </div>
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-12 py-6 border-t border-white/5 text-center">
        <p className="text-[10px] text-slate-600">Mind Verse · Graphic Design Lab · 2025</p>
      </footer>
    </>
  );
}

