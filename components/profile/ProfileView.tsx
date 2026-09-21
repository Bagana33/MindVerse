"use client";

import {
  Dispatch,
  FormEvent,
  SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "../auth/useSession";
import { invalidateCache } from "../../lib/fetchCache";
import Modal from "../ui/Modal";
import PostImage from "../posts/PostImage";
import ImageLightbox from "../posts/ImageLightbox";

type UserPost = {
  id: string;
  title: string;
  description: string;
  authorEmail: string;
  reactions: unknown[];
  createdAt: string;
  imageUrl?: string;
  visibility?: string;
};
type UserData = {
  email: string;
  name?: string;
  nickname?: string;
  bio?: string;
  avatarUrl?: string;
  avatarColor?: string;
  role: "student" | "teacher";
  grade?: string;
  experience: number;
};
type Notification = {
  id: string;
  message: string;
  createdAt: string;
  read: boolean;
  type?: string;
};

function messageFor(cause: unknown, signal?: AbortSignal) {
  return signal?.aborted
    ? "Хариу удаж байна. Холболтоо шалгаад дахин оролдоно уу."
    : cause instanceof Error
      ? cause.message
      : "Сүлжээний алдаа гарлаа. Дахин оролдоно уу.";
}

async function requestJson(url: string, options: RequestInit = {}) {
  const response = await fetch(url, { cache: "no-store", ...options });
  const json = await response.json().catch(() => null);
  if (!response.ok || !json || json.ok === false || json.success === false) {
    throw new Error(
      json?.error || "Хүсэлтийг гүйцэтгэж чадсангүй. Дахин оролдоно уу.",
    );
  }
  return json;
}

// The ref closes the gap before React commits disabled controls. Abort also
// bounds image preparation and prevents a late upload from replacing a draft.
function usePendingRequest() {
  const request = useRef<AbortController | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(
    () => () => {
      request.current?.abort("unmounted");
    },
    [],
  );
  async function run<T>(
    job: (signal: AbortSignal) => Promise<T>,
  ): Promise<T | undefined> {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    setError(null);
    const timeout = window.setTimeout(() => controller.abort("timeout"), 25000);
    let onAbort: () => void = () => {};
    try {
      return await Promise.race([
        job(controller.signal),
        new Promise<never>((_, reject) => {
          onAbort = () => reject(new Error("Хүсэлт цуцлагдлаа."));
          controller.signal.addEventListener("abort", onAbort, { once: true });
        }),
      ]);
    } catch (cause) {
      if (controller.signal.reason !== "unmounted")
        setError(messageFor(cause, controller.signal));
    } finally {
      window.clearTimeout(timeout);
      controller.signal.removeEventListener("abort", onAbort);
      if (controller.signal.reason !== "unmounted") setPending(false);
      if (request.current === controller) request.current = null;
    }
  }
  return { pending, error, setError, run };
}

async function uploadImage(file: File, folder: string, signal: AbortSignal) {
  if (!file.type.startsWith("image/"))
    throw new Error("Зургийн файл сонгоно уу.");
  const limit = folder.endsWith("avatars") ? 2 : 5;
  if (file.size > limit * 1024 * 1024)
    throw new Error(`Зураг ${limit} МБ-аас бага байх ёстой.`);
  try {
    const signed = await requestJson("/api/uploads/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder }),
      signal,
    });
    const form = new FormData();
    form.append("file", file);
    form.append("api_key", signed.apiKey);
    form.append("timestamp", String(signed.timestamp));
    form.append("signature", signed.signature);
    form.append("folder", signed.folder);
    const uploaded = await requestJson(
      `https://api.cloudinary.com/v1_1/${signed.cloudName}/image/upload`,
      { method: "POST", body: form, signal },
    );
    if (!uploaded.secure_url) throw new Error("Зураг байршуулж чадсангүй.");
    return uploaded.secure_url as string;
  } catch (cause) {
    if (signal.aborted) throw cause;
    const { compressImageFile } = await import("../../lib/imageCompressor");
    const dataUrl = await compressImageFile(
      file,
      folder.endsWith("avatars") ? 512 : 1200,
      0.82,
    );
    if (signal.aborted) throw new Error("Хүсэлт цуцлагдлаа.");
    return dataUrl;
  }
}

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("mn-MN", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

function ErrorNotice({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-rose-400/25 bg-rose-400/10 p-4 text-sm leading-relaxed text-rose-200"
    >
      <p>{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 min-h-11 rounded-xl border border-rose-300/30 px-4 font-semibold hover:bg-rose-300/10"
        >
          Дахин оролдох
        </button>
      )}
    </div>
  );
}

