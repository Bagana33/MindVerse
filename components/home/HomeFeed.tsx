"use client";

import { useState, useEffect, useMemo } from "react";
import PostImage from "../posts/PostImage";
import ImageLightbox from "../posts/ImageLightbox";
import { useSession } from "../auth/useSession";
import { CommentsSection } from "../posts/CommentsSection";

type ReactionType = 'FIRE' | 'WOW' | 'LOVE';
type PostReaction = { userEmail: string; type: ReactionType };
type Comment = {
  id: string;
  postId: string;
  authorEmail: string;
  content: string;
  isAI: boolean;
  createdAt: string;
};
type UserPost = {
  id: string;
  title: string;
  description: string;
  author: string;
  authorEmail: string;
  points: number;
  createdAt: string;
  imageUrl?: string;
  reactions: PostReaction[];
  comments?: Comment[];
};

type FeedTab = "feed" | "trending" | "mine";

const feedTabs: { id: FeedTab; label: string; helper: string }[] = [
  { id: "feed", label: "Live feed", helper: "Realtime drops" },
  { id: "trending", label: "Trending", helper: "Most kudos" },
  { id: "mine", label: "My shots", helper: "Only you" },
];

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

function getInitials(name?: string) {
  if (!name) return "NC";
  const [first = "", second = ""] = name.split(" ");
  return `${first[0] ?? ""}${second[0] ?? ""}`.toUpperCase() || "NC";
}

