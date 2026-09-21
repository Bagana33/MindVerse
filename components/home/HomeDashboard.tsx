"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "../auth/useSession";
import { cachedFetch, invalidateCache } from "../../lib/fetchCache";
import { compressImageFile } from "../../lib/imageCompressor";
const FakeClientPanel = dynamic(() => import("./FakeClientPanel").then(m => m.FakeClientPanel), {
  loading: () => <div className="h-64 rounded-2xl border border-white/10 bg-dark-900 animate-pulse" aria-label="Дасгал ачаалж байна" />,
});
const ImageLightbox = dynamic(() => import("../posts/ImageLightbox"), { ssr: false });
import {
  FeedPostCard,
  type Comment,
  type UserPost,
} from "./FeedPostCard";

type LeaderboardUser = {
  email: string;
  name?: string;
  nickname?: string;
  avatarUrl?: string;
  avatarColor?: string;
  experience: number;
};

type GradeFilter = "all" | "9" | "10" | "11" | "12" | "graduated";

const gradeFilters: Array<{ value: GradeFilter; label: string; shortLabel: string; isArchive?: boolean }> = [
  { value: "all", label: "Бүх бүтээл", shortLabel: "Бүгд" },
  { value: "9", label: "9-р анги", shortLabel: "9-р анги" },
  { value: "10", label: "10-р анги", shortLabel: "10-р анги" },
  { value: "11", label: "11-р анги", shortLabel: "11-р анги" },
  { value: "12", label: "12-р анги", shortLabel: "12-р анги" },
  { value: "graduated", label: "🎓 Төгсөгчдийн архив", shortLabel: "🎓 Төгсөгчид (Архив)", isArchive: true },
];

