"use client";

import { memo, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import PostImage from "../posts/PostImage";

const CommentsSection = dynamic(
  () => import("../posts/CommentsSection").then((module) => module.CommentsSection),
  { loading: () => <p className="py-4 text-sm text-nc-muted" role="status">Сэтгэгдэл ачаалж байна…</p> }
);

export type ReactionType = "FIRE" | "WOW" | "LOVE" | "COOL" | "STAR";
export type PostReaction = { userEmail: string; type: string };
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
  authorGrade?: string;
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
  const minutes = Math.floor(Math.max(0, Date.now() - timestamp) / 60000);
  if (minutes < 1) return "Дөнгөж сая";
  if (minutes < 60) return `${minutes} минутын өмнө`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} цагийн өмнө`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} өдрийн өмнө`;
  const date = new Date(dateString);
  return `${date.getMonth() + 1}-р сарын ${date.getDate()}`;
}

const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: "LOVE", emoji: "♥", label: "Таалагдлаа" },
  { type: "FIRE", emoji: "🔥", label: "Гайхалтай" },
  { type: "WOW", emoji: "😯", label: "Гайхшрууллаа" },
  { type: "COOL", emoji: "😎", label: "Дажгүй" },
  { type: "STAR", emoji: "⭐", label: "Онцгой" },
];

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
  priority?: boolean;
}