function Avatar({
  user,
  src,
  color,
}: {
  user: UserData;
  src?: string;
  color?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return (
    <div
      className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-3xl border-2 bg-violet-500/15 text-3xl font-bold text-white"
      style={{ borderColor: color || user.avatarColor || "#6366f1" }}
    >
      {src && !failed ? (
        <img
          src={src}
          alt=""
          width={96}
          height={96}
          decoding="async"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        (user.nickname || user.name || user.email).slice(0, 1).toUpperCase()
      )}
    </div>
  );
}

export function ProfileView() {
  const { session } = useSession();
  const searchParams = useSearchParams();
  const identity =
    searchParams.get("user")?.trim().toLowerCase() || session?.email || "guest";
  return <ProfileContent key={identity} />;
}

function ProfileContent() {
  const { session, loading: sessionLoading, refresh } = useSession();
  const searchParams = useSearchParams();
  const requestedEmail = searchParams.get("user")?.trim().toLowerCase() || "";
  const targetEmail = requestedEmail || session?.email || "";
  const isOwnProfile =
    !requestedEmail || requestedEmail === session?.email?.toLowerCase();
  const activeTab =
    isOwnProfile && searchParams.get("tab") === "notifications"
      ? "notifications"
      : "posts";
  const [userData, setUserData] = useState<UserData | null>(null);
  const [userPosts, setUserPosts] = useState<UserPost[]>([]);
  const [profileLoading, setProfileLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [nickname, setNickname] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarColor, setAvatarColor] = useState("#6366f1");
  const [grade, setGrade] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const editRequest = usePendingRequest();

  useEffect(() => {
    if (sessionLoading) return;
    setUserData(null);
    setUserPosts([]);
    setIsEditing(false);
    setNotice(null);
    setProfileError(null);
    setPostsError(null);
    if (!targetEmail) {
      setProfileLoading(false);
      setPostsLoading(false);
      return;
    }
    let current = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort("timeout"), 15000);
    setProfileLoading(true);
    setPostsLoading(true);
    const profile = requestJson(
      `/api/user?email=${encodeURIComponent(targetEmail)}`,
      { signal: controller.signal },
    )
      .then((json) => {
        if (current) {
          if (!json.user) throw new Error("Профайл олдсонгүй.");
          setUserData(json.user);
        }
      })
      .catch((cause) => {
        if (current) setProfileError(messageFor(cause, controller.signal));
      })
      .finally(() => {
        if (current) setProfileLoading(false);
      });
    const posts = requestJson(
      `/api/posts/user/${encodeURIComponent(targetEmail)}`,
      { signal: controller.signal },
    )
      .then((json) => {
        if (current) setUserPosts(Array.isArray(json.posts) ? json.posts : []);
      })
      .catch((cause) => {
        if (current) setPostsError(messageFor(cause, controller.signal));
      })
      .finally(() => {
        if (current) setPostsLoading(false);
      });
    void Promise.allSettled([profile, posts]).then(() =>
      window.clearTimeout(timeout),
    );
    return () => {
      current = false;
      controller.abort("unmounted");
      window.clearTimeout(timeout);
    };
  }, [targetEmail, sessionLoading, retry]);

  function openEdit() {
    if (!userData) return;
    setNickname(userData.nickname || "");
    setBio(userData.bio || "");
    setAvatarUrl(userData.avatarUrl || "");
    setAvatarColor(userData.avatarColor || "#6366f1");
    setGrade(userData.grade || "");
    editRequest.setError(null);
    setIsEditing(true);
  }

  async function handleAvatar(file?: File) {
    if (!file) return;
    const uploaded = await editRequest.run((signal) =>
      uploadImage(file, "neoncanvas/avatars", signal),
    );
    if (uploaded) setAvatarUrl(uploaded);
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    if (nickname.trim() && nickname.trim().length < 3) {
      editRequest.setError("Дэлгэцийн нэр 3-аас доошгүй тэмдэгттэй байна.");
      return;
    }
    const result = await editRequest.run((signal) =>
      requestJson("/api/user/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          nickname: nickname.trim(),
          bio: bio.trim(),
          avatarColor,
          ...(avatarUrl !== (userData?.avatarUrl || "") ? { avatarUrl } : {}),
          ...(userData?.role === "student" && ["9", "10", "11", "12"].includes(grade)
            ? { grade }
            : {}),
        }),
      }),
    );
    if (result?.user) {
      setUserData(result.user);
      setIsEditing(false);
      setNotice("Профайлын өөрчлөлт хадгалагдлаа.");
      invalidateCache("/api/user");
      invalidateCache("/api/posts");
      invalidateCache("/api/leaderboard");
      void refresh();
    }
  }

  if (sessionLoading || profileLoading)
    return (
      <div className="mv-page" role="status" aria-label="Профайл ачаалж байна">
        <div className="mv-panel space-y-5 p-6">
          <div className="h-24 w-24 rounded-3xl bg-white/5 motion-safe:animate-pulse" />
          <div className="h-7 w-48 rounded-lg bg-white/5 motion-safe:animate-pulse" />
          <p className="text-sm text-slate-400">Профайл ачаалж байна…</p>
        </div>
      </div>
    );
  if (!targetEmail)
    return (
      <div className="mv-page">
        <section className="mv-panel mx-auto w-full max-w-3xl !px-6 !py-10 text-center sm:!px-10 sm:!py-14">
          <p className="mv-eyebrow">Таны бүтээлийн орон зай</p>
          <h1 className="mv-title mt-3">Өөрийн профайлыг нээгээрэй</h1>
          <p className="mv-subtitle mx-auto mt-3 max-w-lg">
            Нэвтэрч бүтээлүүдээ нэг дор хадгалан, ахиц болон мэдэгдлээ хараарай.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/login" className="mv-button-primary">
              Нэвтрэх
            </Link>
            <Link href="/" className="mv-button-secondary">
              Бүтээлүүд үзэх
            </Link>
          </div>
        </section>
      </div>
    );
  if (!userData)
    return (
      <div className="mv-page">
        <h1 className="mv-title mb-5">Профайл</h1>
        <ErrorNotice
          message={profileError || "Профайл олдсонгүй."}
          onRetry={() => setRetry((value) => value + 1)}
        />
        <Link href="/" className="mv-button-secondary mt-5">
          Нүүр рүү буцах
        </Link>
      </div>
    );
  const displayName =
    userData.nickname || userData.name || userData.email.split("@")[0];
  const experience = Math.max(0, userData.experience || 0);
  const rank =
    experience >= 1000
      ? "Мэргэжилтэн"
      : experience >= 500
        ? "Ахисан"
        : experience >= 100
          ? "Хөгжиж буй"
          : "Эхлэгч";

  return (
    <div className="mv-page">
      <header className="mv-page-header">
        <div>
          <p className="mv-eyebrow">Бүтээл • Ахиц • Хамт олон</p>
          <h1 className="mv-title">
            {isOwnProfile ? "Миний профайл" : "Бүтээлчийн профайл"}
          </h1>
        </div>
        {!isOwnProfile && session && (
          <Link href="/profile" className="mv-button-secondary">
            Миний профайл
          </Link>
        )}
      </header>
      {notice && (
        <p
          role="status"
          className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-4 text-sm text-emerald-200"
        >
          {notice}
        </p>
      )}
      <section
        className="mv-panel overflow-hidden !p-0"
        aria-labelledby="profile-name"
      >
        <div className="grid lg:grid-cols-[minmax(0,1fr)_220px] xl:grid-cols-[minmax(0,1fr)_264px]">
          <div className="min-w-0 p-5 sm:p-6 xl:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
              <Avatar user={userData} src={userData.avatarUrl} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2
                      id="profile-name"
                      className="break-words text-2xl font-bold leading-tight tracking-tight text-white xl:text-3xl"
                    >
                      {displayName}
                    </h2>
                    {isOwnProfile && (
                      <p className="mt-2 break-all text-sm leading-6 text-slate-400">
                        {userData.email}
                      </p>
                    )}
                  </div>
                  {isOwnProfile && (
                    <button
                      type="button"
                      onClick={openEdit}
                      className="mv-button-secondary shrink-0"
                    >
                      Профайл засах
                    </button>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-sm">
                  <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1 text-violet-200">
                    {userData.role === "teacher" ? "Багш" : "Сурагч"}
                  </span>
                  {userData.role === "student" && (
                    <>
                      <span className="rounded-full border border-white/10 px-3 py-1 text-slate-300">
                        {userData.grade === "graduated"
                          ? "Төгсөгч"
                          : userData.grade
                            ? `${userData.grade}-р анги`
                            : "Анги сонгоогүй"}
                      </span>
                      <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-amber-200">
                        {rank}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <p className="mt-6 max-w-3xl whitespace-pre-wrap break-words text-sm leading-7 text-slate-300 sm:text-base sm:leading-8">
              {userData.bio ||
                (isOwnProfile
                  ? "Өөрийгөө танилцуулаарай. Сонирхол, сурч буй зүйл, бүтээхийг хүсдэг санаагаа энд бичиж болно."
                  : "Танилцуулга хараахан нэмээгүй байна.")}
            </p>
          </div>
          <dl
            aria-label="Профайлын үзүүлэлтүүд"
            className="grid grid-cols-2 content-center gap-5 border-t border-white/10 bg-slate-950/35 p-5 sm:p-6 lg:border-l lg:border-t-0 xl:p-7"
          >
            {userData.role === "student" && (
              <div className="col-span-2 border-b border-white/10 pb-5">
                <dt className="text-sm font-medium text-slate-400">
                  Цуглуулсан XP
                </dt>
                <dd className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-violet-200 xl:text-4xl">
                  {experience.toLocaleString("mn-MN")}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-sm text-slate-400">Бүтээл</dt>
              <dd className="mt-2 text-2xl font-semibold tabular-nums text-white">
                {postsLoading || postsError
                  ? "—"
                  : userPosts.length.toLocaleString("mn-MN")}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-400">Үнэлгээ</dt>
              <dd className="mt-2 text-2xl font-semibold tabular-nums text-white">
                {postsLoading || postsError
                  ? "—"
                  : userPosts
                      .reduce(
                        (total, post) => total + (post.reactions?.length || 0),
                        0,
                      )
                      .toLocaleString("mn-MN")}
              </dd>
            </div>
          </dl>
        </div>
      </section>
      {isOwnProfile && (
        <nav
          aria-label="Профайлын хэсгүүд"
          className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-2 sm:w-fit"
        >
          <Link
            href="/profile"
            scroll={false}
            aria-current={activeTab === "posts" ? "page" : undefined}
            className={`min-h-11 rounded-xl px-5 py-3 text-sm font-semibold ${activeTab === "posts" ? "bg-violet-500/20 text-violet-200" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
          >
            Бүтээлүүд
            {!postsLoading && !postsError ? ` · ${userPosts.length}` : ""}
          </Link>
          <Link
            href="/profile?tab=notifications"
            scroll={false}
            aria-current={activeTab === "notifications" ? "page" : undefined}
            className={`min-h-11 rounded-xl px-5 py-3 text-sm font-semibold ${activeTab === "notifications" ? "bg-violet-500/20 text-violet-200" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
          >
            Мэдэгдэл
          </Link>
        </nav>
      )}
      {activeTab === "notifications" ? (
        <ProfileNotifications key={session?.email} />
      ) : (
        <section aria-labelledby="profile-posts">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="profile-posts" className="text-xl font-bold text-white">
                {isOwnProfile ? "Миний бүтээлүүд" : "Бүтээлүүд"}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Зургийг дарж томоор үзэх, гарчгийг дарж тайлбарыг унших
                боломжтой.
              </p>
            </div>
            {isOwnProfile && (
              <Link href="/" className="mv-button-primary">
                Бүтээл нэмэх
              </Link>
            )}
          </div>
          {postsLoading ? (
            <p role="status" className="mv-panel p-6 text-sm text-slate-400">
              Бүтээлүүдийг ачаалж байна…
            </p>
          ) : postsError ? (
            <ErrorNotice
              message={postsError}
              onRetry={() => setRetry((value) => value + 1)}
            />
          ) : userPosts.length ? (
            <PostGrid
              key={targetEmail}
              posts={userPosts}
              isOwnProfile={isOwnProfile}
              onPostsChange={setUserPosts}
            />
          ) : (
            <div className="mv-panel p-8 text-center">
              <h3 className="text-lg font-semibold text-slate-200">
                {isOwnProfile
                  ? "Анхны бүтээлээ хуваалцаарай"
                  : "Бүтээл хараахан нэмээгүй байна"}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                {isOwnProfile
                  ? "Суралцсан зүйлээ бүтээл болгоод хамт олноосоо санал аваарай."
                  : "Шинэ бүтээлүүд энд харагдана."}
              </p>
              {isOwnProfile && (
                <Link href="/" className="mv-button-primary mt-5">
                  Бүтээл нэмэх
                </Link>
              )}
            </div>
          )}
        </section>
      )}
      <Modal
        open={isEditing}
        onClose={() => setIsEditing(false)}
        title="Профайл засах"
        busy={editRequest.pending}
        footer={
          <>
            <button
              type="button"
              disabled={editRequest.pending}
              onClick={() => setIsEditing(false)}
              className="mv-button-secondary"
            >
              Болих
            </button>
            <button
              type="submit"
              form="profile-edit-form"
              disabled={editRequest.pending}
              className="mv-button-primary"
            >
              {editRequest.pending ? "Түр хүлээнэ үү…" : "Өөрчлөлт хадгалах"}
            </button>
          </>
        }
      >
        <form
          id="profile-edit-form"
          onSubmit={saveProfile}
          className="space-y-5"
        >
          <fieldset disabled={editRequest.pending} className="space-y-5">
            <div className="flex flex-wrap items-center gap-4">
              <Avatar user={userData} src={avatarUrl} color={avatarColor} />
              <div className="min-w-0 flex-1">
                <label htmlFor="profile-avatar" className="mv-label">
                  Профайлын зураг
                </label>
                <label
                  htmlFor="profile-avatar"
                  className={`mv-button-secondary relative mt-2 focus-within:ring-2 focus-within:ring-violet-400 focus-within:ring-offset-2 focus-within:ring-offset-slate-950 ${editRequest.pending ? "cursor-wait opacity-60" : "cursor-pointer"}`}
                >
                  {avatarUrl ? "Зураг солих" : "Зураг сонгох"}
                  <input
                    id="profile-avatar"
                    type="file"
                    accept="image/*"
                    disabled={editRequest.pending}
                    className="sr-only"
                    onChange={(event) => {
                      void handleAvatar(event.target.files?.[0]);
                      event.target.value = "";
                    }}
                  />
                </label>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">
                  2 МБ хүртэл. Зураг бэлэн болсны дараа хадгална.
                </p>
              </div>
            </div>
            <div>
              <label htmlFor="profile-nickname" className="mv-label">
                Дэлгэцийн нэр
              </label>
              <input
                id="profile-nickname"
                className="mv-field mt-2"
                autoComplete="nickname"
                value={nickname}
                maxLength={50}
                onChange={(event) => setNickname(event.target.value)}
                placeholder={userData.name || "Таны нэр"}
              />
              <p className="mt-2 text-xs text-slate-400">
                Нэр оруулах бол 3–50 тэмдэгт ашиглана уу.
              </p>
            </div>
            <div>
              <label htmlFor="profile-bio" className="mv-label">
                Миний тухай
              </label>
              <textarea
                id="profile-bio"
                className="mv-field mt-2 min-h-32 resize-y"
                maxLength={500}
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                placeholder="Сонирхол, сурч буй зүйл, бүтээхийг хүсдэг санаа…"
              />
              <p className="mt-1 text-right text-xs text-slate-400">
                {bio.length}/500
              </p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              {userData.role === "student" && (
                <div>
                  <label htmlFor="profile-grade" className="mv-label">
                    Анги
                  </label>
                  <select
                    id="profile-grade"
                    className="mv-field mt-2"
                    value={grade}
                    onChange={(event) => setGrade(event.target.value)}
                  >
                    <option value="" disabled>
                      Анги сонгох
                    </option>
                    <option value="9">9-р анги</option>
                    <option value="10">10-р анги</option>
                    <option value="11">11-р анги</option>
                    <option value="12">12-р анги</option>
                    {userData.grade === "graduated" && (
                      <option value="graduated">Төгсөгч</option>
                    )}
                  </select>
                </div>
              )}
              <div>
                <label htmlFor="profile-color" className="mv-label">
                  Профайлын өнгө
                </label>
                <div className="mt-2 flex items-center gap-3">
                  <input
                    id="profile-color"
                    type="color"
                    value={avatarColor}
                    onChange={(event) => setAvatarColor(event.target.value)}
                    className="h-12 w-16 cursor-pointer rounded-xl border border-white/15 bg-transparent p-1"
                  />
                  <span className="text-sm text-slate-400">
                    {avatarColor.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          </fieldset>
          {editRequest.error && <ErrorNotice message={editRequest.error} />}
          {editRequest.pending && (
            <p role="status" className="text-sm text-violet-300">
              Өөрчлөлтийг боловсруулж байна…
            </p>
          )}
        </form>
      </Modal>
    </div>
  );
}

function ProfileNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [confirmClear, setConfirmClear] = useState(false);
  const [notice, setNotice] = useState("");
  const action = usePendingRequest();
  useEffect(() => {
    let current = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort("timeout"), 15000);
    setLoading(true);
    setLoadError(null);
    requestJson("/api/notifications", { signal: controller.signal })
      .then((json) => {
        if (current)
          setNotifications(
            Array.isArray(json.notifications) ? json.notifications : [],
          );
      })
      .catch((cause) => {
        if (current) setLoadError(messageFor(cause, controller.signal));
      })
      .finally(() => {
        window.clearTimeout(timeout);
        if (current) setLoading(false);
      });
    return () => {
      current = false;
      controller.abort("unmounted");
      window.clearTimeout(timeout);
    };
  }, [retry]);
  async function markRead(id?: string) {
    const result = await action.run((signal) =>
      requestJson("/api/notifications/mark-read", {
        method: "POST",
        signal,
        ...(id
          ? {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id }),
            }
          : {}),
      }),
    );
    if (result) {
      setNotifications((items) =>
        items.map((item) =>
          !id || item.id === id ? { ...item, read: true } : item,
        ),
      );
      setNotice(
        id ? "Уншсанаар тэмдэглэлээ." : "Бүх мэдэгдлийг уншсанаар тэмдэглэлээ.",
      );
    }
  }
  async function clearAll() {
    const result = await action.run((signal) =>
      requestJson("/api/notifications/clear", { method: "POST", signal }),
    );
    if (result) {
      setNotifications([]);
      setConfirmClear(false);
      setNotice("Мэдэгдлүүд устгагдлаа.");
    }
  }
  const unread = notifications.filter((item) => !item.read).length;
  const visible =
    filter === "unread"
      ? notifications.filter((item) => !item.read)
      : notifications;
  return (
    <section
      className="max-w-5xl space-y-5"
      aria-labelledby="profile-notifications"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2
            id="profile-notifications"
            className="text-xl font-bold text-white"
          >
            Мэдэгдэл
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Таны бүтээлд ирсэн хариу болон шинэ мэдээлэл.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading || action.pending || !unread}
            className="mv-button-secondary"
            onClick={() => void markRead()}
          >
            Бүгдийг уншсан
          </button>
          <button
            type="button"
            disabled={loading || action.pending || !notifications.length}
            className="mv-button-secondary"
            onClick={() => {
              action.setError(null);
              setConfirmClear(true);
            }}
          >
            Бүгдийг устгах
          </button>
        </div>
      </div>
      <div className="flex gap-2" role="group" aria-label="Мэдэгдэл шүүх">
        {(["all", "unread"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            className={`min-h-11 rounded-xl border px-4 text-sm ${filter === value ? "border-violet-400/40 bg-violet-500/15 text-violet-200" : "border-white/10 text-slate-400 hover:text-white"}`}
            onClick={() => setFilter(value)}
          >
            {value === "all" ? "Бүгд" : `Уншаагүй · ${unread}`}
          </button>
        ))}
      </div>
      {notice && (
        <p role="status" className="text-sm text-emerald-300">
          {notice}
        </p>
      )}
      {action.error && !confirmClear && <ErrorNotice message={action.error} />}
      {loading ? (
        <p role="status" className="mv-panel p-6 text-sm text-slate-400">
          Мэдэгдлүүдийг ачаалж байна…
        </p>
      ) : loadError ? (
        <ErrorNotice
          message={loadError}
          onRetry={() => setRetry((value) => value + 1)}
        />
      ) : !visible.length ? (
        <div className="mv-panel p-8 text-center">
          <h3 className="text-lg font-semibold text-slate-200">
            {filter === "unread"
              ? "Уншаагүй мэдэгдэл алга"
              : "Мэдэгдэл хараахан алга"}
          </h3>
          <p className="mt-2 text-sm text-slate-400">
            {filter === "unread"
              ? "Та бүх мэдэгдлээ уншсан байна."
              : "Бүтээлд тань хариу ирэхэд энд харагдана."}
          </p>
          {filter === "unread" && notifications.length > 0 && (
            <button
              type="button"
              className="mv-button-secondary mt-4"
              onClick={() => setFilter("all")}
            >
              Бүх мэдэгдэл харах
            </button>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((item) => (
            <li
              key={item.id}
              className={`rounded-2xl border p-4 sm:p-5 ${item.read ? "border-white/10 bg-white/[0.02]" : "border-violet-400/25 bg-violet-500/[0.07]"}`}
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className={`mt-2 h-2 w-2 shrink-0 rounded-full ${item.read ? "bg-slate-600" : "bg-violet-400"}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="max-w-3xl whitespace-pre-wrap break-words text-sm leading-7 text-slate-200 sm:text-base sm:leading-8">
                    {item.message}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <time
                      dateTime={item.createdAt}
                      className="text-xs text-slate-400"
                    >
                      {dateLabel(item.createdAt)}
                    </time>
                    {!item.read && (
                      <button
                        type="button"
                        disabled={action.pending}
                        className="min-h-11 rounded-xl px-3 text-sm font-medium text-violet-300 hover:bg-violet-500/10 disabled:opacity-50"
                        onClick={() => void markRead(item.id)}
                      >
                        Уншсанаар тэмдэглэх
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Modal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Мэдэгдлүүдийг устгах уу?"
        busy={action.pending}
        footer={
          <>
            <button
              type="button"
              disabled={action.pending}
              onClick={() => setConfirmClear(false)}
              className="mv-button-secondary"
            >
              Болих
            </button>
            <button
              type="button"
              disabled={action.pending}
              onClick={() => void clearAll()}
              className="mv-button-primary"
            >
              {action.pending ? "Устгаж байна…" : "Бүгдийг устгах"}
            </button>
          </>
        }
      >
        <p className="text-sm leading-7 text-slate-300">
          Бүх мэдэгдэл арилна. Энэ үйлдлийг буцаах боломжгүй.
        </p>
        {action.error && (
          <div className="mt-4">
            <ErrorNotice message={action.error} />
          </div>
        )}
      </Modal>
    </section>
  );
}

function PostGrid({
  posts,
  isOwnProfile,
  onPostsChange,
}: {
  posts: UserPost[];
  isOwnProfile: boolean;
  onPostsChange: Dispatch<SetStateAction<UserPost[]>>;
}) {
  const [visibleCount, setVisibleCount] = useState(12);
  const [activeImage, setActiveImage] = useState<UserPost | null>(null);
  const [details, setDetails] = useState<UserPost | null>(null);
  const [editing, setEditing] = useState<UserPost | null>(null);
  const [deleting, setDeleting] = useState<UserPost | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [notice, setNotice] = useState("");
  const action = usePendingRequest();
  function openEdit(post: UserPost) {
    setEditing(post);
    setTitle(post.title);
    setDescription(post.description);
    setImageUrl(post.imageUrl || "");
    action.setError(null);
  }
  async function changeImage(file?: File) {
    if (!file) return;
    const uploaded = await action.run((signal) =>
      uploadImage(file, "neoncanvas/posts", signal),
    );
    if (uploaded) setImageUrl(uploaded);
  }
  async function savePost(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    if (title.trim().length < 3 || description.trim().length < 10) {
      action.setError("Гарчиг 3-аас, тайлбар 10-аас доошгүй тэмдэгттэй байна.");
      return;
    }
    const result = await action.run(async (signal) => {
      const url = `/api/posts?id=${encodeURIComponent(editing.id)}`;
      try {
        return await requestJson(url, {
          method: "PATCH",
          signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim(),
            imageUrl,
          }),
        });
      } catch (cause) {
        if (signal.aborted) throw cause;
        // A committed update can still lose its response. Verify before asking
        // the user to retry, without deleting or recreating the original post.
        const verified = await requestJson(url, { signal }).catch(() => null);
        const post = verified?.posts?.find(
          (item: UserPost) => item.id === editing.id,
        );
        if (
          post &&
          post.title === title.trim() &&
          post.description === description.trim() &&
          (post.imageUrl || "") === imageUrl
        )
          return { post };
        throw cause;
      }
    });
    if (result?.post) {
      onPostsChange((items) =>
        items.map((item) => (item.id === result.post.id ? result.post : item)),
      );
      invalidateCache("/api/posts");
      setEditing(null);
      setNotice("Бүтээлийн өөрчлөлт хадгалагдлаа.");
    }
  }
  async function deletePost() {
    if (!deleting) return;
    const postId = deleting.id;
    const result = await action.run((signal) =>
      requestJson(`/api/posts?id=${encodeURIComponent(postId)}`, {
        method: "DELETE",
        signal,
      }),
    );
    if (result) {
      onPostsChange((items) => items.filter((item) => item.id !== postId));
      invalidateCache("/api/posts");
      setDeleting(null);
      setNotice("Бүтээл устгагдлаа.");
    }
  }
  return (
    <>
      {notice && (
        <p role="status" className="mb-4 text-sm text-emerald-300">
          {notice}
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 sm:gap-5 xl:grid-cols-3 2xl:grid-cols-4">
        {posts.slice(0, visibleCount).map((post) => (
          <article
            key={post.id}
            className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#101320] transition-colors hover:border-violet-400/40"
          >
            <button
              type="button"
              className="block w-full text-left"
              aria-label={`${post.title}: ${post.imageUrl ? "зургийг томоор үзэх" : "тайлбар унших"}`}
              onClick={() =>
                post.imageUrl ? setActiveImage(post) : setDetails(post)
              }
            >
              {post.imageUrl ? (
                <PostImage
                  src={post.imageUrl}
                  alt={post.title}
                  rounded="rounded-none"
                  sizes="(max-width: 419px) calc(100vw - 32px), (max-width: 639px) calc((100vw - 48px) / 2), (max-width: 1023px) calc((100vw - 68px) / 2), (max-width: 1279px) calc((100vw - 316px) / 2), (max-width: 1535px) calc((100vw - 336px) / 3), (max-width: 1775px) calc((100vw - 396px) / 4), 345px"
                />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center bg-violet-500/5 px-6 text-center text-sm text-slate-400">
                  Бүтээлийн тайлбар унших
                </div>
              )}
            </button>
            <div className="flex flex-1 flex-col p-4 sm:p-5">
              <button
                type="button"
                onClick={() => setDetails(post)}
                title={post.title}
                className="line-clamp-2 min-h-12 w-full break-words text-left text-base font-semibold leading-6 text-slate-100 hover:text-violet-300"
              >
                {post.title}
              </button>
              <div className="mb-4 mt-3 flex flex-wrap justify-between gap-2 text-xs leading-5 text-slate-400 sm:text-sm">
                <time dateTime={post.createdAt}>
                  {dateLabel(post.createdAt)}
                </time>
                <span>{post.reactions?.length || 0} үнэлгээ</span>
              </div>
              {post.visibility === "PRIVATE" && (
                <p className="-mt-2 mb-4 text-xs text-amber-200">
                  Зөвхөн надад
                </p>
              )}
              {isOwnProfile && (
                <div className="mt-auto flex gap-2 border-t border-white/10 pt-4">
                  <button
                    type="button"
                    onClick={() => openEdit(post)}
                    className="mv-button-secondary flex-1"
                  >
                    Засах
                  </button>
                  <button
                    type="button"
                    aria-label={`${post.title} бүтээлийг устгах`}
                    onClick={() => {
                      action.setError(null);
                      setDeleting(post);
                    }}
                    className="min-h-11 rounded-xl px-3 text-sm text-slate-400 hover:bg-rose-400/10 hover:text-rose-300"
                  >
                    Устгах
                  </button>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
      {visibleCount < posts.length && (
        <div className="mt-6 text-center">
          <button
            type="button"
            className="mv-button-secondary"
            onClick={() => setVisibleCount((value) => value + 12)}
          >
            Цааш үзэх · {posts.length - visibleCount} бүтээл
          </button>
        </div>
      )}
      {activeImage?.imageUrl && (
        <ImageLightbox
          src={activeImage.imageUrl}
          alt={activeImage.title}
          onClose={() => setActiveImage(null)}
        />
      )}
      <Modal
        open={!!details}
        onClose={() => setDetails(null)}
        title={details?.title || "Бүтээлийн тайлбар"}
        wide
      >
        <p className="whitespace-pre-wrap break-words text-base leading-8 text-slate-200">
          {details?.description || "Тайлбар нэмээгүй байна."}
        </p>
        {details && (
          <p className="mt-5 text-sm text-slate-400">
            {dateLabel(details.createdAt)} · {details.reactions?.length || 0}{" "}
            үнэлгээ
          </p>
        )}
      </Modal>
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Бүтээл засах"
        busy={action.pending}
        wide
        footer={
          <>
            <button
              type="button"
              disabled={action.pending}
              onClick={() => setEditing(null)}
              className="mv-button-secondary"
            >
              Болих
            </button>
            <button
              type="submit"
              form="post-edit-form"
              disabled={action.pending}
              className="mv-button-primary"
            >
              {action.pending ? "Түр хүлээнэ үү…" : "Өөрчлөлт хадгалах"}
            </button>
          </>
        }
      >
        <form id="post-edit-form" onSubmit={savePost} className="space-y-5">
          <fieldset disabled={action.pending} className="space-y-5">
            <div>
              <label htmlFor="post-edit-title" className="mv-label">
                Бүтээлийн гарчиг
              </label>
              <input
                id="post-edit-title"
                className="mv-field mt-2"
                value={title}
                required
                minLength={3}
                maxLength={200}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="post-edit-description" className="mv-label">
                Тайлбар
              </label>
              <textarea
                id="post-edit-description"
                className="mv-field mt-2 min-h-40 resize-y"
                value={description}
                required
                minLength={10}
                maxLength={2000}
                onChange={(event) => setDescription(event.target.value)}
              />
              <p className="mt-1 text-right text-xs text-slate-400">
                {description.length}/2000 · хамгийн багадаа 10 тэмдэгт
              </p>
            </div>
            <div>
              <label htmlFor="post-edit-image" className="mv-label">
                Бүтээлийн зураг
              </label>
              {imageUrl && (
                <div className="mt-3 max-w-sm">
                  <PostImage
                    src={imageUrl}
                    alt="Сонгосон зургийн урьдчилсан харагдац"
                  />
                  <button
                    type="button"
                    className="mt-2 min-h-11 rounded-xl px-3 text-sm text-rose-300 hover:bg-rose-400/10"
                    onClick={() => setImageUrl("")}
                  >
                    Зургийг хасах
                  </button>
                </div>
              )}
              <label
                htmlFor="post-edit-image"
                className={`mv-button-secondary relative mt-3 focus-within:ring-2 focus-within:ring-violet-400 focus-within:ring-offset-2 focus-within:ring-offset-slate-950 ${action.pending ? "cursor-wait opacity-60" : "cursor-pointer"}`}
              >
                {imageUrl ? "Зураг солих" : "Зураг сонгох"}
                <input
                  id="post-edit-image"
                  type="file"
                  accept="image/*"
                  disabled={action.pending}
                  className="sr-only"
                  onChange={(event) => {
                    void changeImage(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              </label>
              <p className="mt-2 text-xs text-slate-400">
                5 МБ хүртэл. Шинэ зураг сонгоогүй бол одоогийн зураг хэвээр
                байна.
              </p>
            </div>
          </fieldset>
          {action.error && <ErrorNotice message={action.error} />}
          {action.pending && (
            <p role="status" className="text-sm text-violet-300">
              Өөрчлөлтийг боловсруулж байна…
            </p>
          )}
        </form>
      </Modal>
      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Бүтээлийг устгах уу?"
        busy={action.pending}
        footer={
          <>
            <button
              type="button"
              disabled={action.pending}
              className="mv-button-secondary"
              onClick={() => setDeleting(null)}
            >
              Болих
            </button>
            <button
              type="button"
              disabled={action.pending}
              className="mv-button-primary"
              onClick={() => void deletePost()}
            >
              {action.pending ? "Устгаж байна…" : "Бүтээл устгах"}
            </button>
          </>
        }
      >
        <p className="break-words text-sm leading-7 text-slate-300">
          “{deleting?.title}” бүтээл устгагдана. Энэ үйлдлийг буцаах боломжгүй.
        </p>
        {action.error && (
          <div className="mt-4">
            <ErrorNotice message={action.error} />
          </div>
        )}
      </Modal>
    </>
  );
}
