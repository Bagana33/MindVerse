"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "../auth/useSession";
import { cachedFetch } from "../../lib/fetchCache";

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
  const router = useRouter();
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
  const searchParams = useSearchParams();
  const userParam = searchParams.get("user");
  const viewingUserEmail = userParam ? userParam.trim() || null : null;
  const isOwnProfile = !viewingUserEmail || (session && viewingUserEmail === session.email);

  // Tabs: Posts vs Notifications
  const [activeTab, setActiveTab] = useState<"posts" | "notifications">("posts");
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadNotifsCount, setUnreadNotifsCount] = useState(0);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [notifFilter, setNotifFilter] = useState<"all" | "unread">("all");

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "notifications") {
      setActiveTab("notifications");
    } else {
      setActiveTab("posts");
    }
  }, [searchParams]);

  const fetchProfileNotifications = async () => {
    if (!isOwnProfile || !session?.email) return;
    try {
      setLoadingNotifs(true);
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          setNotifications(data.notifications || []);
          setUnreadNotifsCount(data.unreadCount ?? 0);
        }
      }
    } catch {
      // silent
    } finally {
      setLoadingNotifs(false);
    }
  };

  useEffect(() => {
    if (isOwnProfile && session?.email) {
      fetchProfileNotifications();
    }
  }, [isOwnProfile, session?.email]);

  const handleMarkNotifRead = async (id: string) => {
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
        setUnreadNotifsCount((prev) => Math.max(0, prev - 1));
      }
    } catch {}
  };

  const handleMarkAllNotifsRead = async () => {
    try {
      const res = await fetch("/api/notifications/mark-read", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadNotifsCount(0);
      }
    } catch {}
  };

  const handleClearAllNotifs = async () => {
    if (!confirm("Бүх мэдэгдлийг устгах уу?")) return;
    try {
      const res = await fetch("/api/notifications/clear", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setNotifications([]);
        setUnreadNotifsCount(0);
      }
    } catch {}
  };

  useEffect(() => {
    async function fetchUserData() {
      const targetEmail = viewingUserEmail || session?.email;
      if (!targetEmail) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        // Fetch user data (with XP)
        const userRes = await cachedFetch(`/api/user?email=${encodeURIComponent(targetEmail)}`);
        if (userRes.ok) {
          const json = await userRes.json();
          setUserData(json.user);
          if (isOwnProfile) {
            setEditNickname(json.user.nickname || "");
            setEditBio(json.user.bio || "");
            setEditAvatarColor(json.user.avatarColor || "#6366f1");
            setAvatarPreview(json.user.avatarUrl || null);
            setEditGrade(json.user.grade || "");
          }
        } else if (isOwnProfile && session) {
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

        // Fetch user's posts directly from user-specific endpoint
        const postsRes = await cachedFetch(`/api/posts/user/${encodeURIComponent(targetEmail)}`);
        if (postsRes.ok) {
          const json = await postsRes.json();
          console.log('🔍 Profile posts fetch:', {
            endpoint: `/api/posts/user/${targetEmail}`,
            postsCount: json.posts?.length,
            targetEmail,
          });
          // Posts are already filtered by the API
          const posts = Array.isArray(json.posts) ? json.posts : [];
          console.log(`✅ Found ${posts.length} posts for ${targetEmail}`);
          setUserPosts(posts);
        } else {
          console.error("Failed to fetch posts:", postsRes.status);
          setUserPosts([]);
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
  }, [session, sessionLoading, viewingUserEmail, isOwnProfile]);

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
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

    // Instant local preview
    try {
      const localUrl = URL.createObjectURL(file);
      setAvatarPreview(localUrl);
    } catch {}

    // Try Cloudinary first
    try {
      const signRes = await fetch('/api/uploads/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: 'neoncanvas/avatars' })
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

      setAvatarPreview(uploadJson.secure_url as string);
      return;
    } catch (err) {
      // Fallback to base64 if Cloudinary not configured
      try {
        const reader = new FileReader();
        reader.onload = (event) => {
          const result = event.target?.result as string;
          setAvatarPreview(result);
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

  if (!session && !viewingUserEmail) {
    return (
      <div className="space-y-4">
        <section className="bg-dark-900/80 border border-white/10 rounded-2xl px-6 py-8 shadow-lg text-center">
          <p className="text-slate-300 mb-4">Өөрийн профайлыг харахын тулд нэвтэрнэ үү.</p>
          <p className="text-sm text-slate-500 mb-6">Хүмүүсийн профайлыг Feed эсвэл Leaderboard-оос нээж харна уу.</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/" className="px-4 py-2 rounded-xl bg-primary-600/20 border border-primary-500/40 text-primary-300 hover:bg-primary-600/30 transition-colors text-sm font-medium">
              Feed
            </Link>
            <Link href="/leaderboard" className="px-4 py-2 rounded-xl bg-dark-700 border border-white/10 text-slate-300 hover:bg-dark-600 transition-colors text-sm font-medium">
              Leaderboard
            </Link>
            <Link href="/login" className="px-4 py-2 rounded-xl bg-primary-500 text-white hover:bg-primary-600 transition-colors text-sm font-medium">
              Нэвтрэх
            </Link>
          </div>
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
      {!isOwnProfile && (
        <div className="bg-slate-900/60 border border-violet-500/30 rounded-2xl px-4 py-3 shadow-lg">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-violet-300">👤</span>
            <span className="text-slate-300">
              Та <span className="font-semibold text-white">{userData?.nickname || userData?.name || viewingUserEmail}</span>-н profile-г харж байна
            </span>
            {session && (
              <button
                onClick={() => router.push('/profile')}
                className="ml-auto text-xs text-violet-300 hover:text-violet-200 underline"
              >
                Өөрийн profile руу буцах
              </button>
            )}
          </div>
        </div>
      )}
      <section className="bg-nc-panel/90 border border-nc-border rounded-2xl px-4 py-4 shadow-nc-soft">
        <div className="flex flex-wrap items-start gap-4">
          <div className="relative">
            {avatarPreview || userData?.avatarUrl ? (
              <img 
                src={avatarPreview || userData?.avatarUrl} 
                alt="Avatar"
                className="w-20 h-20 rounded-full object-cover border-2 shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
                style={{ borderColor: isOwnProfile ? editAvatarColor : (userData?.avatarColor || '#6366f1') }}
              />
            ) : (
              <div 
                className="w-20 h-20 rounded-full border-2 shadow-[0_8px_24px_rgba(0,0,0,0.6)] flex items-center justify-center text-xl font-bold"
                style={{ 
                  background: `linear-gradient(to top right, ${isOwnProfile ? editAvatarColor : (userData?.avatarColor || '#6366f1')}, ${isOwnProfile ? editAvatarColor : (userData?.avatarColor || '#6366f1')}dd)`,
                  borderColor: isOwnProfile ? editAvatarColor : (userData?.avatarColor || '#6366f1')
                }}
              >
                {(userData?.nickname || userData?.name || userData?.email || 'U')[0]?.toUpperCase()}
              </div>
            )}
            {isEditing && isOwnProfile && (
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
                        {userData?.nickname || userData?.name || userData?.email}
                      </h2>
                      {/* XP Badge - Next to name (Students only) */}
                      {userData && userData.role === "student" && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-nc-accent/40 bg-nc-accent/10 px-2.5 py-1 text-xs font-semibold">
                          ⚡ {Math.round(userData.experience)} XP
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
                      <p className="text-xs text-nc-muted">{userData.email}</p>
                    )}
                    <p className="text-xs text-nc-muted mt-1 capitalize">{userData?.role}</p>
                  </div>
                  {isOwnProfile && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex-shrink-0"
                    >
                      Засах
                    </button>
                  )}
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

      {/* Tabs for Own Profile */}
      {isOwnProfile && (
        <div className="flex items-center gap-2 border-b border-nc-border pb-1">
          <button
            onClick={() => {
              setActiveTab("posts");
              router.replace("/profile");
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "posts"
                ? "bg-violet-600/20 text-violet-300 border border-violet-500/40 shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <span>🎨 Бүтээлүүд</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400">
              {userPosts.length}
            </span>
          </button>
          <button
            onClick={() => {
              setActiveTab("notifications");
              router.replace("/profile?tab=notifications");
              fetchProfileNotifications();
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "notifications"
                ? "bg-violet-600/20 text-violet-300 border border-violet-500/40 shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <span>🔔 Мэдэгдэл</span>
            {unreadNotifsCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-pink-500 text-white font-bold animate-pulse">
                {unreadNotifsCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Tab 1: Posts Grid */}
      {(!isOwnProfile || activeTab === "posts") && (
        <section className="bg-nc-panel/90 border border-nc-border rounded-2xl px-4 py-5 shadow-nc-soft">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">
              {isOwnProfile ? `Your posts (${userPosts.length})` : `${userData?.nickname || userData?.name || 'User'}'s posts (${userPosts.length})`}
            </h3>
            {userPosts.length > 0 && (
              <span className="text-[10px] text-nc-muted">Tap image to view fullscreen</span>
            )}
          </div>
          {userPosts.length === 0 ? (
            <p className="text-xs text-nc-muted">
              {isOwnProfile 
                ? "No posts yet. Create your first post on the home page!" 
                : "This user hasn't posted anything yet."}
            </p>
          ) : (
            <PostGrid posts={userPosts} onPostsChange={setUserPosts} isOwnProfile={isOwnProfile} />
          )}
        </section>
      )}

      {/* Tab 2: Notifications List */}
      {isOwnProfile && activeTab === "notifications" && (
        <section className="bg-nc-panel/90 border border-nc-border rounded-2xl px-4 py-5 shadow-nc-soft">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">Бүх Мэдэгдлүүд</h3>
              {unreadNotifsCount > 0 && (
                <span className="text-[10px] bg-pink-500/20 text-pink-300 border border-pink-500/40 px-2 py-0.5 rounded-full font-bold">
                  {unreadNotifsCount} уншаагүй
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex rounded-lg bg-slate-800 p-0.5 border border-white/5">
                <button
                  onClick={() => setNotifFilter("all")}
                  className={`text-xs px-2.5 py-1 rounded-md transition-all ${
                    notifFilter === "all"
                      ? "bg-violet-600 text-white font-semibold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Бүгд ({notifications.length})
                </button>
                <button
                  onClick={() => setNotifFilter("unread")}
                  className={`text-xs px-2.5 py-1 rounded-md transition-all ${
                    notifFilter === "unread"
                      ? "bg-violet-600 text-white font-semibold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Шинэ ({unreadNotifsCount})
                </button>
              </div>

              <button
                onClick={fetchProfileNotifications}
                disabled={loadingNotifs}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                title="Шинэчлэх"
              >
                <span className={`material-symbols-outlined text-[18px] ${loadingNotifs ? "animate-spin" : ""}`}>
                  sync
                </span>
              </button>

              {unreadNotifsCount > 0 && (
                <button
                  onClick={handleMarkAllNotifsRead}
                  className="text-xs px-3 py-1.5 rounded-lg bg-violet-600/30 hover:bg-violet-600/50 text-violet-200 border border-violet-500/40 transition-all font-medium"
                >
                  Бүгдийг уншсан
                </button>
              )}

              {notifications.length > 0 && (
                <button
                  onClick={handleClearAllNotifs}
                  className="text-xs px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 transition-all font-medium"
                >
                  Цэвэрлэх
                </button>
              )}
            </div>
          </div>

          {/* List */}
          {loadingNotifs && notifications.length === 0 ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 animate-pulse h-16" />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-16 text-center">
              <div className="text-4xl mb-3">🎉</div>
              <h4 className="text-sm font-semibold text-slate-300 mb-1">Мэдэгдэл алга байна</h4>
              <p className="text-xs text-slate-500">
                Танд шинэ реакц, сэтгэгдэл, үнэлгээ ирэх үед энд автоматаар харагдана.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications
                .filter((n) => (notifFilter === "unread" ? !n.read : true))
                .map((n) => {
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
                        if (!n.read) handleMarkNotifRead(n.id);
                      }}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                        n.read
                          ? "bg-slate-900/40 border-slate-800/80 text-slate-400 hover:bg-slate-800/40"
                          : "bg-violet-950/40 border-violet-500/40 shadow-[0_0_15px_rgba(139,92,246,0.15)] text-slate-200 hover:bg-violet-900/40"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeConfig.bg}`}>
                            {badgeConfig.label}
                          </span>
                          {!n.read && (
                            <span className="w-2 h-2 rounded-full bg-pink-500 shadow-[0_0_6px_rgba(236,72,153,0.8)]" />
                          )}
                        </div>
                        <p className="text-xs text-slate-200 leading-relaxed font-normal">{n.message}</p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-slate-400">
                          {new Date(n.createdAt).toLocaleDateString()} {new Date(n.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// --- Instagram-like grid ---
import ImageLightbox from "../posts/ImageLightbox";
import PostImage from "../posts/PostImage";

interface GridProps { 
  posts: UserPost[];
  onPostsChange: (posts: UserPost[]) => void;
  isOwnProfile: boolean;
}

const PostGrid: React.FC<GridProps> = ({ posts, onPostsChange, isOwnProfile }) => {
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

  async function handleEditImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
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

    // Local preview ASAP
    try {
      const localUrl = URL.createObjectURL(file);
      setEditImagePreview(localUrl);
    } catch {}

    // Try Cloudinary upload first
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

      const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: form });
      if (!uploadRes.ok) throw new Error('upload failed');
      const uploadJson = await uploadRes.json();
      if (!uploadJson?.secure_url) throw new Error('no secure_url');

      setEditImagePreview(uploadJson.secure_url as string);
      setEditImageUrl(uploadJson.secure_url as string);
      return;
    } catch (err) {
      // Fallback to base64
      try {
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
      } catch (e) {
        setError("Зураг байршуулж чадсангүй");
      }
    }
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
              {/* Edit/Delete icons overlay - Only show for own posts */}
              {isOwnProfile && (
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
              )}
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