export const FeedPostCard = memo(function FeedPostCard({
  post, currentEmail, authorXp = 0, isCommentsOpen, commentCount,
  onToggleComments, onReaction, onShare, onLightbox, onCommentAdded, copied, priority = false,
}: FeedPostCardProps) {
  const [failedAvatar, setFailedAvatar] = useState<string | null>(null);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  // Once opened, keep the comment editor mounted so closing it preserves drafts.
  const [commentsVisited, setCommentsVisited] = useState(isCommentsOpen);
  if (isCommentsOpen && !commentsVisited) setCommentsVisited(true);

  const reactions = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const reaction of post.reactions) counts[reaction.type] = (counts[reaction.type] ?? 0) + 1;
    return counts;
  }, [post.reactions]);
  const myReaction = post.reactions.find((reaction) => reaction.userEmail === currentEmail)?.type;
  const canViewProfile = Boolean(post.authorEmail && !["news-bot", "ai-assistant"].includes(post.authorEmail));
  const profileHref = `/profile?user=${encodeURIComponent(post.authorEmail)}`;
  const author = post.author || post.authorEmail.split("@")[0] || "Бүтээгч";
  const avatar = (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-nc-border bg-primary-500/15 text-sm font-bold text-nc-ink" style={{ backgroundColor: post.authorAvatarColor || undefined }}>
      {post.authorEmail === "news-bot" ? "📰" : post.authorAvatarUrl && failedAvatar !== post.authorAvatarUrl ? (
        <img src={post.authorAvatarUrl} alt="" width={44} height={44} loading="lazy" decoding="async" className="h-full w-full object-cover" onError={() => setFailedAvatar(post.authorAvatarUrl!)} />
      ) : author[0]?.toUpperCase()}
    </span>
  );
  const longDescription = post.description.length > 320 || post.description.split("\n").length > 5;

  return (
    <article
      id={`post-${post.id}`}
      style={{ contentVisibility: "auto", containIntrinsicSize: post.imageUrl ? "auto 620px" : "auto 250px" }}
      className="mv-feed-card overflow-hidden rounded-2xl border border-white/10 bg-nc-panel shadow-sm"
    >
      <header className="flex items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {canViewProfile ? <Link href={profileHref} prefetch={false} aria-label={`${author}-ийн профайл`} className="rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-400">{avatar}</Link> : avatar}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {canViewProfile ? <Link href={profileHref} prefetch={false} className="truncate text-sm font-semibold text-nc-ink sm:text-base hover:text-primary-400">{author}</Link> : <span className="text-sm font-bold text-nc-ink">{author}</span>}
              {post.authorEmail === "news-bot" && <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[11px] font-semibold text-cyan-500">Мэдээ</span>}
              {post.authorGrade === "graduated" && <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-500">🎓 Төгсөгч</span>}
              {post.visibility === "PRIVATE" && <span className="text-[11px] text-nc-muted">Зөвхөн танд</span>}
            </div>
            <time dateTime={post.createdAt} className="text-xs text-nc-muted">{formatRelativeTime(post.createdAt)}</time>
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-primary-500/20 bg-primary-500/10 px-2.5 py-1 text-xs font-semibold text-primary-400">✦ {Math.round(authorXp)} XP</span>
      </header>

      {post.imageUrl && (
        <button type="button" onClick={() => onLightbox(post.imageUrl!, post.title)} aria-label={`${post.title}: зургийг томоор харах`} className="group/photo relative block w-full cursor-zoom-in focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-400">
          <PostImage src={post.imageUrl} alt={post.title} rounded="rounded-none" priority={priority} className="mv-feed-art" sizes="(min-width: 1536px) 1000px, (min-width: 1280px) calc(100vw - 650px), (min-width: 1024px) calc(100vw - 320px), (min-width: 768px) calc(100vw - 48px), calc(100vw - 32px)" />
          <span className="absolute bottom-3 right-3 rounded-full border border-white/20 bg-black/60 px-3 py-1.5 text-xs text-white">Томоор харах ↗</span>
        </button>
      )}

      <div className="space-y-2 px-4 pt-5 sm:px-6">
        {post.title && <h2 className="break-words text-lg font-semibold leading-snug lg:text-xl text-nc-ink">{post.title}</h2>}
        <p id={`description-${post.id}`} className={`max-w-[75ch] whitespace-pre-line break-words text-sm leading-7 text-slate-400 lg:text-base ${longDescription && !descriptionExpanded ? "line-clamp-4" : ""}`}>{post.description}</p>
        {longDescription && <button type="button" aria-expanded={descriptionExpanded} aria-controls={`description-${post.id}`} onClick={() => setDescriptionExpanded((value) => !value)} className="min-h-11 text-sm font-semibold text-primary-400 hover:underline">{descriptionExpanded ? "Хураах" : "Дэлгэрэнгүй унших"}</button>}
      </div>

      <div className="mx-4 mt-4 border-t border-white/[.07] py-3 sm:mx-6 sm:flex sm:items-center sm:gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-1">
          {REACTIONS.map((reaction) => {
            const active = myReaction === reaction.type;
            const count = reactions[reaction.type] ?? 0;
            return (
              <button key={reaction.type} type="button" disabled={!currentEmail} onClick={() => onReaction(post.id, reaction.type)} aria-label={`${reaction.label}${count ? `: ${count}` : ""}`} aria-pressed={active} title={currentEmail ? reaction.label : "Реакц өгөхийн тулд нэвтэрнэ үү"} className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-lg px-2 text-base transition-colors disabled:opacity-50 ${active ? "bg-primary-500/15 text-primary-400 ring-1 ring-inset ring-primary-400/40" : "text-nc-muted hover:bg-primary-500/10"}`}>
                <span aria-hidden="true" className={reaction.type === "LOVE" ? "text-xl text-pink-400" : ""}>{reaction.emoji}</span>
                {count > 0 && <span className="text-xs font-semibold tabular-nums">{count}</span>}
              </button>
            );
          })}
          <button type="button" onClick={() => onShare(post.id, post.title, post.description)} aria-label={copied ? "Холбоос хуулагдлаа" : "Бүтээлийг хуваалцах"} title="Хуваалцах" className={`ml-auto flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-primary-500/10 ${copied ? "text-emerald-500" : "text-nc-muted"}`}>
            <span className="material-symbols-outlined text-xl" aria-hidden="true">{copied ? "check_circle" : "ios_share"}</span>
          </button>
        </div>
        <button type="button" onClick={() => onToggleComments(post.id)} aria-expanded={isCommentsOpen} aria-controls={`comments-${post.id}`} className="flex min-h-11 shrink-0 items-center gap-2 text-sm text-nc-muted hover:text-primary-400">
          <span className="material-symbols-outlined text-lg" aria-hidden="true">chat_bubble_outline</span>
          {commentCount > 0 ? `${commentCount.toLocaleString()} сэтгэгдэл` : "Сэтгэгдэл бичих"}
          <span aria-hidden="true">{isCommentsOpen ? "↑" : "↓"}</span>
        </button>
      </div>

      <div id={`comments-${post.id}`} hidden={!isCommentsOpen}>
        {commentsVisited && <div className="border-t border-nc-border px-4 pb-4 sm:px-6"><CommentsSection postId={post.id} comments={post.comments} initialCommentCount={commentCount} onCommentAdded={(comment) => onCommentAdded(post.id, comment)} /></div>}
      </div>
    </article>
  );
});
