"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "../auth/useSession";

type Comment = {
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

export function CommentsSection({
  postId,
  comments,
  initialCommentCount = comments?.length ?? 0,
  onCommentAdded,
}: {
  postId: string;
  comments?: Comment[];
  initialCommentCount?: number;
  onCommentAdded?: (comment: Comment) => void;
}) {
  const { session } = useSession();
  const router = useRouter();
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [loaded, setLoaded] = useState(Array.isArray(comments));
  const [localComments, setLocalComments] = useState<Comment[]>(comments || []);
  const [loading, setLoading] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replySubmitting, setReplySubmitting] = useState<string | null>(null);
  const [collapsedComments, setCollapsedComments] = useState<Record<string, boolean>>({});

  async function safeJson(res: Response) {
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) return null;
    try {
      return await res.json();
    } catch {
      return null;
    }
  }

  async function safeText(res: Response) {
    try {
      return await res.text();
    } catch {
      return "";
    }
  }

  useEffect(() => {
    setCommentText("");
    setSubmitting(false);
    setShowInput(false);
    setLoaded(Array.isArray(comments));
    setLocalComments(comments || []);
    setLoading(false);
    setReplyDrafts({});
    setReplySubmitting(null);
    setCollapsedComments({});
  }, [postId]);

  useEffect(() => {
    if (!Array.isArray(comments)) return;
    setLocalComments(comments);
    setLoaded(true);
  }, [comments]);

  const loadComments = useCallback(async () => {
    if (loaded || loading) return localComments;
    setLoading(true);
    try {
      const res = await fetch(`/api/posts/comments?postId=${encodeURIComponent(postId)}`, {
        cache: "no-store",
      });
      const json = await safeJson(res);
      if (res.ok && json && Array.isArray(json.comments)) {
        const nextComments = json.comments as Comment[];
        setLocalComments(nextComments);
        setLoaded(true);
        return nextComments;
      } else if (!res.ok) {
        console.error("Load comments failed:", res.status);
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, [loaded, loading, localComments, postId]);

  useEffect(() => {
    if (loaded || initialCommentCount <= 0) return;
    void loadComments();
  }, [initialCommentCount, loaded, loadComments]);

  async function submitComment(content: string, parentCommentId?: string) {
    if (!session || !content.trim()) return;

    if (!loaded) {
      await loadComments();
    }

    if (parentCommentId) {
      setReplySubmitting(parentCommentId);
    } else {
      setSubmitting(true);
    }

    try {
      const res = await fetch("/api/posts/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, content: content.trim(), parentCommentId }),
      });

      const json = await safeJson(res);
      if (!res.ok || !json?.comment) {
        const fallback = !json ? await safeText(res) : "";
        alert(json?.error || fallback || `Алдаа гарлаа (status ${res.status})`);
        return;
      }

      const newComment: Comment = {
        ...json.comment,
        postId: json.comment.postId || postId,
        authorEmail: json.comment.authorEmail || session.email,
        content: json.comment.content || content.trim(),
        isAI: Boolean(json.comment.isAI),
        parentCommentId: json.comment.parentCommentId || parentCommentId || null,
        createdAt: json.comment.createdAt || new Date().toISOString(),
      };

      if (onCommentAdded) {
        onCommentAdded(newComment);
      }

      setLocalComments((prev) => [
        ...prev.filter((comment) => comment.id !== newComment.id),
        newComment,
      ]);
      setLoaded(true);

      if (parentCommentId) {
        setReplyDrafts((prev) => {
          const next = { ...prev };
          delete next[parentCommentId];
          return next;
        });
      } else {
        setCommentText("");
        setShowInput(false);
      }
    } catch (err: any) {
      alert(err.message || "Сүлжээний алдаа гарлаа");
    } finally {
      setSubmitting(false);
      setReplySubmitting(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session || !commentText.trim()) return;
    await submitComment(commentText);
  }

  const aiComments = localComments.filter((c) => c.isAI) || [];
  const userComments = localComments.filter((c) => !c.isAI) || [];
  const showAIPending = loaded && aiComments.length === 0 && userComments.length === 0;

  const grouped = userComments.reduce<Record<string, Comment[]>>((acc, c) => {
    const key = c.parentCommentId || "root";
    acc[key] = acc[key] || [];
    acc[key].push(c);
    return acc;
  }, {});
  const topLevel = grouped["root"] || [];
  const repliesFor = (id: string) => grouped[id] || [];

  return (
    <div className="mt-4 space-y-3 pt-2">
      {/* Lazy load trigger */}
      {!loaded && (
        <button
          onClick={loadComments}
          className="text-xs font-semibold text-violet-400 hover:text-violet-300 flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 transition-all hover:bg-violet-500/20"
        >
          <span className="material-symbols-outlined text-[16px]">chat_bubble_outline</span>
          <span>Сэтгэгдлүүдийг дэлгэж харах ({initialCommentCount})</span>
        </button>
      )}

      {loading && (
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-dark-900/60 px-4 py-3 text-xs text-slate-400 animate-pulse">
          <span className="w-2 h-2 rounded-full bg-violet-400 animate-ping" />
          <span>Сэтгэгдлүүдийг ачаалж байна...</span>
        </div>
      )}

      {showAIPending && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-cyan-500/30 bg-cyan-950/20 px-4 py-3 text-xs text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.1)]">
          <span className="text-base animate-bounce">🤖</span>
          <span>AI Шүүмжлэгч энэ пост дээр 10–20 сек дотор автоматаар шүүмж бичнэ...</span>
        </div>
      )}

      {/* AI Comments Card */}
      {aiComments.map((comment) => (
        <div
          key={comment.id}
          className="relative overflow-hidden rounded-2xl border border-cyan-500/40 bg-gradient-to-r from-cyan-950/40 via-dark-900/80 to-blue-950/40 p-4 shadow-[0_4px_20px_rgba(6,182,212,0.15)]"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-lg shadow-[0_0_12px_rgba(6,182,212,0.5)]">
              🤖
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-cyan-200">AI Дизайн Шүүмжлэгч</span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-300 font-semibold uppercase tracking-wider">
                    ✨ Автомат зөвлөх
                  </span>
                </div>
                <span className="text-[10px] text-slate-500">{formatRelativeTime(comment.createdAt)}</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-line font-normal">
                {comment.content}
              </p>
            </div>
          </div>
        </div>
      ))}

      {/* User Comments with Threaded Replies */}
      {topLevel.map((comment) => {
        const replies = repliesFor(comment.id);
        const replyDraft = replyDrafts[comment.id] || "";
        const isReplying = replyDrafts.hasOwnProperty(comment.id);
        const isSending = replySubmitting === comment.id;
        const isCollapsed = collapsedComments[comment.id];

        return (
          <div key={comment.id} className="rounded-2xl border border-white/5 bg-dark-900/60 p-3.5 space-y-2 hover:border-white/10 transition-all">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  router.push(`/profile?user=${encodeURIComponent(comment.authorEmail)}`);
                }}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-dark-800 text-xs font-bold text-white cursor-pointer hover:scale-110 hover:ring-2 hover:ring-violet-400/50 transition-all overflow-hidden"
                title={`${(comment.authorName || comment.authorEmail).split("@")[0]}-н профиль харах`}
                style={{ 
                  pointerEvents: 'auto',
                  backgroundColor: comment.authorAvatarColor || undefined
                }}
              >
                {comment.authorAvatarUrl ? (
                  <img
                    src={comment.authorAvatarUrl}
                    alt={comment.authorName || comment.authorEmail}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover rounded-full"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : (
                  (comment.authorName || comment.authorEmail)[0].toUpperCase()
                )}
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        router.push(`/profile?user=${encodeURIComponent(comment.authorEmail)}`);
                      }}
                      className="text-xs font-bold text-slate-200 hover:text-violet-300 transition-colors cursor-pointer"
                    >
                      {comment.authorName || comment.authorEmail.split("@")[0]}
                    </button>
                    <span className="text-[10px] text-slate-500">{formatRelativeTime(comment.createdAt)}</span>
                  </div>

                  {replies.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setCollapsedComments((prev) => ({ ...prev, [comment.id]: !isCollapsed }))}
                      className="text-[10px] text-slate-400 hover:text-violet-300 border border-white/10 rounded-full px-2.5 py-0.5 transition-colors"
                    >
                      {isCollapsed ? `+${replies.length} хариулт дэлгэх` : "Хураах"}
                    </button>
                  )}
                </div>

                {!isCollapsed && (
                  <>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">{comment.content}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setReplyDrafts((prev) => ({
                            ...prev,
                            [comment.id]: prev[comment.id] || "",
                          }));
                        }}
                        className="text-[11px] font-semibold text-slate-400 hover:text-violet-300 flex items-center gap-1 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[14px]">reply</span>
                        <span>Хариулах</span>
                      </button>
                    </div>

                    {/* Inline Reply Drawer */}
                    {isReplying && (
                      <div className="mt-3 space-y-2 p-3 rounded-xl bg-dark-950/80 border border-white/10">
                        <textarea
                          value={replyDraft}
                          onChange={(e) =>
                            setReplyDrafts((prev) => ({ ...prev, [comment.id]: e.target.value }))
                          }
                          placeholder="Хариу бичих..."
                          className="w-full rounded-xl border border-white/10 bg-dark-900 px-3 py-2 text-xs sm:text-sm text-slate-200 placeholder:text-slate-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50 resize-none"
                          rows={2}
                          disabled={isSending}
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            disabled={isSending}
                            onClick={() =>
                              setReplyDrafts((prev) => {
                                const next = { ...prev };
                                delete next[comment.id];
                                return next;
                              })
                            }
                            className="rounded-full border border-white/10 px-3 py-1 text-[11px] font-medium text-slate-400 hover:text-white hover:border-white/20 transition-colors"
                          >
                            Цуцлах
                          </button>
                          <button
                            type="button"
                            disabled={isSending || !replyDraft.trim()}
                            onClick={() => submitComment(replyDraft, comment.id)}
                            className="rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-1 text-[11px] font-bold text-white shadow-[0_0_12px_rgba(124,58,237,0.4)] hover:shadow-[0_0_16px_rgba(124,58,237,0.6)] disabled:opacity-60 transition-all"
                          >
                            {isSending ? "Илгээж байна..." : "Илгээх"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Nested Replies Thread */}
                    {replies.length > 0 && (
                      <div className="space-y-2 pl-4 sm:pl-6 mt-3 border-l-2 border-violet-500/20">
                        {replies.map((reply) => (
                          <div
                            key={reply.id}
                            className="rounded-xl border border-white/5 bg-dark-950/40 p-2.5 space-y-1"
                          >
                            <div className="flex items-start gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  router.push(`/profile?user=${encodeURIComponent(reply.authorEmail)}`);
                                }}
                                className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-dark-800 text-[10px] font-bold text-white cursor-pointer hover:ring-2 hover:ring-violet-400/50 transition-all overflow-hidden"
                                title={`${(reply.authorName || reply.authorEmail).split("@")[0]}-н профиль харах`}
                                style={{ 
                                  pointerEvents: 'auto',
                                  backgroundColor: reply.authorAvatarColor || undefined 
                                }}
                              >
                                {reply.authorAvatarUrl ? (
                                  <img
                                    src={reply.authorAvatarUrl}
                                    alt={reply.authorName || reply.authorEmail}
                                    loading="lazy"
                                    decoding="async"
                                    className="w-full h-full object-cover rounded-full"
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                  />
                                ) : (
                                  (reply.authorName || reply.authorEmail)[0].toUpperCase()
                                )}
                              </button>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      router.push(`/profile?user=${encodeURIComponent(reply.authorEmail)}`);
                                    }}
                                    className="text-[11px] font-bold text-slate-200 hover:text-violet-300 transition-colors"
                                  >
                                    {reply.authorName || reply.authorEmail.split("@")[0]}
                                  </button>
                                  <span className="text-[9px] text-slate-500">{formatRelativeTime(reply.createdAt)}</span>
                                </div>
                                <p className="text-xs text-slate-300 leading-relaxed font-normal">{reply.content}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Add New Comment Box */}
      {session ? (
        <div className="pt-2">
          {!showInput ? (
            <button
              onClick={() => setShowInput(true)}
              className="w-full text-xs font-semibold text-slate-400 hover:text-white flex items-center justify-between px-4 py-2.5 rounded-2xl bg-dark-900/80 border border-white/10 hover:border-violet-500/40 transition-all group"
            >
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-violet-600/30 border border-violet-500/40 flex items-center justify-center text-[10px] font-bold text-violet-300">
                  {(session.nickname || session.name || session.email)[0].toUpperCase()}
                </span>
                <span>Сэтгэгдэл бичих...</span>
              </div>
              <span className="material-symbols-outlined text-[18px] text-slate-500 group-hover:text-violet-400 transition-colors">edit_note</span>
            </button>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-2.5 p-3.5 rounded-2xl bg-dark-900 border border-violet-500/30 shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-violet-400" />
                  <span>Сэтгэгдэл оруулах</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setShowInput(false);
                    setCommentText("");
                  }}
                  disabled={submitting}
                  className="text-slate-500 hover:text-white transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Таны санал бодол, зөвлөмж..."
                className="w-full rounded-xl border border-white/10 bg-dark-950 px-3.5 py-2.5 text-xs sm:text-sm text-slate-200 placeholder:text-slate-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50 resize-none"
                rows={3}
                disabled={submitting}
                autoFocus
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowInput(false);
                    setCommentText("");
                  }}
                  disabled={submitting}
                  className="rounded-full border border-white/10 px-4 py-1.5 text-xs font-medium text-slate-400 hover:text-white hover:border-white/20 transition-colors"
                >
                  Болих
                </button>
                <button
                  type="submit"
                  disabled={submitting || !commentText.trim()}
                  className="rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-1.5 text-xs font-bold text-white shadow-[0_0_15px_rgba(124,58,237,0.4)] hover:shadow-[0_0_20px_rgba(124,58,237,0.6)] disabled:opacity-60 transition-all flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">send</span>
                  <span>{submitting ? "Илгээж байна..." : "Илгээх"}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => router.push("/login")}
          className="w-full text-xs font-semibold text-slate-400 hover:text-white flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-dark-900/80 border border-white/10 hover:border-violet-500/40 transition-all"
        >
          <span className="material-symbols-outlined text-[16px]">login</span>
          <span>Нэвтэрч сэтгэгдэл бичнэ үү</span>
        </button>
      )}
    </div>
  );
}
