"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "../auth/useSession";
import { BrandLogo } from "../layout/BrandLogo";
import { CommentsSection } from "../posts/CommentsSection";
import { cachedFetch } from "../../lib/fetchCache";
import { compressImageFile } from "../../lib/imageCompressor";
import { FakeClientPanel } from "./FakeClientPanel";

type Comment = {
  id: string;
  postId: string;
  authorEmail: string;
  content: string;
  isAI: boolean;
  parentCommentId?: string | null;
  createdAt: string;
};

type UserPost = {
  id: string;
  title: string;
  description: string;
  author: string;
  authorEmail: string;
  authorAvatarUrl?: string;
  authorAvatarColor?: string;
  points: number;
  createdAt: string;
  imageUrl?: string;
  reactions: Array<{ userEmail: string; type: string }>;
  comments?: Comment[];
};

type LeaderboardUser = {
  email: string;
  name?: string;
  nickname?: string;
  avatarUrl?: string;
  avatarColor?: string;
  experience: number;
};

type GradeFilter = "all" | "10" | "11" | "12";

const gradeFilters: Array<{ value: GradeFilter; label: string; shortLabel: string }> = [
  { value: "all", label: "All Grades", shortLabel: "All" },
  { value: "10", label: "10th Grade", shortLabel: "10" },
  { value: "11", label: "11th Grade", shortLabel: "11" },
  { value: "12", label: "12th Grade", shortLabel: "12" },
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

/** Accurate search matching:
 * Checks if all query keywords are present in post title, description, author, email or comments.
 */
function searchMatch(post: UserPost, query: string): boolean {
  if (!query || !query.trim()) return true;
  const q = query.toLowerCase().trim();
  const tokens = q.split(/\s+/).filter(Boolean);

  const searchableText = [
    post.title || "",
    post.description || "",
    post.author || "",
    post.authorEmail || "",
    ...(post.comments || []).map(c => c.content || "")
  ].join(" ").toLowerCase();

  return tokens.every(token => searchableText.includes(token));
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
  const [selectedGrade, setSelectedGrade] = useState<GradeFilter>("all");
  const [isFilterLoading, setIsFilterLoading] = useState(false);
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
  const [copiedPostId, setCopiedPostId] = useState<string | null>(null);
  const [openCommentsPostId, setOpenCommentsPostId] = useState<string | null>(null);
  // tracks detected aspect ratio per post image: 'portrait' | 'landscape' | 'square'
  const [imgOrientations, setImgOrientations] = useState<Record<string, 'portrait' | 'landscape' | 'square'>>({});

  const handleImgLoad = (postId: string, e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
    const ratio = w / h;
    let orient: 'portrait' | 'landscape' | 'square';
    if (ratio < 0.85)       orient = 'portrait';   // taller than wide
    else if (ratio > 1.25)  orient = 'landscape';  // wider than tall
    else                    orient = 'square';      // roughly square
    setImgOrientations(prev => ({ ...prev, [postId]: orient }));
  };

  const handleSharePost = async (postId: string, title: string, description: string) => {
    const shareText = `${title}${description ? `\n\n${description}` : ''}`;
    const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/?post=${postId}` : '';
    
    if (navigator.share) {
      try {
        await navigator.share({ title, text: shareText, url: shareUrl });
        return;
      } catch {}
    }
    
    try {
      await navigator.clipboard.writeText(`${shareText}\n\n${shareUrl}`);
      setCopiedPostId(postId);
      setTimeout(() => setCopiedPostId(null), 2500);
    } catch {
      alert("Хуваалцах боломжгүй байна");
    }
  };
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
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

  async function fetchCommentCounts(postIds: string[]) {
    if (postIds.length === 0) return;
    try {
      const res = await fetch(`/api/posts/comments/counts?ids=${postIds.map(encodeURIComponent).join(",")}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setCommentCounts((prev) => ({ ...prev, ...(data.counts || {}) }));
      }
    } catch {
      // Counts are secondary; comments can still load per post.
    }
  }

  async function fetchPostComments(postId: string): Promise<Comment[]> {
    try {
      const res = await fetch(`/api/posts/comments?postId=${encodeURIComponent(postId)}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data.comments) ? data.comments : [];
      }
    } catch {
      // The post can still render; comments can be loaded manually.
    }
    return [];
  }

  // Fetch posts (first page)
  useEffect(() => {
    const controller = new AbortController();
    setHasMore(true);
    setIsFilterLoading(true);
    setLoading(true);

    async function fetchPosts() {
      try {
        const gradeParam = selectedGrade !== "all" ? `&grade=${encodeURIComponent(selectedGrade)}` : "";
        const searchParam = searchQuery.trim() ? `&search=${encodeURIComponent(searchQuery.trim())}` : "";
        const res = await fetch(`/api/posts?limit=10${gradeParam}${searchParam}`, { signal: controller.signal });
        if (res.ok) {
          const json = await res.json();
          const list = json.posts || [];
          setPosts(list);
          setCommentCounts({});
          await fetchCommentCounts(list.map((post: UserPost) => post.id));
          setHasMore(list.length >= 10);
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Failed to fetch posts:", err);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setIsFilterLoading(false);
        }
      }
    }

    fetchPosts();

    return () => {
      controller.abort();
    };
  }, [selectedGrade, searchQuery]);

  async function loadOlderPosts() {
    if (loadingOlder || !hasMore || posts.length === 0 || isFilterLoading) return;
    const lastPost = posts[posts.length - 1];
    const before = lastPost?.createdAt;
    if (!before) return;
    setLoadingOlder(true);
    try {
      const gradeParam = selectedGrade !== "all" ? `&grade=${encodeURIComponent(selectedGrade)}` : "";
      const searchParam = searchQuery.trim() ? `&search=${encodeURIComponent(searchQuery.trim())}` : "";
      const res = await fetch(`/api/posts?limit=10&before=${encodeURIComponent(before)}${gradeParam}${searchParam}`);
      if (res.ok) {
        const json = await res.json();
        const list = json.posts || [];
        setPosts((prev) => [...prev, ...list]);
        await fetchCommentCounts(list.map((post: UserPost) => post.id));
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
        setTopStudents(leaderboard.slice(0, 15));
        
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

  // Filter posts by search query (гарчиг, тайлбар, зохиогч, мэйлээр хайх)
  const filteredPosts = (() => {
    const q = searchQuery.trim();
    if (!q) return posts;
    return posts.filter((p) => searchMatch(p, q));
  })();

  const reactionCounts = (post: UserPost) => ({
    fire: post.reactions.filter((r) => r.type === "FIRE").length,
    wow: post.reactions.filter((r) => r.type === "WOW").length,
    love: post.reactions.filter((r) => r.type === "LOVE").length,
    cool: post.reactions.filter((r) => r.type === "COOL").length,
    star: post.reactions.filter((r) => r.type === "STAR").length,
  });

  const handleReaction = useCallback(
    async (postId: string, type: "FIRE" | "WOW" | "LOVE" | "COOL" | "STAR") => {
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

      // 1. Instant optimistic state update (0ms latency)
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, reactions: nextReactions } : p))
      );

      // 2. Non-blocking background API call
      fetch(`/api/posts/react?id=${encodeURIComponent(postId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      }).then(async (res) => {
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          // Rollback on failure
          setPosts((prev) =>
            prev.map((p) => (p.id === postId ? { ...p, reactions: post.reactions } : p))
          );
          console.error("Reaction failed:", json.error);
        }
      }).catch((err) => {
        setPosts((prev) =>
          prev.map((p) => (p.id === postId ? { ...p, reactions: post.reactions } : p))
        );
        console.error("Reaction network error:", err);
      });
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
        const compressedBase64 = await compressImageFile(file, 1200, 0.75);
        setImagePreview(compressedBase64);
        setImageUrl(compressedBase64);
        setImageUploading(false);
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
      const postId = json.post.id;
      const initialComments = await fetchPostComments(postId);
      const postWithComments: UserPost = { ...json.post, comments: initialComments };

      setPosts((prev) => [postWithComments, ...prev]);
      setCommentCounts((prev) => ({ ...prev, [postId]: initialComments.length }));

      let attempts = 0;
      const pollForAIComment = window.setInterval(async () => {
        attempts += 1;
        const comments = await fetchPostComments(postId);
        const hasAIComment = comments.some((comment) => comment.isAI);

        if (comments.length > 0) {
          setPosts((prev) =>
            prev.map((post) =>
              post.id === postId ? { ...post, comments } : post
            )
          );
          setCommentCounts((prev) => ({ ...prev, [postId]: comments.length }));
        }

        if (hasAIComment || attempts >= 6) {
          window.clearInterval(pollForAIComment);
        }
      }, 2000);

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
          {/* Featured Top Creators Stories Bar */}
          <div className="rounded-3xl border border-white/10 bg-dark-900/80 backdrop-blur-md p-4 shadow-xl overflow-hidden relative group/stories">
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                  <span>✨ Онцлох сурагчид</span>
                </h3>
              </div>
              <Link href="/leaderboard" className="text-[11px] font-semibold text-primary-400 hover:text-primary-300 transition-colors">
                Бүгдийг харах →
              </Link>
            </div>

            <div className="flex items-center gap-4 overflow-x-auto no-scrollbar py-2 px-1 scroll-smooth">
              {/* Logged-in User "Add Story / Post" circle */}
              <div
                className="flex flex-col items-center gap-1.5 shrink-0 group/story cursor-pointer"
                onClick={() => setShowCreateForm(true)}
              >
                <div className="relative p-[2.5px] rounded-full bg-gradient-to-tr from-slate-700 to-slate-800 group-hover/story:from-violet-500 group-hover/story:to-pink-500 transition-all duration-300">
                  <div className="w-16 h-16 rounded-full border-2 border-dark-900 bg-dark-800 flex items-center justify-center relative overflow-hidden">
                    {session?.avatarUrl ? (
                      <img src={session.avatarUrl} alt="Your story" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-slate-300 font-bold text-lg">
                        {(session?.nickname || session?.name || session?.email || "U")[0]?.toUpperCase()}
                      </span>
                    )}
                    <div className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-primary-500 border-2 border-dark-900 flex items-center justify-center text-white text-[12px] font-bold">
                      +
                    </div>
                  </div>
                </div>
                <span className="text-[11px] font-medium text-slate-400 group-hover/story:text-white truncate max-w-[70px]">
                  Таных
                </span>
              </div>

              {/* Top Featured Creators Stories */}
              {topStudents.map((student, idx) => {
                const displayName = student.nickname || student.name || student.email.split("@")[0];
                return (
                  <button
                    key={student.email}
                    type="button"
                    onClick={() => router.push(`/profile?user=${encodeURIComponent(student.email)}`)}
                    className="flex flex-col items-center gap-1.5 shrink-0 group/story cursor-pointer focus:outline-none"
                    title={`${displayName} · ${student.experience || 0} XP`}
                  >
                    {/* Instagram-style colorful gradient ring */}
                    <div className="relative p-[2.5px] rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 transition-transform duration-300 group-hover/story:scale-105 group-hover/story:shadow-[0_0_15px_rgba(236,72,153,0.5)]">
                      <div
                        className="w-16 h-16 rounded-full border-2 border-dark-900 bg-dark-800 flex items-center justify-center overflow-hidden relative"
                        style={{ backgroundColor: student.avatarColor || undefined }}
                      >
                        {student.avatarUrl ? (
                          <img
                            src={student.avatarUrl}
                            alt={displayName}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        ) : (
                          <span className="text-white font-bold text-lg">
                            {displayName[0]?.toUpperCase()}
                          </span>
                        )}
                      </div>
                      {/* Rank badge for top creators */}
                      {idx < 3 && (
                        <span className={`absolute -bottom-1 -right-1 text-[10px] font-black px-1.5 py-0.2 rounded-full border border-dark-900 shadow-md ${
                          idx === 0 ? "bg-amber-400 text-slate-950" : idx === 1 ? "bg-slate-300 text-slate-950" : "bg-amber-700 text-white"
                        }`}>
                          #{idx + 1}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-medium text-slate-300 group-hover/story:text-white truncate max-w-[72px]">
                      {displayName}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grade filter */}
          <div className="bg-dark-900/70 backdrop-blur-sm p-3 rounded-2xl border border-white/10 sticky top-0 z-30 shadow-2xl shadow-black/50">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400 font-bold">Filter By Grade</p>
                <p className="text-xs text-slate-500 mt-1">Showing: {gradeFilters.find((g) => g.value === selectedGrade)?.label}</p>
              </div>
              {selectedGrade !== "all" && (
                <button
                  type="button"
                  onClick={() => setSelectedGrade("all")}
                  disabled={isFilterLoading}
                  className="text-[11px] px-3 py-1.5 rounded-full border border-white/10 text-slate-300 hover:text-white hover:border-primary-500/40 transition-colors disabled:opacity-60"
                >
                  Reset
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {gradeFilters.map((grade) => {
                const active = selectedGrade === grade.value;
                return (
                  <button
                    key={grade.value}
                    type="button"
                    onClick={() => setSelectedGrade(grade.value)}
                    disabled={isFilterLoading && !active}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
                      active
                        ? "bg-gradient-to-r from-primary-500 to-indigo-500 text-white border-primary-400/30 shadow-[0_8px_20px_rgba(99,102,241,0.35)]"
                        : "bg-dark-800/80 text-slate-300 border-white/10 hover:border-primary-500/40 hover:text-white"
                    } disabled:opacity-60 disabled:cursor-not-allowed`}
                  >
                    {grade.shortLabel}
                  </button>
                );
              })}

              {isFilterLoading && (
                <span className="text-xs text-slate-400 inline-flex items-center gap-1.5 ml-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-pulse" />
                  Loading...
                </span>
              )}
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
              // Image orientation derived from loaded dimensions
              const imgOrient = imgOrientations[post.id] ?? 'square';
              const imgAspectClass =
                imgOrient === 'portrait'  ? 'aspect-[4/5]  max-h-[640px]' :
                imgOrient === 'landscape' ? 'aspect-[16/9] max-h-[420px]' :
                                            'aspect-square  max-h-[600px]';
              const imgOrientLabel =
                imgOrient === 'portrait' ? 'Босоо' : imgOrient === 'landscape' ? 'Хэвтээ' : 'Квадрат';
              const imgOrientIcon =
                imgOrient === 'portrait' ? 'crop_portrait' : imgOrient === 'landscape' ? 'crop_landscape' : 'crop_square';
              return (
                <article
                  key={post.id}
                  className="rounded-2xl bg-nc-panel border border-nc-border/50 shadow-[0_4px_24px_rgba(0,0,0,0.7)] overflow-hidden transition-all duration-500 hover:border-primary-500/60 hover:shadow-[0_8px_40px_rgba(139,92,246,0.22)] group/card"
                >
                  {/* ── Image + overlaid header ───────────────────── */}
                  <div className="relative w-full">
                    {post.imageUrl ? (
                      <button
                        type="button"
                        onClick={() => setLightbox({ src: post.imageUrl!, alt: post.title })}
                        className={`relative w-full ${imgAspectClass} overflow-hidden cursor-zoom-in text-left block focus:outline-none group/photo transition-all duration-500`}
                      >
                        {/* Main image — detect orientation on load */}
                        <img
                          src={post.imageUrl}
                          alt={post.title}
                          onLoad={(e) => handleImgLoad(post.id, e)}
                          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover/photo:scale-[1.06]"
                        />
                        {/* Layer 1: top gradient */}
                        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent via-40% to-black/50 pointer-events-none" />
                        {/* Layer 2: violet shimmer on hover */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-primary-600/20 via-transparent to-pink-500/10 opacity-0 group-hover/photo:opacity-100 transition-opacity duration-500 pointer-events-none mix-blend-screen" />
                        {/* Layer 3: bottom vignette */}
                        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
                        {/* Orientation badge — bottom left */}
                        <span className="absolute bottom-4 left-4 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border border-white/15 bg-black/50 backdrop-blur-md text-white/70 opacity-0 group-hover/photo:opacity-100 transition-opacity duration-300">
                          <span className="material-symbols-outlined text-[12px]">{imgOrientIcon}</span>
                          {imgOrientLabel}
                        </span>
                        {/* Zoom pill — bottom right */}
                        <span className="absolute bottom-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md text-white/90 text-xs font-semibold border border-white/15 shadow-lg translate-y-2 opacity-0 group-hover/photo:opacity-100 group-hover/photo:translate-y-0 transition-all duration-300">
                          <span className="material-symbols-outlined text-[15px]">zoom_in</span>
                          Томоор харах
                        </span>
                        {/* Violet ring on hover */}
                        <div className="absolute inset-0 ring-0 group-hover/photo:ring-2 ring-primary-500/40 transition-all duration-300 pointer-events-none" />
                      </button>
                    ) : (
                      <div className="h-0" />
                    )}

                    {/* ── Overlaid header (top-left) ── */}
                    <div className={`${post.imageUrl ? "absolute top-0 left-0 right-0" : "relative bg-nc-panel border-b border-nc-border/40"} flex items-center justify-between px-4 py-3`}>
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Avatar with violet gradient ring */}
                        <button
                          type="button"
                          onClick={() => {
                            if (post.authorEmail && post.authorEmail !== "news-bot" && post.authorEmail !== "ai-assistant") {
                              router.push(`/profile?user=${encodeURIComponent(post.authorEmail)}`);
                            }
                          }}
                          className="relative p-[2px] rounded-full bg-gradient-to-tr from-primary-500 via-pink-500 to-primary-400 shrink-0 cursor-pointer shadow-lg"
                        >
                          <div
                            className="w-9 h-9 rounded-full bg-dark-800 flex items-center justify-center text-white font-bold text-sm border-[2px] border-black/50 overflow-hidden"
                            style={{ backgroundColor: post.authorAvatarColor || undefined }}
                          >
                            {post.authorEmail === 'news-bot' ? (
                              '📰'
                            ) : post.authorAvatarUrl ? (
                              <img
                                src={post.authorAvatarUrl}
                                alt={post.author}
                                loading="lazy"
                                decoding="async"
                                className="w-full h-full object-cover rounded-full"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              />
                            ) : (
                              <span>{(post.author || post.authorEmail)[0]?.toUpperCase()}</span>
                            )}
                          </div>
                        </button>

                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              onClick={() => {
                                if (post.authorEmail && post.authorEmail !== "news-bot" && post.authorEmail !== "ai-assistant") {
                                  router.push(`/profile?user=${encodeURIComponent(post.authorEmail)}`);
                                }
                              }}
                              className={`font-bold text-[13px] cursor-pointer truncate transition-colors ${post.imageUrl ? "text-white hover:text-primary-300 drop-shadow-md" : "text-nc-ink hover:text-primary-400"}`}
                            >
                              {post.author}
                            </span>
                            {post.authorEmail === 'news-bot' && (
                              <span className="inline-flex items-center gap-0.5 rounded-full border border-cyan-400/40 bg-black/40 backdrop-blur-sm px-2 py-0.5 text-[10px] text-cyan-300 font-semibold shrink-0">
                                🤖 AI
                              </span>
                            )}
                          </div>
                          <span className={`text-[11px] drop-shadow-md ${post.imageUrl ? "text-white/70" : "text-nc-muted"}`}>
                            {formatRelativeTime(post.createdAt)}
                          </span>
                        </div>
                      </div>

                      {/* Right: XP + follow-style button */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide border ${post.imageUrl ? "border-white/20 bg-black/40 backdrop-blur-sm text-white/90" : "border-primary-500/30 bg-primary-500/10 text-primary-400"}`}>
                          ✦ {xpMap[post.authorEmail] !== undefined ? Math.round(xpMap[post.authorEmail]) : 0} XP
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ── Action bar (Twitter/X style icon + count) ─── */}
                  <div className="px-4 pt-3 pb-2">
                    <div className="flex items-center justify-between">
                      {/* Left cluster: reactions as heart-count, comment-count, share */}
                      <div className="flex items-center gap-4">

                        {/* Heart / reactions — click cycles through, shows total */}
                        {(() => {
                          const totalReactions = Object.values(reactions).reduce((a, b) => a + b, 0);
                          const loved = myReaction === "LOVE";
                          return (
                            <button
                              type="button"
                              disabled={!session}
                              onClick={() => handleReaction(post.id, "LOVE")}
                              className={`flex items-center gap-1.5 transition-all duration-150 active:scale-90 group/heart disabled:opacity-50 ${loved ? "text-pink-400" : "text-nc-muted hover:text-pink-400"}`}
                              title={session ? "Дур" : "Нэвтэрч реакц өгнө үү"}
                            >
                              <span className={`material-symbols-outlined text-[22px] transition-transform group-hover/heart:scale-110 ${loved ? "filled text-pink-400 drop-shadow-[0_0_6px_rgba(236,72,153,0.7)]" : ""}`}>
                                {loved ? "favorite" : "favorite_border"}
                              </span>
                              <span className="text-[13px] font-semibold tabular-nums">{totalReactions > 0 ? totalReactions.toLocaleString() : ""}</span>
                            </button>
                          );
                        })()}

                        {/* Comment toggle button */}
                        <button
                          type="button"
                          onClick={() => setOpenCommentsPostId(prev => prev === post.id ? null : post.id)}
                          className={`flex items-center gap-1.5 transition-all duration-150 active:scale-90 group/comment ${
                            openCommentsPostId === post.id ? "text-primary-400" : "text-nc-muted hover:text-primary-400"
                          }`}
                          title="Сэтгэгдэл харах"
                        >
                          <span className={`material-symbols-outlined text-[22px] transition-transform group-hover/comment:scale-110 ${
                            openCommentsPostId === post.id ? "drop-shadow-[0_0_6px_rgba(139,92,246,0.7)]" : ""
                          }`}>
                            {openCommentsPostId === post.id ? "chat_bubble" : "chat_bubble_outline"}
                          </span>
                          <span className="text-[13px] font-semibold tabular-nums">
                            {(commentCounts[post.id] ?? post.comments?.length ?? 0) > 0
                              ? (commentCounts[post.id] ?? post.comments?.length ?? 0).toLocaleString()
                              : ""}
                          </span>
                        </button>

                        {/* Repost / reaction overflow — show emoji reactions as mini popover */}
                        <div className="flex items-center gap-1 text-nc-muted">
                          {[
                            { type: "FIRE" as const, emoji: "🔥" },
                            { type: "WOW" as const,  emoji: "😯" },
                            { type: "COOL" as const, emoji: "😎" },
                            { type: "STAR" as const, emoji: "⭐" },
                          ].map((b) => {
                            const count = reactions[b.type.toLowerCase() as keyof typeof reactions] || 0;
                            const active = myReaction === b.type;
                            return (
                              <button
                                key={b.type}
                                type="button"
                                disabled={!session}
                                onClick={() => handleReaction(post.id, b.type)}
                                title={b.type}
                                className={`flex items-center gap-0.5 text-[13px] transition-all duration-100 active:scale-90 hover:scale-110 disabled:opacity-50 ${active ? "drop-shadow-[0_0_6px_rgba(255,255,255,0.5)]" : "opacity-60 hover:opacity-100"}`}
                              >
                                <span className="leading-none">{b.emoji}</span>
                                {count > 0 && <span className="text-[11px] font-semibold text-nc-muted">{count}</span>}
                              </button>
                            );
                          })}
                        </div>

                        {/* Share */}
                        <button
                          type="button"
                          onClick={() => handleSharePost(post.id, post.title, post.description)}
                          className={`flex items-center gap-1.5 transition-all duration-150 active:scale-90 group/share ${
                            copiedPostId === post.id ? "text-emerald-400" : "text-nc-muted hover:text-primary-400"
                          }`}
                          title="Хуваалцах"
                        >
                          <span className="material-symbols-outlined text-[22px] transition-transform group-hover/share:scale-110">
                            {copiedPostId === post.id ? "check_circle" : "send"}
                          </span>
                        </button>
                      </div>

                      {/* Right: bookmark/save */}
                      <button
                        type="button"
                        className="text-nc-muted hover:text-primary-400 transition-colors"
                        title="Хадгалах"
                      >
                        <span className="material-symbols-outlined text-[22px]">bookmark_border</span>
                      </button>
                    </div>
                  </div>

                  {/* ── Caption ─────────────────────────────────────── */}
                  <div className="px-4 pb-3 space-y-1">
                    {/* "Liked by X others" line */}
                    {(() => {
                      const total = Object.values(reactions).reduce((a, b) => a + b, 0);
                      return total > 0 ? (
                        <p className="text-[12px] font-bold text-nc-ink">
                          {total.toLocaleString()} хүн реакц өгсөн
                        </p>
                      ) : null;
                    })()}

                    {/* Title */}
                    {post.title && (
                      <h2 className="text-[13px] font-extrabold text-nc-ink leading-snug">{post.title}</h2>
                    )}

                    {/* Author inline + description */}
                    <p className="text-[13px] text-nc-muted leading-relaxed whitespace-pre-line">
                      <span
                        onClick={() => {
                          if (post.authorEmail && post.authorEmail !== "news-bot" && post.authorEmail !== "ai-assistant") {
                            router.push(`/profile?user=${encodeURIComponent(post.authorEmail)}`);
                          }
                        }}
                        className="font-bold text-nc-ink mr-1.5 cursor-pointer hover:text-primary-400 transition-colors"
                      >
                        {post.author}
                      </span>
                      {post.description}
                    </p>
                  </div>

                  {/* ── Comments (toggle open/close) ────────────── */}
                  <div
                    className={`overflow-hidden transition-all duration-300 ease-in-out ${
                      openCommentsPostId === post.id ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"
                    }`}
                  >
                    <div className="px-4 pb-4 border-t border-nc-border/30 pt-3">
                      <CommentsSection
                        postId={post.id}
                        comments={post.comments}
                        initialCommentCount={commentCounts[post.id] ?? post.comments?.length ?? 0}
                        onCommentAdded={(newComment) => {
                          setPosts((prev) =>
                            prev.map((currentPost) =>
                              currentPost.id === post.id
                                ? { ...currentPost, comments: [...(currentPost.comments || []), newComment] }
                                : currentPost
                            )
                          );
                          setCommentCounts((prev) => ({
                            ...prev,
                            [post.id]: (prev[post.id] ?? post.comments?.length ?? 0) + 1,
                          }));
                        }}
                      />
                    </div>
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
            {/* Fake Client Panel */}
            <FakeClientPanel />

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
