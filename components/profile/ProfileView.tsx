"use client";

import { useState, useEffect } from "react";
import { useSession } from "../auth/useSession";

type UserPost = {
  id: string;
  title: string;
  description: string;
  authorEmail: string;
  reactions: any[];
  createdAt: string;
  imageUrl?: string;
};

type UserData = {
  email: string;
  name?: string;
  nickname?: string;
  bio?: string;
  avatarUrl?: string;
  avatarColor?: string;
  role: "student" | "teacher";
  grade?: string; // "10" | "11" | "12"
  experience: number;
};

export function ProfileView() {
  const { session, loading: sessionLoading } = useSession();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [userPosts, setUserPosts] = useState<UserPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editNickname, setEditNickname] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editAvatarColor, setEditAvatarColor] = useState("#6366f1");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editGrade, setEditGrade] = useState<string>("");

  useEffect(() => {
    async function fetchUserData() {
      if (!session) {
        setLoading(false);
        return;
      }

      try {
        // Fetch user data (with XP)
        const userRes = await fetch(`/api/user?email=${encodeURIComponent(session.email)}`);
        if (userRes.ok) {
          const json = await userRes.json();
          setUserData(json.user);
          setEditNickname(json.user.nickname || "");
          setEditBio(json.user.bio || "");
          setEditAvatarColor(json.user.avatarColor || "#6366f1");
          setAvatarPreview(json.user.avatarUrl || null);
          setEditGrade(json.user.grade || "");
        } else {
          // User not found in storage, create default user data from session
          console.log("User not found, creating default from session");
          const defaultUserData: UserData = {
            email: session.email,
            name: session.name,
            role: session.role,
            experience: 0,
          };
          setUserData(defaultUserData);
          setEditGrade("");
        }

        // Fetch user's posts
        const postsRes = await fetch("/api/posts");
        if (postsRes.ok) {
          const json = await postsRes.json();
          console.log("Fetched posts:", json.posts);
          console.log("Session email:", session.email);
          const myPosts = (json.posts || []).filter((p: UserPost) => p.authorEmail === session.email);
          console.log("My posts:", myPosts);
          setUserPosts(myPosts);
        }
      } catch (err) {
        console.error("Failed to fetch profile data:", err);
      } finally {
        setLoading(false);
      }
    }

    if (!sessionLoading) {
      fetchUserData();
    }
  }, [session, sessionLoading]);

  function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    if (!file.type.startsWith("image/")) {
      setError("Зураг файл сонгоно уу");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError("Зургийн хэмжээ 2MB-аас бага байх ёстой");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setAvatarPreview(result);
    };
    reader.onerror = () => {
      setError("Зураг уншихад алдаа гарлаа");
    };
    reader.readAsDataURL(file);
  }

  async function handleSaveProfile() {
    setError(null);
    setSaving(true);

    try {
      const res = await fetch("/api/user/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: editNickname,
          bio: editBio,
          avatarUrl: avatarPreview,
          avatarColor: editAvatarColor,
          grade: userData?.role === "student" ? (editGrade || undefined) : undefined,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        setError(json.error || "Алдаа гарлаа");
        return;
      }

      const json = await res.json();
      setUserData(json.user);
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message || "Сүлжээний алдаа гарлаа");
    } finally {
      setSaving(false);
    }
  }

  function handleCancelEdit() {
    setIsEditing(false);
    setEditNickname(userData?.nickname || "");
    setEditBio(userData?.bio || "");
    setEditAvatarColor(userData?.avatarColor || "#6366f1");
    setAvatarPreview(userData?.avatarUrl || null);
    setEditGrade(userData?.grade || "");
    setError(null);
  }

  if (sessionLoading || loading) {
    return (
      <div className="space-y-4">
        <section className="bg-nc-panel/90 border border-nc-border rounded-2xl px-4 py-4 shadow-nc-soft">
          <p className="text-xs text-nc-muted">Loading...</p>
        </section>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="space-y-4">
        <section className="bg-nc-panel/90 border border-nc-border rounded-2xl px-4 py-4 shadow-nc-soft">
          <p className="text-xs text-nc-muted">Please log in to view your profile.</p>
        </section>
      </div>
    );
  }

  const rankTitle = userData && userData.role === "student"
    ? (userData.experience >= 1000 ? "Expert" :
       userData.experience >= 500 ? "Advanced" :
       userData.experience >= 100 ? "Intermediate" : "Beginner")
    : userData?.role === "teacher" ? "Teacher" : "User";

  return (
    <div className="space-y-4">
      <section className="bg-nc-panel/90 border border-nc-border rounded-2xl px-4 py-4 shadow-nc-soft">
        <div className="flex flex-wrap items-start gap-4">
          <div className="relative">
            {avatarPreview || userData?.avatarUrl ? (
              <img 
                src={avatarPreview || userData?.avatarUrl} 
                alt="Avatar"
                className="w-20 h-20 rounded-full object-cover border-2 shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
                style={{ borderColor: editAvatarColor }}
              />
            ) : (
              <div 
                className="w-20 h-20 rounded-full border-2 shadow-[0_8px_24px_rgba(0,0,0,0.6)] flex items-center justify-center text-xl font-bold"
                style={{ 
                  background: `linear-gradient(to top right, ${editAvatarColor}, ${editAvatarColor}dd)`,
                  borderColor: editAvatarColor 
                }}
              >
                {(userData?.nickname || session.name || session.email)[0]?.toUpperCase()}
              </div>
            )}
            {isEditing && (
              <label className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-violet-500 hover:bg-violet-600 flex items-center justify-center cursor-pointer shadow-lg transition-colors">
                <span className="text-white text-xs">✎</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            {!isEditing ? (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-semibold">
                        {userData?.nickname || session.name || session.email}
                      </h2>
                      {/* XP Badge - Next to name (Students only) */}
                      {userData && userData.role === "student" && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-nc-accent/40 bg-nc-accent/10 px-2.5 py-1 text-xs font-semibold">
                          ⚡ {userData.experience} XP
                        </span>
                      )}
                      {/* Grade Badge */}
                      {userData && userData.role === "student" && userData.grade && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-green-500/40 bg-green-500/10 px-2.5 py-1 text-xs font-semibold">
                          🎒 {userData.grade} анги
                        </span>
                      )}
                    </div>
                    {userData?.nickname && (
                      <p className="text-xs text-nc-muted">{session.email}</p>
                    )}
                    <p className="text-xs text-nc-muted mt-1 capitalize">{session.role}</p>
                  </div>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex-shrink-0"
                  >
                    Засах
                  </button>
                </div>
                {userData?.bio && (
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">{userData.bio}</p>
                )}
                {userData && userData.role === "student" && (
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/60 px-2 py-1">
                      🎖️ {rankTitle}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Nickname</label>
                  <input
                    type="text"
                    value={editNickname}
                    onChange={(e) => setEditNickname(e.target.value)}
                    placeholder="Таны display нэр"
                    maxLength={50}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Bio</label>
                  <textarea
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    placeholder="Өөрийнхөө тухай бичих..."
                    rows={3}
                    maxLength={500}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-none"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">{editBio.length}/500</p>
                </div>
                {/* Grade Selector for Students */}
                {userData?.role === "student" && (
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Анги</label>
                    <div className="flex flex-wrap gap-2">
                      {[{ id: "10", label: "10 анги" }, { id: "11", label: "11 анги" }, { id: "12", label: "12 анги" }].map(g => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => setEditGrade(g.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            editGrade === g.id
                              ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-[0_4px_12px_rgba(34,197,94,0.4)]"
                              : "bg-slate-900/60 border border-slate-700 text-slate-300 hover:border-green-500/40 hover:text-slate-100"
                          }`}
                        >
                          {g.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setEditGrade("")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          editGrade === ""
                            ? "bg-slate-800 text-white border border-slate-600"
                            : "bg-slate-900/60 border border-slate-700 text-slate-300 hover:border-slate-500/40 hover:text-slate-100"
                        }`}
                        title="Цэвэрлэх"
                      >
                        Цэвэрлэх
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">10/11/12 ангийг сонгоно уу</p>
                  </div>
                )}
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Avatar өнгө</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={editAvatarColor}
                      onChange={(e) => setEditAvatarColor(e.target.value)}
                      className="w-12 h-10 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={editAvatarColor}
                      onChange={(e) => setEditAvatarColor(e.target.value)}
                      placeholder="#6366f1"
                      maxLength={7}
                      className="flex-1 px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                    />
                  </div>
                </div>
                {error && <p className="text-xs text-red-400">{error}</p>}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-violet-500 to-purple-500 text-white text-xs font-medium shadow-[0_4px_16px_rgba(139,92,246,0.4)] hover:shadow-[0_6px_20px_rgba(139,92,246,0.6)] disabled:opacity-60 transition-all"
                  >
                    {saving ? "Хадгалж байна..." : "Хадгалах"}
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    disabled={saving}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors disabled:opacity-60"
                  >
                    Болих
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="bg-nc-panel/90 border border-nc-border rounded-2xl px-4 py-5 shadow-nc-soft">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Your posts ({userPosts.length})</h3>
          {userPosts.length > 0 && (
            <span className="text-[10px] text-nc-muted">Tap image to view fullscreen</span>
          )}
        </div>
        {userPosts.length === 0 ? (
          <p className="text-xs text-nc-muted">No posts yet. Create your first post on the home page!</p>
        ) : (
          <PostGrid posts={userPosts} onPostsChange={setUserPosts} />
        )}
      </section>
    </div>
  );
}

// --- Instagram-like grid ---
import ImageLightbox from "../posts/ImageLightbox";
import PostImage from "../posts/PostImage";

interface GridProps { 
  posts: UserPost[];
  onPostsChange: (posts: UserPost[]) => void;
}

const PostGrid: React.FC<GridProps> = ({ posts, onPostsChange }) => {
  const [active, setActive] = useState<UserPost | null>(null);
  const [editingPost, setEditingPost] = useState<UserPost | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function openEditModal(post: UserPost) {
    setEditingPost(post);
    setEditTitle(post.title);
    setEditDescription(post.description);
    setEditImageUrl(post.imageUrl || "");
    setEditImagePreview(post.imageUrl || null);
    setError(null);
  }

  function closeEditModal() {
    setEditingPost(null);
    setEditTitle("");
    setEditDescription("");
    setEditImageUrl("");
    setEditImagePreview(null);
    setError(null);
  }

  function handleEditImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
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

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setEditImagePreview(result);
      setEditImageUrl(result);
    };
    reader.onerror = () => {
      setError("Зураг уншихад алдаа гарлаа");
    };
    reader.readAsDataURL(file);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingPost) return;

    setError(null);

    if (editTitle.trim().length < 3) {
      setError("Гарчиг хамгийн багадаа 3 тэмдэгт байх ёстой");
      return;
    }

    if (editDescription.trim().length < 10) {
      setError("Тайлбар хамгийн багадаа 10 тэмдэгт байх ёстой");
      return;
    }

    setSaving(true);

    try {
      // Delete old post
      const deleteRes = await fetch(`/api/posts?id=${editingPost.id}`, {
        method: "DELETE",
      });

      if (!deleteRes.ok) {
        const json = await deleteRes.json();
        setError(json.error || "Устгахад алдаа гарлаа");
        return;
      }

      // Create updated post
      const createRes = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim(),
          imageUrl: editImageUrl,
          visibility: 'PUBLIC',
        }),
      });

      if (!createRes.ok) {
        const json = await createRes.json();
        setError(json.error || "Шинэчлэхэд алдаа гарлаа");
        return;
      }

      const json = await createRes.json();
      
      // Update posts list
      const updatedPosts = posts.filter(p => p.id !== editingPost.id);
      updatedPosts.unshift(json.post);
      onPostsChange(updatedPosts);
      
      closeEditModal();
    } catch (err: any) {
      setError(err.message || "Сүлжээний алдаа гарлаа");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(post: UserPost) {
    if (!confirm(`"${post.title}" постыг устгах уу?`)) return;

    setDeleting(post.id);
    try {
      const res = await fetch(`/api/posts?id=${post.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const json = await res.json();
        alert(json.error || "Алдаа гарлаа");
        return;
      }

      // Update posts list
      onPostsChange(posts.filter(p => p.id !== post.id));
    } catch (err: any) {
      alert(err.message || "Сүлжээний алдаа гарлаа");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {posts.map(p => {
          const hasImg = !!p.imageUrl;
          return (
            <div
              key={p.id}
              className="group relative aspect-square overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40 focus-within:ring-2 focus-within:ring-violet-500/50"
            >
              <button
                type="button"
                onClick={() => hasImg && setActive(p)}
                className="absolute inset-0 w-full h-full"
                tabIndex={-1}
              >
                {hasImg ? (
                  <img
                    src={p.imageUrl}
                    alt={p.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center p-2 text-[11px] text-slate-400 text-center">
                    {p.title}
                  </div>
                )}
                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between text-[10px] text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <span className="truncate max-w-[60%] font-medium drop-shadow">{p.title}</span>
                  <span className="inline-flex items-center gap-1 drop-shadow"><span>❤️</span>{p.reactions.length}</span>
                </div>
              </button>
              {/* Edit/Delete icons overlay */}
              <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditModal(p);
                  }}
                  disabled={deleting === p.id}
                  className="bg-black/60 hover:bg-violet-600 text-white rounded-full p-1 shadow focus:outline-none disabled:opacity-50 transition-colors"
                  title="Edit"
                >
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M4 13.5V16h2.5l7.06-7.06-2.5-2.5L4 13.5z" stroke="currentColor" strokeWidth="1.5"/><path d="M14.06 6.44a1.5 1.5 0 0 0 0-2.12l-1.38-1.38a1.5 1.5 0 0 0-2.12 0l-1.06 1.06 3.5 3.5 1.06-1.06z" stroke="currentColor" strokeWidth="1.5"/></svg>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(p);
                  }}
                  disabled={deleting === p.id}
                  className="bg-black/60 hover:bg-red-600 text-white rounded-full p-1 shadow focus:outline-none disabled:opacity-50 transition-colors"
                  title="Delete"
                >
                  {deleting === p.id ? (
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="animate-spin">
                      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" strokeDasharray="40" strokeDashoffset="10" opacity="0.3"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M6 7v7a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V7" stroke="currentColor" strokeWidth="1.5"/><path d="M9 9v5M11 9v5" stroke="currentColor" strokeWidth="1.5"/><rect x="4" y="4" width="12" height="2" rx="1" stroke="currentColor" strokeWidth="1.5"/></svg>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {active && active.imageUrl && (
        <ImageLightbox
          src={active.imageUrl}
          alt={active.title}
          caption={active.title}
          onClose={() => setActive(null)}
        />
      )}
      
      {/* Edit Modal */}
      {editingPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-slate-900 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Пост засах</h3>
              <button
                onClick={closeEditModal}
                disabled={saving}
                className="text-slate-400 hover:text-white transition-colors disabled:opacity-50"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-2">Гарчиг</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Постын гарчиг"
                  required
                  minLength={3}
                  maxLength={200}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950/60 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-2">Тайлбар</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Постын дэлгэрэнгүй тайлбар"
                  required
                  minLength={10}
                  maxLength={2000}
                  rows={6}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950/60 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-none"
                />
                <p className="text-xs text-slate-500 mt-1">{editDescription.length}/2000</p>
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-2">Зураг</label>
                {editImagePreview && (
                  <div className="relative mb-3">
                    <img
                      src={editImagePreview}
                      alt="Preview"
                      className="max-h-72 w-full rounded-xl border border-slate-700 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setEditImagePreview(null);
                        setEditImageUrl("");
                      }}
                      className="absolute top-2 right-2 bg-slate-950/80 hover:bg-slate-800 text-white rounded-full px-3 py-1.5 text-xs transition-colors"
                    >
                      Устгах
                    </button>
                  </div>
                )}
                <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 bg-slate-950/60 text-slate-300 hover:border-violet-500/40 hover:text-slate-100 cursor-pointer transition-colors text-sm">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Зураг солих
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleEditImageUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {error && (
                <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-slate-700">
                <button
                  type="button"
                  onClick={closeEditModal}
                  disabled={saving}
                  className="flex-1 px-4 py-3 rounded-lg border border-slate-700 bg-slate-950/60 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors disabled:opacity-50 text-sm font-medium"
                >
                  Болих
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-[0_4px_16px_rgba(139,92,246,0.4)] hover:shadow-[0_6px_20px_rgba(139,92,246,0.6)] transition-all disabled:opacity-50 text-sm font-medium"
                >
                  {saving ? "Хадгалж байна..." : "Хадгалах"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};