export function HomeDashboard() {
  const { session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [posts, setPosts] = useState<UserPost[]>([]);
  const [topStudentsError, setTopStudentsError] = useState(false);
  const [studentsRetry, setStudentsRetry] = useState(0);
  const [topStudents, setTopStudents] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get("search") || "");
  const [feedError, setFeedError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const requestGeneration = useRef(0);
  const olderController = useRef<AbortController | null>(null);
  const createDialog = useRef<HTMLDialogElement>(null);
  const aiPoll = useRef<ReturnType<typeof setTimeout> | null>(null);
  const createInFlight = useRef(false);
  const uploadController = useRef<AbortController | null>(null);
  const pollController = useRef<AbortController | null>(null);
  const pollGeneration = useRef(0);
  const sharedPostId = searchParams.get("post");
  const reactionRequests = useRef(new Set<string>());
  const [imageUploading, setImageUploading] = useState(false);

  // Sync search from URL (e.g. from Topbar or shared link)
  useEffect(() => {
    const q = searchParams.get("search");
    setSearchQuery(q || "");
  }, [searchParams]);
  const [selectedGrade, setSelectedGrade] = useState<GradeFilter>("all");
  const [isFilterLoading, setIsFilterLoading] = useState(false);
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
    const [copiedPostId, setCopiedPostId] = useState<string | null>(null);
  const [shareError, setShareError] = useState("");
  const [openCommentsPostId, setOpenCommentsPostId] = useState<string | null>(null);
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  useEffect(() => {
    if (showCreateForm) createDialog.current?.showModal();
  }, [showCreateForm]);

  useEffect(() => () => {
    if (aiPoll.current) clearTimeout(aiPoll.current);
    olderController.current?.abort();
    uploadController.current?.abort();
    pollController.current?.abort();
    ++pollGeneration.current;
  }, []);

  useEffect(() => {
    return () => { if (imagePreview?.startsWith("blob:")) URL.revokeObjectURL(imagePreview); };
  }, [imagePreview]);

  const openCreateForm = () => {
    if (!session) { router.push("/login"); return; }
    setShowCreateForm(true);
  };

  const handleSharePost = useCallback(async (postId: string, title: string, description: string) => {
    setShareError("");
    const shareText = `${title}${description ? `\n\n${description}` : ''}`;
    const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/?post=${postId}` : '';
    
    if (navigator.share) {
      try {
        await navigator.share({ title, text: shareText, url: shareUrl });
        return;
      } catch (error) { if (error instanceof Error && error.name === "AbortError") return; }
    }
    
    try {
      await navigator.clipboard.writeText(`${shareText}\n\n${shareUrl}`);
      setCopiedPostId(postId);
      setTimeout(() => setCopiedPostId(null), 2500);
    } catch {
      setShareError("Холбоосыг хуулж чадсангүй. Браузерынхаа хуваалцах үйлдлийг ашиглаарай.");
    }
  }, []);

  const handleOpenLightbox = useCallback((src: string, alt: string) => {
    setLightbox({ src, alt });
  }, []);

  const handleToggleComments = useCallback((postId: string) => {
    setOpenCommentsPostId((prev) => (prev === postId ? null : postId));
  }, []);

  const handleCommentAdded = useCallback((postId: string, newComment: Comment) => {
    setPosts((prev) =>
      prev.map((currentPost) =>
        currentPost.id === postId
          ? { ...currentPost, comments: currentPost.comments ? [...currentPost.comments.filter(c => c.id !== newComment.id), newComment] : undefined }
          : currentPost
      )
    );
    setCommentCounts((prev) => ({
      ...prev,
      [postId]: (prev[postId] ?? 0) + 1,
    }));
  }, []);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});

  async function fetchPostComments(postId: string, signal: AbortSignal): Promise<Comment[]> {
    try {
      const res = await fetch(`/api/posts/comments?postId=${encodeURIComponent(postId)}`, {
        cache: "no-store", signal,
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

  // Cancel stale filters and keep the UI usable during slow requests.
  useEffect(() => {
    const generation = ++requestGeneration.current;
    const controller = new AbortController();
    olderController.current?.abort();
    setLoadingOlder(false);
    const timeout = setTimeout(() => controller.abort(), 15000);
    setIsFilterLoading(true);
    setFeedError(null);
    setPosts([]);
    setHasMore(false);

    async function fetchPosts() {
      try {
        const params = new URLSearchParams({ limit: "10" });
        if (sharedPostId) params.set("id", sharedPostId);
        if (selectedGrade !== "all") params.set("grade", selectedGrade);
        if (debouncedSearch) params.set("search", debouncedSearch);
        const res = await cachedFetch(`/api/posts?${params}`, { signal: controller.signal, cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!json.ok || !Array.isArray(json.posts)) throw new Error("Invalid response");
        if (generation !== requestGeneration.current) return;
        const list: UserPost[] = json.posts;
        setPosts(list);
        setHasMore(!sharedPostId && list.length >= 10);
        setCommentCounts(Object.fromEntries(list.map(p => [p.id, p.commentCount ?? p.comments?.length ?? 0])));
      } catch {
        if (generation === requestGeneration.current) {
          setFeedError("Бүтээлүүдийг ачаалж чадсангүй. Холболтоо шалгаад дахин оролдоно уу.");
        }
      } finally {
        clearTimeout(timeout);
        if (generation === requestGeneration.current) {
          setLoading(false);
          setIsFilterLoading(false);
        }
      }
    }
    fetchPosts();
    return () => { ++requestGeneration.current; controller.abort(); clearTimeout(timeout); };
  }, [selectedGrade, debouncedSearch, retryCount, session?.email, sharedPostId]);

  async function loadOlderPosts() {
    if (loadingOlder || !hasMore || !posts.length || isFilterLoading) return;
    const before = posts[posts.length - 1]?.createdAt;
    if (!before) return;
    const generation = requestGeneration.current;
    const controller = new AbortController();
    olderController.current = controller;
    const timeout = setTimeout(() => controller.abort(), 15000);
    setLoadingOlder(true);
    setFeedError(null);
    try {
      const params = new URLSearchParams({ limit: "10", before });
      if (selectedGrade !== "all") params.set("grade", selectedGrade);
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await cachedFetch(`/api/posts?${params}`, { signal: controller.signal, cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.ok || !Array.isArray(json.posts)) throw new Error("Invalid response");
      if (generation !== requestGeneration.current) return;
      const list: UserPost[] = json.posts;
      setPosts(prev => {
        const ids = new Set(prev.map(p => p.id));
        return [...prev, ...list.filter(p => !ids.has(p.id))];
      });
      setCommentCounts(prev => ({ ...prev, ...Object.fromEntries(list.map(p => [p.id, p.commentCount ?? p.comments?.length ?? 0])) }));
      setHasMore(!sharedPostId && list.length >= 10);
    } catch {
      if (generation === requestGeneration.current) setFeedError("Дараагийн бүтээлүүдийг ачаалж чадсангүй. Дахин оролдоно уу.");
    } finally {
      clearTimeout(timeout);
      if (generation === requestGeneration.current) setLoadingOlder(false);
    }
  }

  // Fetch top students and create XP map
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    setTopStudentsError(false);
    async function fetchTopStudents() {
      try {
        const res = await cachedFetch("/api/leaderboard", { signal: controller.signal });
        const json = await res.json();
        if (!res.ok || !json.ok || !Array.isArray(json.leaderboard)) throw new Error("Leaderboard unavailable");
        if (!active) return;
        const leaderboard = json.leaderboard;
        setTopStudents(leaderboard.slice(0, 15));
        
        // Create XP map for post authors and user XP
        const map: Record<string, number> = {};
        leaderboard.forEach((u: LeaderboardUser) => {
          if (u.email) {
            map[u.email] = u.experience ?? 0;
          }
        });
        setXpMap(map);
      } catch {
        if (active) setTopStudentsError(true);
      } finally { clearTimeout(timeout); }
    }
    fetchTopStudents();
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [studentsRetry]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const q = searchQuery.trim();
      const params = new URLSearchParams(searchParams.toString());
      if (q) params.set("search", q);
      else params.delete("search");
      router.replace(`/?${params.toString()}`, { scroll: false });
      setDebouncedSearch(q);
    }
  };

  // Search is applied by the API before pagination.
  const filteredPosts = posts;

  const handleReaction = useCallback(
    async (postId: string, type: "FIRE" | "WOW" | "LOVE" | "COOL" | "STAR") => {
      if (!session?.email) {
        router.push("/login");
        return;
      }
      if (reactionRequests.current.has(postId)) return;
      reactionRequests.current.add(postId);
      const post = posts.find((p) => p.id === postId);
      if (!post) { reactionRequests.current.delete(postId); return; }

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
        signal: AbortSignal.timeout(15000),
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
      }).finally(() => { reactionRequests.current.delete(postId); invalidateCache("/api/posts"); });
    },
    [session?.email, posts, router]
  );

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setCreateError(null);
    if (!file.type.startsWith("image/")) {
      setCreateError("Зураг файл сонгоно уу");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setCreateError("Зургийн хэмжээ 5MB-аас бага байх ёстой");
      return;
    }

    uploadController.current?.abort();
    const controller = new AbortController();
    uploadController.current = controller;
    const uploadTimeout = setTimeout(() => controller.abort(), 35000);
    setImageUploading(true);
    setImageUrl("");
    try {
      const localUrl = URL.createObjectURL(file);
      setImagePreview(localUrl);
    } catch {}

    try {
      const signRes = await fetch('/api/uploads/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: 'neoncanvas/posts' }),
        signal: controller.signal
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
        body: form,
        signal: controller.signal
      });
      if (!uploadRes.ok) throw new Error('upload failed');
      const uploadJson = await uploadRes.json();
      if (!uploadJson?.secure_url) throw new Error('no secure_url');

      if (uploadController.current !== controller || controller.signal.aborted) return;
      setImageUrl(uploadJson.secure_url as string);
      setImagePreview(uploadJson.secure_url as string);
      setImageUploading(false);
    } catch (err) {
      if (uploadController.current !== controller) return;
      if (controller.signal.aborted) {
        setCreateError("Зураг байршуулах хугацаа хэтэрлээ. Дахин зураг сонгоно уу.");
        setImagePreview(null);
        return;
      }
      try {
        const compressedBase64 = await compressImageFile(file, 1200, 0.75);
        if (uploadController.current !== controller || controller.signal.aborted) return;
        setImagePreview(compressedBase64);
        setImageUrl(compressedBase64);
        setImageUploading(false);
      } catch (e) {
        if (uploadController.current !== controller) return;
        setImageUploading(false);
        setCreateError("Зураг байршуулж чадсангүй");
      }
    } finally {
      clearTimeout(uploadTimeout);
      if (uploadController.current === controller) setImageUploading(false);
    }
  }

  async function handleCreatePost(e: React.FormEvent) {
    e.preventDefault();
    if (createInFlight.current) return;
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

    createInFlight.current = true;
    setCreating(true);

    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description: description.trim(), imageUrl, visibility: 'PUBLIC' }),
        signal: AbortSignal.timeout(30000),
      });

      if (!res.ok) {
        const json = await res.json();
        setCreateError(json.error || "Алдаа гарлаа");
        return;
      }

      const json = await res.json();
      const postId = json.post.id;
      const initialComments: Comment[] = [];
      const postWithComments: UserPost = { ...json.post, comments: initialComments };
      invalidateCache("/api/posts");

      setPosts((prev) => [postWithComments, ...prev]);
      setCommentCounts((prev) => ({ ...prev, [postId]: initialComments.length }));

      let attempts = 0;
      const generation = ++pollGeneration.current;
      pollController.current?.abort();
      if (aiPoll.current) clearTimeout(aiPoll.current);
      const pollForAIComment = async () => {
        attempts += 1;
        const controller = new AbortController();
        pollController.current = controller;
        const timeout = setTimeout(() => controller.abort(), 12000);
        const comments = await fetchPostComments(postId, controller.signal);
        clearTimeout(timeout);
        if (generation !== pollGeneration.current) return;
        const hasAIComment = comments.some((comment) => comment.isAI);

        if (comments.length > 0) {
          setPosts((prev) =>
            prev.map((post) =>
              post.id === postId ? { ...post, comments } : post
            )
          );
          setCommentCounts((prev) => ({ ...prev, [postId]: comments.length }));
        }

        if (!hasAIComment && attempts < 3) aiPoll.current = setTimeout(pollForAIComment, 4000);
      };
      aiPoll.current = setTimeout(pollForAIComment, 4000);

      setTitle("");
      setDescription("");
      setImageUrl("");
      setImagePreview(null);
      setShowCreateForm(false);
    } catch (err: any) {
      setCreateError(err.name === "TimeoutError" ? "Хариу хүлээх хугацаа хэтэрлээ. Давхар нийтлэхээс өмнө өөрийн хуудсаа шалгаарай. Ноорог энд хадгалагдсан." : "Сүлжээний алдаа гарлаа. Давхар нийтлэхээс өмнө өөрийн хуудсаа шалгаарай.");
    } finally {
      createInFlight.current = false;
      setCreating(false);
    }
  }

  return (
    <>

      {/* Create Post Modal */}
      {showCreateForm && (
        <dialog ref={createDialog} aria-labelledby="create-post-title" onCancel={e => { if (creating || imageUploading) e.preventDefault(); else setShowCreateForm(false); }} className="m-auto w-[calc(100%-2rem)] max-w-2xl max-h-[90dvh] overflow-y-auto rounded-3xl border border-white/10 bg-dark-900 p-5 sm:p-6 text-slate-300 backdrop:bg-black/75">
            <div className="flex items-center justify-between mb-6">
              <h2 id="create-post-title" className="text-2xl font-bold text-white">Бүтээл нийтлэх</h2>
              <button
                aria-label="Нийтлэх цонх хаах"
                disabled={creating || imageUploading}
                onClick={() => {
                  setShowCreateForm(false);
                  setTitle("");
                  setDescription("");
                  setImageUrl("");
                  setImagePreview(null);
                  setCreateError(null);
                }}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>

            <form onSubmit={handleCreatePost} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2" htmlFor="post-title">Гарчиг</label>
                <input
                  id="post-title"
                  type="text"
                  maxLength={200}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mv-field"
                  placeholder="Бүтээлийн нэр..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2" htmlFor="post-description">Тайлбар</label>
                <textarea
                  id="post-description"
                  maxLength={2000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="mv-field resize-y"
                  placeholder="Бүтээлийн санаа, хийсэн ажлаа тайлбарлаарай..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Зураг · 5 MB хүртэл</label>
                {imagePreview ? (
                  <div className="relative">
                    <img src={imagePreview} alt="Нийтлэх зургийн урьдчилсан харагдац" className="w-full rounded-lg max-h-64 object-contain" />
                    <button
                      type="button"
                      aria-label="Сонгосон зургийг хасах"
                      disabled={imageUploading || creating}
                      onClick={() => {
                        setImagePreview(null);
                        setImageUrl("");
                      }}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full min-h-11 min-w-11 p-2 hover:bg-red-600 transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer focus-within:ring-2 focus-within:ring-violet-400 flex items-center justify-center w-full h-32 border-2 border-dashed border-white/10 rounded-lg hover:border-primary-500/50 transition-colors">
                    <div className="text-center">
                      <span className="material-symbols-outlined text-4xl text-slate-400 mb-2">add_photo_alternate</span>
                      <p className="text-sm text-slate-400">Зураг сонгох</p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      aria-label="Бүтээлийн зураг сонгох"
                      className="sr-only"
                    />
                  </label>
                )}
              </div>

              {createError && (
                <div role="alert" className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  <p className="text-sm text-red-400">{createError}</p>
                </div>
              )}

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  disabled={creating || imageUploading}
                  onClick={() => {
                    setShowCreateForm(false);
                    setTitle("");
                    setDescription("");
                    setImageUrl("");
                    setImagePreview(null);
                    setCreateError(null);
                  }}
                  className="mv-button-secondary"
                >
                  Болих
                </button>
                <button
                  type="submit"
                  disabled={creating || imageUploading}
                  className="mv-button-primary"
                >
                  {imageUploading ? "Зураг байршуулж байна..." : creating ? "Нийтэлж байна..." : "Нийтлэх"}
                </button>
              </div>
            </form>
        </dialog>
      )}

      {lightbox && <ImageLightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />}

      <section className="mv-page-header mb-6 lg:mb-8" aria-labelledby="feed-heading">
        <div>
          <p className="mv-eyebrow">Mind Verse / Дизайн лаборатори</p>
          <h1 id="feed-heading" className="mv-title">Бүтээлээрээ холбогдъё.</h1>
          <p className="mv-subtitle">Шинэ санаа ол. Бүтээлээ хуваалц. Хамтдаа хөгж.</p>
        </div>
        <button type="button" onClick={openCreateForm} className="mv-button-primary shrink-0">
          <span aria-hidden="true" className="material-symbols-outlined text-xl">add</span>
          {session ? "Бүтээл нийтлэх" : "Нэвтэрч нэгдэх"}
        </button>
      </section>

      {shareError && <p role="alert" className="mb-5 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-200">{shareError}</p>}
      {sharedPostId && <div className="mb-5 flex items-center justify-between gap-4 rounded-xl border border-violet-400/20 bg-violet-500/5 p-4 text-sm text-slate-300"><span>Хуваалцсан бүтээл</span><Link href="/" className="min-h-11 flex items-center font-semibold text-violet-300">Бүх бүтээл →</Link></div>}
      {/* Main Content Grid */}
      <div className="mv-feed-layout">
        {/* Feed Section */}
        <div className="mv-feed space-y-5 sm:space-y-6">
          {/* Grade filter */}
          <section className="rounded-2xl border border-white/10 bg-dark-900 p-4 sm:p-5" aria-label="Бүтээлийн хайлт ба шүүлтүүр">
            <div className="mb-3 flex items-center justify-between gap-3"><label htmlFor="feed-search" className="text-sm font-semibold text-slate-200">Бүтээл хайх</label><span className="text-xs text-slate-500">{loading || isFilterLoading ? "Ачаалж байна…" : `${posts.length} бүтээл ачааллаа`}</span></div>
            <div className="mb-4 relative">
              <span aria-hidden="true" className="material-symbols-outlined absolute left-3 top-3 text-xl text-slate-400">search</span>
              <input id="feed-search" type="search" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={handleSearchKeyDown} placeholder="Нэр, тайлбар эсвэл бүтээлчээр хайх…" className="mv-field min-h-12 !pl-11" />
            </div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-xs font-medium text-slate-500">Ангиар шүүх</p>
              {selectedGrade !== "all" && (
                <button
                  type="button"
                  onClick={() => setSelectedGrade("all")}
                                    className="min-h-11 px-2 text-xs font-medium text-violet-300 hover:text-white disabled:opacity-60"
                >
                  Цэвэрлэх
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 pb-1">
              {gradeFilters.map((grade) => {
                const active = selectedGrade === grade.value;
                return (
                  <button
                    key={grade.value}
                    type="button"
                    onClick={() => setSelectedGrade(grade.value)}
                    aria-pressed={active}
                    className={`shrink-0 min-h-11 px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
                      active
                        ? grade.isArchive
                          ? "bg-amber-500/15 text-amber-200 border-amber-400/40"
                          : "bg-violet-500/20 text-violet-100 border-violet-400/40"
                        : grade.isArchive
                          ? "bg-transparent text-amber-300/90 border-white/10 hover:border-amber-400/40"
                          : "bg-transparent text-slate-400 border-white/10 hover:border-violet-400/40 hover:text-white"
                    } disabled:opacity-60 disabled:cursor-not-allowed`}
                  >
                    {grade.shortLabel}
                  </button>
                );
              })}

              {isFilterLoading && (
                <span className="text-xs text-slate-400 inline-flex items-center gap-1.5 ml-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-pulse" />
                  Ачаалж байна...
                </span>
              )}
            </div>
          </section>

          <div aria-live="polite" className="sr-only">{loading || isFilterLoading ? "Бүтээлүүдийг ачаалж байна" : `${posts.length} бүтээл ачааллаа`}</div>
          {feedError && (
            <div role="alert" className="rounded-2xl border border-amber-400/25 bg-amber-400/5 p-5 text-sm text-amber-100">
              <p>{feedError}</p>
              <button type="button" onClick={() => posts.length ? loadOlderPosts() : setRetryCount(n => n + 1)} className="mt-3 min-h-11 rounded-lg border border-amber-400/30 px-4 font-semibold hover:bg-amber-400/10">Дахин оролдох</button>
            </div>
          )}
          {loading || isFilterLoading ? (
            <div aria-label="Бүтээлүүдийг ачаалж байна" className="space-y-5">
              {[0, 1].map(i => <div key={i} className="overflow-hidden rounded-2xl border border-white/10 bg-dark-900 animate-pulse"><div className="h-14 border-b border-white/5" /><div className="aspect-[4/3] bg-dark-800" /><div className="h-20" /></div>)}
            </div>
          ) : !feedError && filteredPosts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center">
              <span aria-hidden="true" className="material-symbols-outlined text-3xl text-violet-300">search</span>
              <p className="mt-3 font-semibold text-white">{debouncedSearch ? "Хайлтад тохирох бүтээл олдсонгүй" : "Одоогоор бүтээл алга"}</p>
              <p className="mt-2 text-sm text-slate-400">{debouncedSearch ? "Өөр үг эсвэл өөр анги сонгоод үзээрэй." : "Энэ хэсэгт хамгийн түрүүнд бүтээлээ хуваалцаарай."}</p>
              {(debouncedSearch || selectedGrade !== "all") && <button onClick={() => { setSearchQuery(""); setDebouncedSearch(""); setSelectedGrade("all"); router.replace("/", { scroll: false }); }} className="mt-4 min-h-11 px-4 text-sm font-semibold text-violet-300">Бүх бүтээлийг харах</button>}
            </div>
          ) : (
            filteredPosts.map((post, index) => (
              <FeedPostCard
                key={post.id}
                post={post}
                priority={index === 0}
                currentEmail={session?.email}
                authorXp={xpMap[post.authorEmail] ?? 0}
                isCommentsOpen={openCommentsPostId === post.id}
                commentCount={commentCounts[post.id] ?? post.comments?.length ?? 0}
                onToggleComments={handleToggleComments}
                onReaction={handleReaction}
                onShare={handleSharePost}
                onLightbox={handleOpenLightbox}
                onCommentAdded={handleCommentAdded}
                copied={copiedPostId === post.id}
              />
            ))
          )}

          {!loading && !isFilterLoading && posts.length > 0 && <div className="py-5 text-center">
            {hasMore ? (
              <button
                type="button"
                onClick={loadOlderPosts}
                disabled={loadingOlder}
                className="min-h-11 rounded-xl border border-white/10 px-5 py-3 text-sm font-bold text-slate-300 hover:text-primary-400 transition-colors flex items-center justify-center gap-2 mx-auto disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span className={`material-symbols-outlined text-lg ${loadingOlder ? "animate-spin" : ""}`}>
                  {loadingOlder ? "refresh" : "expand_more"}
                </span>
                {loadingOlder ? "Уншиж байна..." : "Дараагийн бүтээлүүд"}
              </button>
            ) : (
              <p className="text-sm text-slate-500">Бүх бүтээлийг үзлээ</p>
            )}
          </div>}
        </div>

        {/* Sidebar */}
        <aside className="mv-feed-rail" aria-label="Сурагчид ба бүтээлч сорилт">
          {/* Featured Top Creators Stories Bar */}
          <div className="mv-creators rounded-2xl border border-white/10 bg-dark-900 p-4 sm:p-5 overflow-hidden relative group/stories">
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-violet-400" />
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
                  <span>Онцлох сурагчид</span>
                </h3>
              </div>
              <Link href="/leaderboard" className="inline-flex min-h-11 items-center text-xs font-semibold text-primary-400 hover:text-primary-300 transition-colors">
                Бүгд →
              </Link>
            </div>

            {topStudentsError && <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400" role="status"><span>Сурагчдын жагсаалтыг ачаалж чадсангүй.</span><button onClick={() => setStudentsRetry(n => n + 1)} className="min-h-11 px-2 font-semibold text-violet-300">Дахин ачаалах</button></div>}
            <div className="mv-scroll-area flex items-center gap-4 overflow-x-auto py-2 px-1 xl:flex-col xl:items-stretch xl:gap-1 xl:overflow-visible xl:px-0 xl:py-0">
              {/* Logged-in User "Add Story / Post" circle */}
              <button
                type="button"
                className="flex flex-col items-center gap-1.5 shrink-0 group/story cursor-pointer xl:hidden"
                onClick={openCreateForm}
              >
                <div className="relative p-[2.5px] rounded-full bg-gradient-to-tr from-slate-700 to-slate-800 group-hover/story:from-violet-500 group-hover/story:to-pink-500 transition-all duration-300">
                  <div className="w-16 h-16 rounded-full border-2 border-dark-900 bg-dark-800 flex items-center justify-center relative overflow-hidden">
                    {session?.avatarUrl ? (
                      <img src={session.avatarUrl} loading="lazy" decoding="async" alt="Таны зураг" className="w-full h-full object-cover" />
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
                <span className="text-xs font-medium text-slate-400 group-hover/story:text-white truncate max-w-[70px]">
                  {session ? "Бүтээл нэмэх" : "Нэгдэх"}
                </span>
              </button>

              {/* Top Featured Creators Stories */}
              {topStudents.map((student, idx) => {
                const displayName = student.nickname || student.name || student.email.split("@")[0];
                return (
                  <button
                    key={student.email}
                    type="button"
                    onClick={() => router.push(`/profile?user=${encodeURIComponent(student.email)}`)}
                    className={`flex shrink-0 flex-col items-center gap-1.5 rounded-xl group/story cursor-pointer xl:flex-row xl:gap-3 xl:p-2 xl:text-left xl:hover:bg-white/5 ${idx >= 5 ? "xl:hidden" : ""}`}
                    title={`${displayName} · ${student.experience || 0} XP`}
                  >
                    {/* Instagram-style colorful gradient ring */}
                    <div className="relative shrink-0 p-[2px] rounded-full bg-gradient-to-tr from-violet-500/70 to-slate-600 transition-colors">
                      <div
                        className="w-16 h-16 xl:w-10 xl:h-10 rounded-full border-2 border-dark-900 bg-dark-800 flex items-center justify-center overflow-hidden relative"
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
                    <span className="min-w-0 xl:flex-1"><span className="block max-w-[72px] truncate text-xs font-medium text-slate-300 group-hover/story:text-white xl:max-w-none xl:text-sm">{displayName}</span><span className="mt-1 hidden text-xs tabular-nums text-slate-500 xl:block">{(student.experience || 0).toLocaleString()} XP</span></span>
                  </button>
                );
              })}
            </div>
          </div>


          <div className="mv-feed-extras space-y-6">
            {/* Fake Client Panel */}
            <FakeClientPanel />

            <div className="rounded-2xl border border-white/10 bg-dark-900 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-300">Дараагийн алхам</p>
              <h2 className="mt-2 text-lg font-bold text-white">Өнөөдөр юу бүтээх вэ?</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">Хичээлээсээ шинэ арга сураад, уралдаанд бүтээлээ сориорой.</p>
              <div className="mt-4 grid gap-2">
                <Link href="/lessons" className="flex min-h-12 items-center justify-between rounded-xl bg-white/5 px-4 text-sm font-semibold text-slate-200 hover:bg-violet-500/15">Хичээлээ үзэх <span aria-hidden="true">→</span></Link>
                <Link href="/contests" className="flex min-h-12 items-center justify-between rounded-xl bg-white/5 px-4 text-sm font-semibold text-slate-200 hover:bg-violet-500/15">Уралдаан үзэх <span aria-hidden="true">→</span></Link>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Footer */}
      <footer className="mt-12 py-6 border-t border-white/5 text-center">
        <p className="text-xs text-slate-400">Mind Verse · Дизайн лаборатори</p>
      </footer>
    </>
  );
}