export function HomeFeed() {
  const { session } = useSession();
  const [userPosts, setUserPosts] = useState<UserPost[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
  const [visibility, setVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [reactingPostId, setReactingPostId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FeedTab>("feed");
  const [searchQuery, setSearchQuery] = useState("");
  const [xpMap, setXpMap] = useState<Record<string, number>>({});
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [commentingPostId, setCommentingPostId] = useState<string | null>(null);
  const [showCommentBox, setShowCommentBox] = useState<Record<string, boolean>>({});
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});

  // Fetch leaderboard to map user experience
  useEffect(() => {
    async function fetchXp() {
      try {
        const res = await fetch('/api/leaderboard');
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.leaderboard)) {
            const map: Record<string, number> = {};
            json.leaderboard.forEach((u: any) => { if (u.email) map[u.email] = u.experience ?? 0; });
            setXpMap(map);
          }
        }
      } catch (e) { /* silent */ }
    }
    fetchXp();
  }, []);

  useEffect(() => {
    async function fetchPosts() {
      try {
        const res = await fetch("/api/posts?limit=20");
        if (res.ok) {
          const json = await res.json();
          const posts: UserPost[] = json.posts || [];
          setUserPosts(posts);
          setCursor(posts.length ? posts[posts.length - 1].createdAt : null);
          setHasMore(posts.length === 20);

          // Fetch comment counts in batch for labels
          const ids = posts.map(p => p.id).join(',');
          if (ids) {
            try {
              const cr = await fetch(`/api/posts/comments/counts?ids=${ids}`);
              if (cr.ok) {
                const cjson = await cr.json();
                setCommentCounts(cjson.counts || {});
              }
            } catch {}
          }
        }
      } catch (err) {
        console.error("Failed to fetch posts:", err);
      }
    }
    fetchPosts();
  }, []);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    if (!file.type.startsWith("image/")) {
      setError("Зураг файл сонгоно уу");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Зургийн хэмжээ 5MB-аас бага байх ёстой");
      return;
    }

    // Show instant local preview
    try {
      const localUrl = URL.createObjectURL(file);
      setImagePreview(localUrl);
    } catch {}

    // Try Cloudinary direct upload with server-side signature
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
      return;
    } catch (err) {
      // Fallback to base64 if Cloudinary not configured or upload failed
      try {
        const reader = new FileReader();
        reader.onload = (event) => {
          const result = event.target?.result as string;
          setImagePreview(result);
          setImageUrl(result);
        };
        reader.onerror = () => {
          setError("Зураг уншихад алдаа гарлаа");
        };
        reader.readAsDataURL(file);
      } catch (e) {
        setError("Зураг байршуулж чадсангүй");
      }
    }
  }

  async function handleCreatePost(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (title.trim().length < 3) {
      setError("Гарчиг хамгийн багадаа 3 тэмдэгт байх ёстой");
      return;
    }

    if (description.trim().length < 10) {
      setError("Тайлбар хамгийн багадаа 10 тэмдэгт байх ёстой");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description: description.trim(), imageUrl, visibility }),
      });

      if (!res.ok) {
        const json = await res.json();
        setError(json.error || "Алдаа гарлаа");
        return;
      }
      const json = await res.json();

      // Immediately fetch comments for the newly created post (to include AI critique if available)
      async function fetchCommentsOnce(postId: string) {
        try {
          const cr = await fetch(`/api/posts/comments?postId=${postId}`, { cache: "no-store" });
          if (cr.ok) {
            const cjson = await cr.json();
            return Array.isArray(cjson.comments) ? cjson.comments : [];
          }
        } catch (e) {
          // ignore
        }
        return [] as Comment[];
      }

      // Attach initial comments
      const initialComments = await fetchCommentsOnce(json.post.id);
      const postWithComments: UserPost = { ...json.post, comments: initialComments };
      setUserPosts([postWithComments, ...userPosts]);

      // Light polling for AI critique (in case it's added a moment later)
      // Try up to 5 times every 2s; update the post in place when AI comment appears
      let attempts = 0;
      const maxAttempts = 5;
      const interval = setInterval(async () => {
        attempts += 1;
        const latest = await fetchCommentsOnce(json.post.id);
        const hasAI = latest.some((c: any) => c.isAI);
        if (hasAI || attempts >= maxAttempts) {
          clearInterval(interval);
        }
        if (hasAI) {
          setUserPosts(curr => curr.map(p => p.id === json.post.id ? { ...p, comments: latest } : p));
        }
      }, 2000);

      setTitle("");
      setDescription("");
      setImageUrl("");
      setImagePreview(null);
      setShowCreateForm(false);
    } catch (err: any) {
      setError(err.message || "Сүлжээний алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeletePost(postId: string) {
    if (!confirm("Энэ постыг устгах уу?")) return;

    setDeletingPostId(postId);
    try {
      const res = await fetch(`/api/posts?id=${postId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const json = await res.json();
        alert(json.error || "Алдаа гарлаа");
        return;
      }

      setUserPosts(userPosts.filter((p) => p.id !== postId));
    } catch (err: any) {
      alert(err.message || "Сүлжээний алдаа гарлаа");
    } finally {
      setDeletingPostId(null);
    }
  }

  async function handleReaction(postId: string, type: ReactionType) {
    if (!session) return;

    setReactingPostId(postId);
    try {
      const res = await fetch(`/api/posts/react?id=${postId}`, {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      });
      if (!res.ok) {
        const text = await res.text();
        let errorMsg = "Алдаа гарлаа";
        try { errorMsg = JSON.parse(text).error || errorMsg; } catch {}
        alert(errorMsg);
        return;
      }
      const json = await res.json();
      setUserPosts(userPosts.map(p => {
        if (p.id !== postId) return p;
        const reactions = [...p.reactions];
        const idx = reactions.findIndex(r => r.userEmail === session.email);
        if (json.removed) {
          if (idx > -1) reactions.splice(idx, 1);
        } else if (json.updated) {
          if (idx > -1) reactions[idx] = { userEmail: session.email, type };
        } else if (json.added) {
          reactions.push({ userEmail: session.email, type });
        }
        return { ...p, reactions };
      }));
    } catch (err: any) {
      alert(err.message || "Сүлжээний алдаа гарлаа");
    } finally {
      setReactingPostId(null);
    }
  }

  async function loadMore() {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const url = cursor ? `/api/posts?limit=20&before=${encodeURIComponent(cursor)}` : `/api/posts?limit=20`;
      const res = await fetch(url);
      if (!res.ok) return;
      const json = await res.json();
      const more: UserPost[] = json.posts || [];
      if (more.length === 0) {
        setHasMore(false);
        return;
      }
      
      // Avoid duplicates by checking IDs
      setUserPosts(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const newPosts = more.filter(p => !existingIds.has(p.id));
        return [...prev, ...newPosts];
      });
      
      // Cursor is based on the last fetched post (not sorted), to maintain DB order
      setCursor(more[more.length - 1].createdAt || null);
      setHasMore(more.length === 20);
      
      const ids = more.map(p => p.id).join(',');
      if (ids) {
        try {
          const cr = await fetch(`/api/posts/comments/counts?ids=${ids}`);
          if (cr.ok) {
            const cjson = await cr.json();
            setCommentCounts(prev => ({ ...prev, ...(cjson.counts || {}) }));
          }
        } catch {}
      }
    } finally {
      setLoadingMore(false);
    }
  }

  const feedStats = useMemo(() => {
    if (!userPosts.length) {
      return {
        totalLikes: 0,
        uniqueCreators: 0,
        trending: null as UserPost | null,
        latest: null as UserPost | null,
        avgLikes: 0,
      };
    }

    const totalLikes = userPosts.reduce((sum, post) => sum + post.reactions.length, 0);
    const uniqueCreators = new Set(userPosts.map((post) => post.authorEmail)).size;
    const trending = [...userPosts].sort((a, b) => {
      const likeDiff = b.reactions.length - a.reactions.length;
      if (likeDiff !== 0) return likeDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })[0];
    const latest = [...userPosts].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];
    const avgLikes = userPosts.length ? totalLikes / userPosts.length : 0;

    return { totalLikes, uniqueCreators, trending, latest, avgLikes };
  }, [userPosts]);

  const highlightTags = useMemo(() => {
    const words = userPosts.flatMap((post) => post.description.split(/\s+/g));
    const sanitized = words
      .map((word) => word.replace(/[^a-zA-Z0-9#-]/g, ""))
      .filter((word) => word.length >= 4)
      .slice(0, 6);
    const curated = ["Neon UI", "Motion", "Gamified", "Figma", "3D"];
    const seen = new Set<string>();
    return [...sanitized, ...curated].filter((tag) => {
      const key = tag.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [userPosts]);

  const filteredPosts = useMemo(() => {
    let posts = [...userPosts];

    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      posts = posts.filter((post) =>
        `${post.title} ${post.description} ${post.author}`.toLowerCase().includes(query)
      );
    }

    if (activeTab === "mine") {
      posts = session ? posts.filter((post) => post.authorEmail === session.email) : [];
    }

    posts.sort((a, b) => {
      // News-bot постууд хамгийн дээр
      const aIsNewsBot = a.authorEmail === 'news-bot';
      const bIsNewsBot = b.authorEmail === 'news-bot';
      if (aIsNewsBot && !bIsNewsBot) return -1;
      if (!aIsNewsBot && bIsNewsBot) return 1;

      // Trending эрэмбэлэлт
      if (activeTab === "trending") {
        const likeDiff = b.reactions.length - a.reactions.length;
        if (likeDiff !== 0) return likeDiff;
      }
      // Үлдсэнийг огнооор
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return posts;
  }, [userPosts, activeTab, searchQuery, session]);

  const heroName = session?.name || session?.email?.split("@")[0] || "creator";
  const trendingPost = feedStats.trending;
  const emptyStateCopy = !userPosts.length
    ? "Платформ дээр эхний бүтээлээ хуваалцаарай."
    : activeTab === "mine"
    ? session
      ? "Таны өөрийн шот хараахан алга."
      : "Нэвтэрсний дараа өөрийн шотыг харах боломжтой."
    : "Энд тохирох үр дүн алга. Хайлт эсвэл табаа өөрчилнө үү.";

  return (
    <section className="space-y-6 max-w-3xl mx-auto">
      <div className="relative overflow-hidden rounded-3xl border border-slate-700/50 glass-panel px-6 py-8 shadow-[0_25px_55px_rgba(139,92,246,0.2)]">
        <div className="absolute -top-10 right-5 h-48 w-48 rounded-full bg-gradient-to-br from-violet-500/40 via-purple-500/30 to-sky-500/30 blur-[100px] animate-glow pointer-events-none" aria-hidden="true" />
        <div className="absolute -bottom-14 left-0 h-56 w-56 rounded-full bg-gradient-to-br from-sky-500/30 to-emerald-500/25 blur-[120px] animate-glow pointer-events-none" style={{ animationDelay: '1.5s' }} aria-hidden="true" />
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <p className="text-[11px] uppercase tracking-[0.4em] text-violet-400 font-semibold">✨ Mind Verse Feed</p>
            <h2 className="mt-2 text-3xl font-bold bg-gradient-to-r from-violet-200 via-purple-200 to-pink-200 bg-clip-text text-transparent neon-text">
              Craft something visually bold today, {heroName}.
            </h2>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              Шинэ график дизайн posting хийж реакц, XP цуглуулаад leaderboard дээр байр эзлээрэй.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-slate-400">
              {highlightTags.slice(0, 5).map((tag) => (
                <span key={tag} className="rounded-full border border-violet-500/20 bg-violet-500/5 hover:bg-violet-500/10 px-3 py-1.5 transition-all duration-300 cursor-pointer hover:border-violet-500/40">
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <div className="grid w-full grid-cols-2 gap-3 text-xs text-slate-300 sm:w-auto">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-[11px] text-slate-400">Shots today</p>
              <p className="text-lg font-semibold text-white">{userPosts.length}</p>
              <p className="text-[10px] text-slate-500">Live entries</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-[11px] text-slate-400">Creators</p>
              <p className="text-lg font-semibold text-white">{feedStats.uniqueCreators}</p>
              <p className="text-[10px] text-slate-500">Studio buzzing</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-[11px] text-slate-400">Reactions</p>
              <p className="text-lg font-semibold text-white">{feedStats.totalLikes}</p>
              <p className="text-[10px] text-slate-500">Community love</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-[11px] text-slate-400">Avg ❤️ / shot</p>
              <p className="text-lg font-semibold text-white">{feedStats.avgLikes.toFixed(1)}</p>
              <p className="text-[10px] text-slate-500">Momentum</p>
            </div>
          </div>
        </div>
      </div>

      {session && (
        <div className="rounded-3xl border border-slate-800 bg-slate-950/70 px-4 py-5 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-white">Share a progress drop</p>
              <p className="text-xs text-slate-400">Фийд дээр шууд нийтлээд санаагаа баталгаажуул.</p>
            </div>
            {!showCreateForm && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="rounded-full border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-200 hover:bg-violet-500/30"
              >
                New post
              </button>
            )}
          </div>

          {!showCreateForm ? (
            <div className="mt-4 flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-violet-500 text-sm font-semibold">
                {session.name?.[0]?.toUpperCase() || session.email[0]?.toUpperCase() || "U"}
              </div>
              <button
                onClick={() => setShowCreateForm(true)}
                className="flex-1 rounded-2xl border border-slate-800/80 bg-slate-900/70 px-4 py-3 text-left text-sm text-slate-400 hover:border-violet-500/30 hover:text-slate-200"
              >
                Юу дээр ажиллаж байгаа вэ? Фигма линк, тайлбар эсвэл зураг хавсаргаарай.
              </button>
            </div>
          ) : (
            <form onSubmit={handleCreatePost} className="mt-4 space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-violet-500 text-sm font-semibold">
                  {session.name?.[0]?.toUpperCase() || session.email[0]?.toUpperCase() || "U"}
                </div>
                <div className="flex-1 space-y-3">
                  <input
                    type="text"
                    required
                    minLength={3}
                    maxLength={200}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Give your drop a bold title"
                    className="w-full rounded-xl border border-transparent bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-500/40 focus:outline-none"
                  />
                  <textarea
                    required
                    minLength={10}
                    maxLength={2000}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    placeholder="Тайлбар, хэрэгслийн тухай болон ямар фийдбэк хэрэгтэйгээ бичээрэй."
                    className="w-full rounded-xl border border-transparent bg-slate-900/60 px-3 py-2 text-sm text-slate-300 placeholder:text-slate-500 focus:border-violet-500/40 focus:outline-none"
                  />
                </div>
              </div>

              <div className="ml-12 sm:ml-14 flex items-center gap-3 text-sm">
                <label className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${visibility === 'PUBLIC' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' : 'bg-slate-900/60 border border-slate-800 text-slate-300'}`}>
                  <input type="radio" name="visibility" checked={visibility === 'PUBLIC'} onChange={() => setVisibility('PUBLIC')} className="hidden" />
                  Public
                </label>
                <label className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${visibility === 'PRIVATE' ? 'bg-rose-500/10 border border-rose-500/30 text-rose-300' : 'bg-slate-900/60 border border-slate-800 text-slate-300'}`}>
                  <input type="radio" name="visibility" checked={visibility === 'PRIVATE'} onChange={() => setVisibility('PRIVATE')} className="hidden" />
                  Private
                </label>
                <div className="text-xs text-slate-400">Private posts are visible only to you</div>
              </div>

              {imagePreview && (
                <div className="relative ml-12 sm:ml-14">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="max-h-72 w-full rounded-2xl border border-slate-800 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setImagePreview(null);
                      setImageUrl("");
                      setError(null);
                    }}
                    className="absolute top-3 right-3 rounded-full bg-slate-950/80 px-2 py-1 text-xs text-white hover:bg-slate-800"
                  >
                    Remove
                  </button>
                </div>
              )}

              {error && <p className="ml-12 text-xs text-red-400 sm:ml-14">{error}</p>}

              <div className="ml-12 flex flex-col gap-3 border-t border-slate-800 pt-3 sm:ml-14 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-slate-400">
                  Contest: <span className="text-slate-200">Studio freestyle</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500">
                    Upload
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                  <button
                    type="button"
                    className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                    onClick={() => {
                      setShowCreateForm(false);
                      setTitle("");
                      setDescription("");
                      setImageUrl("");
                      setImagePreview(null);
                      setError(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-1.5 text-xs font-medium text-white shadow-[0_4px_16px_rgba(139,92,246,0.4)] hover:shadow-[0_6px_20px_rgba(139,92,246,0.6)] disabled:opacity-60"
                  >
                    {loading ? "Publishing..." : "Publish"}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      )}

      <div className="rounded-3xl border border-slate-800 bg-slate-900/50 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          {feedTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-2xl px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === tab.id
                  ? "bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-[0_4px_12px_rgba(139,92,246,0.4)]"
                  : "border border-transparent bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200"
              }`}
            >
              <div className="flex flex-col leading-tight">
                <span>{tab.label}</span>
                <span className="text-[10px] font-normal text-slate-400">{tab.helper}</span>
              </div>
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1.5 text-xs text-slate-200 focus-within:border-violet-500/40">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-slate-500"
            >
              <path
                d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M21 21L16.65 16.65" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search titles, tools, people..."
              className="flex-1 bg-transparent text-slate-200 placeholder:text-slate-500 focus:outline-none"
            />
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Live sync
          </div>
          <span className="text-[11px] text-slate-500">{feedStats.totalLikes} reactions captured</span>
        </div>
      </div>

      {trendingPost && (
        <div className="grid gap-4 md:grid-cols-[1.6fr,1fr]">
          <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 to-slate-900 px-5 py-5 shadow-[0_15px_40px_rgba(0,0,0,0.45)]">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.3em] text-slate-500">
              <span>Featured</span>
              <span>{formatRelativeTime(trendingPost.createdAt)}</span>
            </div>
            <h3 className="mt-3 text-xl font-semibold text-white">{trendingPost.title}</h3>
            <p className="mt-2 text-sm text-slate-300">{trendingPost.description}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-300">
              <span className="rounded-full border border-violet-500/40 bg-violet-500/10 px-3 py-1">
                ❤️ {trendingPost.reactions.length} kudos
              </span>
              <span className="rounded-full border border-slate-700 px-3 py-1">✨ {trendingPost.author}</span>
            </div>
            <button
              onClick={() => {
                setActiveTab("feed");
                setSearchQuery(trendingPost.title);
              }}
              className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-1.5 text-xs text-white hover:bg-white/10"
            >
              Jump to post →
            </button>
          </div>
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 px-5 py-5">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Studio pulse</p>
            <div className="mt-3 space-y-3 text-xs text-slate-300">
              <div className="flex items-center justify-between rounded-2xl border border-slate-800/70 bg-slate-950/60 px-3 py-2">
                <span>Latest ship</span>
                <span>{feedStats.latest ? formatRelativeTime(feedStats.latest.createdAt) : "—"}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-slate-800/70 bg-slate-950/60 px-3 py-2">
                <span>Active creators</span>
                <span>{feedStats.uniqueCreators}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-slate-800/70 bg-slate-950/60 px-3 py-2">
                <span>Reactions today</span>
                <span>{feedStats.totalLikes}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {filteredPosts.length === 0 && (
          <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-900/40 px-6 py-10 text-center text-sm text-slate-400">
            {emptyStateCopy}
          </div>
        )}

        {filteredPosts.map((post) => (
          <article
            key={post.id}
            className="relative overflow-hidden rounded-3xl border border-slate-700/50 glass-panel glass-panel-hover px-4 py-5 shadow-[0_12px_40px_rgba(0,0,0,0.45)] sm:px-6 group"
          >
            <div className="absolute inset-0 rounded-3xl border border-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" aria-hidden="true" />
            <header className="relative flex items-start gap-3">
              <button
                onClick={() => {
                  if (post.authorEmail !== 'news-bot' && post.authorEmail !== 'ai-assistant') {
                    window.location.href = `/profile?user=${encodeURIComponent(post.authorEmail)}`;
                  }
                }}
                disabled={post.authorEmail === 'news-bot' || post.authorEmail === 'ai-assistant'}
                className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-lg group-hover:shadow-xl transition-all ${
                  post.authorEmail === 'news-bot' 
                    ? 'bg-gradient-to-br from-cyan-500 via-blue-500 to-purple-500' 
                    : 'bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900'
                } ${post.authorEmail !== 'news-bot' && post.authorEmail !== 'ai-assistant' ? 'cursor-pointer hover:scale-110 hover:ring-2 hover:ring-violet-400/50' : 'cursor-default'}`}
                title={post.authorEmail !== 'news-bot' && post.authorEmail !== 'ai-assistant' ? `${post.author}-н profile харах` : ''}
              >
                {post.authorEmail === 'news-bot' ? '📰' : getInitials(post.author || post.authorEmail)}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="truncate text-sm font-bold text-slate-100">{post.author}</div>
                      {post.authorEmail === 'news-bot' && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-300 font-medium">
                          🤖 Мэдээ
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500">{formatRelativeTime(post.createdAt)}</div>
                    {session && post.authorEmail === session.email && (
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300 font-medium">
                        ✓ Таны пост
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-emerald-300 font-semibold">
                      XP {xpMap[post.authorEmail] ?? 0}
                    </span>
                    {session && post.authorEmail === session.email && post.authorEmail !== 'news-bot' && (
                      <button
                        onClick={() => handleDeletePost(post.id)}
                        disabled={deletingPostId === post.id}
                        className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[10px] text-red-300 hover:bg-red-500/20 disabled:opacity-60 transition-all"
                      >
                        {deletingPostId === post.id ? "⏳" : "🗑️ Устгах"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </header>

            <h3 className="mt-4 text-lg font-bold text-white leading-snug">{post.title}</h3>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-300">{post.description}</p>

            {post.imageUrl && (
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => setLightbox({ src: post.imageUrl!, alt: post.title })}
                  className="inline-block focus:outline-none focus:ring-2 focus:ring-violet-500/50 rounded-2xl"
                >
                  <PostImage src={post.imageUrl} alt={post.title} className="!w-auto" />
                </button>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700/50 bg-slate-800/30 px-3 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
                {typeof commentCounts[post.id] === 'number' ? `${commentCounts[post.id]} comments` : 'Open for feedback'}
              </span>
              {/* Reaction bar */}
              {(() => {
                const userReaction = session ? post.reactions.find(r => r.userEmail === session.email)?.type : null;
                const counts = {
                  FIRE: post.reactions.filter(r => r.type === 'FIRE').length,
                  WOW: post.reactions.filter(r => r.type === 'WOW').length,
                  LOVE: post.reactions.filter(r => r.type === 'LOVE').length,
                };
                const buttons: { type: ReactionType; label: string; emoji: string; color: string }[] = [
                  { type: 'FIRE', label: 'gal', emoji: '🔥', color: 'from-orange-500 to-red-500' },
                  { type: 'WOW', label: 'wow', emoji: '😮', color: 'from-yellow-400 to-amber-500' },
                  { type: 'LOVE', label: 'love', emoji: '💖', color: 'from-pink-500 to-fuchsia-500' },
                ];
                return (
                  <div className="flex items-center gap-2">
                    {buttons.map(b => {
                      const active = userReaction === b.type;
                      return (
                        <button
                          key={b.type}
                          onClick={() => handleReaction(post.id, b.type)}
                          disabled={!session || reactingPostId === post.id}
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all duration-300 border ${active
                            ? `bg-gradient-to-r ${b.color} text-white border-transparent shadow-[0_0_16px_rgba(255,255,255,0.25)] scale-[1.05]`
                            : `border-slate-700 bg-slate-800/50 text-slate-300 hover:border-violet-500/40 hover:bg-slate-700/60 hover:text-white`}`}
                          title={session ? `${b.label} reaction` : 'Нэвтэрч орно уу'}
                        >
                          <span>{b.emoji}</span>
                          <span>{counts[b.type] || 0}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
            {/* Comments Section */}
            <CommentsSection
              postId={post.id}
              comments={post.comments}
              onCommentAdded={(newComment) => {
                setUserPosts(userPosts.map(p =>
                  p.id === post.id
                    ? { ...p, comments: [...(p.comments || []), newComment] }
                    : p
                ));
              }}
            />
          </article>
        ))}
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center mt-6">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="px-4 py-2 rounded-lg text-xs font-medium bg-slate-900/60 border border-slate-700 text-slate-300 hover:border-violet-500/40 hover:text-slate-100 disabled:opacity-60"
          >
            {loadingMore ? 'Уншиж байна…' : 'Илүү ачаалах'}
          </button>
        </div>
      )}

    {lightbox && (
      <ImageLightbox
        src={lightbox.src}
        alt={lightbox.alt}
        caption={lightbox.alt}
        onClose={() => setLightbox(null)}
      />
    )}
    </section>
  );
}
