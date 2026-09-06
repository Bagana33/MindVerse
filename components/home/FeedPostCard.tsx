"use client";

import React, { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { CommentsSection } from "../posts/CommentsSection";

export type ReactionType = "FIRE" | "WOW" | "LOVE" | "COOL" | "STAR";

export type PostReaction = {
  userEmail: string;
  type: string;
};

export type Comment = {
  id: string;
  postId: string;
  authorEmail: string;
  authorName?: string;
  authorAvatarUrl?: string;
  authorAvatarColor?: string;
  content: string;
  isAI: boolean;
  parentCommentId?: string | null;
  createdAt: string;
};

export type UserPost = {
  id: string;
  title: string;
  description: string;
  author: string;
  authorEmail: string;
  authorAvatarUrl?: string;
  authorAvatarColor?: string;
  points: number;
  commentCount?: number;
  createdAt: string;
  imageUrl?: string;
  reactions: PostReaction[];
  visibility?: "PUBLIC" | "PRIVATE";
  comments?: Comment[];
};

export function formatRelativeTime(dateString: string) {
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

interface FeedPostCardProps {
  post: UserPost;
  currentEmail?: string;
  authorXp?: number;
  isCommentsOpen: boolean;
  commentCount: number;
  onToggleComments: (postId: string) => void;
  onReaction: (postId: string, type: ReactionType) => void;
  onShare: (postId: string, title: string, description: string) => void;
  onLightbox: (src: string, alt: string) => void;
  onCommentAdded: (postId: string, comment: Comment) => void;
  copied: boolean;
}

export const FeedPostCard = React.memo(function FeedPostCard({
  post,
  currentEmail,
  authorXp = 0,
  isCommentsOpen,
  commentCount,
  onToggleComments,
  onReaction,
  onShare,
  onLightbox,
  onCommentAdded,
  copied,
}: FeedPostCardProps) {
  const router = useRouter();
  const [imgOrient, setImgOrient] = useState<"portrait" | "landscape" | "square">("square");

  const handleImgLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
    if (!w || !h) return;
    const ratio = w / h;
    if (ratio < 0.85) setImgOrient("portrait");
    else if (ratio > 1.25) setImgOrient("landscape");
    else setImgOrient("square");
  }, []);

  const reactions = useMemo(() => ({
    fire: post.reactions.filter((r) => r.type === "FIRE").length,
    wow: post.reactions.filter((r) => r.type === "WOW").length,
    love: post.reactions.filter((r) => r.type === "LOVE").length,
    cool: post.reactions.filter((r) => r.type === "COOL").length,
    star: post.reactions.filter((r) => r.type === "STAR").length,
  }), [post.reactions]);

  const myReaction = useMemo(() => {
    if (!currentEmail) return null;
    return post.reactions.find((r) => r.userEmail === currentEmail)?.type ?? null;
  }, [post.reactions, currentEmail]);

  const totalReactions = useMemo(
    () => Object.values(reactions).reduce((a, b) => a + b, 0),
    [reactions]
  );

  const imgAspectClass =
    imgOrient === "portrait"
      ? "aspect-[4/5] max-h-[640px]"
      : imgOrient === "landscape"
      ? "aspect-[16/9] max-h-[420px]"
      : "aspect-square max-h-[600px]";

  const imgOrientLabel =
    imgOrient === "portrait" ? "Босоо" : imgOrient === "landscape" ? "Хэвтээ" : "Квадрат";
  const imgOrientIcon =
    imgOrient === "portrait"
      ? "crop_portrait"
      : imgOrient === "landscape"
      ? "crop_landscape"
      : "crop_square";

  const loved = myReaction === "LOVE";

  return (
    <article
      style={{ contentVisibility: "auto", containIntrinsicSize: "500px" }}
      className="rounded-2xl bg-nc-panel border border-nc-border/50 shadow-[0_4px_24px_rgba(0,0,0,0.7)] overflow-hidden transition-all duration-300 hover:border-primary-500/60 hover:shadow-[0_8px_40px_rgba(139,92,246,0.22)] group/card"
    >
      {/* ── Image + overlaid header ───────────────────── */}
      <div className="relative w-full">
        {post.imageUrl ? (
          <button
            type="button"
            onClick={() => onLightbox(post.imageUrl!, post.title)}
            className={`relative w-full ${imgAspectClass} overflow-hidden cursor-zoom-in text-left block focus:outline-none group/photo transition-all duration-300`}
          >
            {/* Main image */}
            <img
              src={post.imageUrl}
              alt={post.title}
              loading="lazy"
              decoding="async"
              onLoad={handleImgLoad}
              className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover/photo:scale-[1.04]"
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
        <div
          className={`${
            post.imageUrl
              ? "absolute top-0 left-0 right-0"
              : "relative bg-nc-panel border-b border-nc-border/40"
          } flex items-center justify-between px-4 py-3`}
        >
          <div className="flex items-center gap-3 min-w-0">
            {/* Avatar with violet gradient ring */}
            <button
              type="button"
              onClick={() => {
                if (
                  post.authorEmail &&
                  post.authorEmail !== "news-bot" &&
                  post.authorEmail !== "ai-assistant"
                ) {
                  router.push(`/profile?user=${encodeURIComponent(post.authorEmail)}`);
                }
              }}
              className="relative p-[2px] rounded-full bg-gradient-to-tr from-primary-500 via-pink-500 to-primary-400 shrink-0 cursor-pointer shadow-lg"
            >
              <div
                className="w-9 h-9 rounded-full bg-dark-800 flex items-center justify-center text-white font-bold text-sm border-[2px] border-black/50 overflow-hidden"
                style={{ backgroundColor: post.authorAvatarColor || undefined }}
              >
                {post.authorEmail === "news-bot" ? (
                  "📰"
                ) : post.authorAvatarUrl ? (
                  <img
                    src={post.authorAvatarUrl}
                    alt={post.author}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover rounded-full"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
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
                    if (
                      post.authorEmail &&
                      post.authorEmail !== "news-bot" &&
                      post.authorEmail !== "ai-assistant"
                    ) {
                      router.push(`/profile?user=${encodeURIComponent(post.authorEmail)}`);
                    }
                  }}
                  className={`font-bold text-[13px] cursor-pointer truncate transition-colors ${
                    post.imageUrl
                      ? "text-white hover:text-primary-300 drop-shadow-md"
                      : "text-nc-ink hover:text-primary-400"
                  }`}
                >
                  {post.author}
                </span>
                {post.authorEmail === "news-bot" && (
                  <span className="inline-flex items-center gap-0.5 rounded-full border border-cyan-400/40 bg-black/40 backdrop-blur-sm px-2 py-0.5 text-[10px] text-cyan-300 font-semibold shrink-0">
                    🤖 AI
                  </span>
                )}
              </div>
              <span
                className={`text-[11px] drop-shadow-md ${
                  post.imageUrl ? "text-white/70" : "text-nc-muted"
                }`}
              >
                {formatRelativeTime(post.createdAt)}
              </span>
            </div>
          </div>

          {/* Right: XP */}
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide border ${
                post.imageUrl
                  ? "border-white/20 bg-black/40 backdrop-blur-sm text-white/90"
                  : "border-primary-500/30 bg-primary-500/10 text-primary-400"
              }`}
            >
              ✦ {Math.round(authorXp)} XP
            </span>
          </div>
        </div>
      </div>

      {/* ── Action bar ─── */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Heart */}
            <button
              type="button"
              disabled={!currentEmail}
              onClick={() => onReaction(post.id, "LOVE")}
              className={`flex items-center gap-1.5 transition-all duration-150 active:scale-90 group/heart disabled:opacity-50 ${
                loved ? "text-pink-400" : "text-nc-muted hover:text-pink-400"
              }`}
              title={currentEmail ? "Дур" : "Нэвтэрч реакц өгнө үү"}
            >
              <span
                className={`material-symbols-outlined text-[22px] transition-transform group-hover/heart:scale-110 ${
                  loved ? "filled text-pink-400 drop-shadow-[0_0_6px_rgba(236,72,153,0.7)]" : ""
                }`}
              >
                {loved ? "favorite" : "favorite_border"}
              </span>
              <span className="text-[13px] font-semibold tabular-nums">
                {totalReactions > 0 ? totalReactions.toLocaleString() : ""}
              </span>
            </button>

            {/* Comment toggle */}
            <button
              type="button"
              onClick={() => onToggleComments(post.id)}
              className={`flex items-center gap-1.5 transition-all duration-150 active:scale-90 group/comment ${
                isCommentsOpen ? "text-primary-400" : "text-nc-muted hover:text-primary-400"
              }`}
              title="Сэтгэгдэл харах"
            >
              <span
                className={`material-symbols-outlined text-[22px] transition-transform group-hover/comment:scale-110 ${
                  isCommentsOpen ? "drop-shadow-[0_0_6px_rgba(139,92,246,0.7)]" : ""
                }`}
              >
                {isCommentsOpen ? "chat_bubble" : "chat_bubble_outline"}
              </span>
              <span className="text-[13px] font-semibold tabular-nums">
                {commentCount > 0 ? commentCount.toLocaleString() : ""}
              </span>
            </button>

            {/* Other Reactions */}
            <div className="flex items-center gap-1 text-nc-muted">
              {[
                { type: "FIRE" as const, emoji: "🔥" },
                { type: "WOW" as const, emoji: "😯" },
                { type: "COOL" as const, emoji: "😎" },
                { type: "STAR" as const, emoji: "⭐" },
              ].map((b) => {
                const count = reactions[b.type.toLowerCase() as keyof typeof reactions] || 0;
                const active = myReaction === b.type;
                return (
                  <button
                    key={b.type}
                    type="button"
                    disabled={!currentEmail}
                    onClick={() => onReaction(post.id, b.type)}
                    title={b.type}
                    className={`flex items-center gap-0.5 text-[13px] transition-all duration-100 active:scale-90 hover:scale-110 disabled:opacity-50 ${
                      active
                        ? "drop-shadow-[0_0_6px_rgba(255,255,255,0.5)]"
                        : "opacity-60 hover:opacity-100"
                    }`}
                  >
                    <span className="leading-none">{b.emoji}</span>
                    {count > 0 && (
                      <span className="text-[11px] font-semibold text-nc-muted">{count}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Share */}
            <button
              type="button"
              onClick={() => onShare(post.id, post.title, post.description)}
              className={`flex items-center gap-1.5 transition-all duration-150 active:scale-90 group/share ${
                copied ? "text-emerald-400" : "text-nc-muted hover:text-primary-400"
              }`}
              title="Хуваалцах"
            >
              <span className="material-symbols-outlined text-[22px] transition-transform group-hover/share:scale-110">
                {copied ? "check_circle" : "send"}
              </span>
            </button>
          </div>

          {/* Bookmark */}
          <button
            type="button"
            className="text-nc-muted hover:text-primary-400 transition-colors"
            title="Хадгалах"
          >
            <span className="material-symbols-outlined text-[22px]">bookmark_border</span>
          </button>
        </div>
      </div>

      {/* ── Caption ─── */}
      <div className="px-4 pb-3 space-y-1">
        {totalReactions > 0 && (
          <p className="text-[12px] font-bold text-nc-ink">
            {totalReactions.toLocaleString()} хүн реакц өгсөн
          </p>
        )}

        {post.title && (
          <h2 className="text-[13px] font-extrabold text-nc-ink leading-snug">{post.title}</h2>
        )}

        <p className="text-[13px] text-nc-muted leading-relaxed whitespace-pre-line">
          <span
            onClick={() => {
              if (
                post.authorEmail &&
                post.authorEmail !== "news-bot" &&
                post.authorEmail !== "ai-assistant"
              ) {
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

      {/* ── Comments section ─── */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isCommentsOpen ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-4 pb-4 border-t border-nc-border/30 pt-3">
          <CommentsSection
            postId={post.id}
            comments={post.comments}
            initialCommentCount={commentCount}
            onCommentAdded={(newComment) => onCommentAdded(post.id, newComment)}
          />
        </div>
      </div>
    </article>
  );
});
