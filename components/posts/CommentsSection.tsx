"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "../auth/useSession";

type Comment = {
  id: string;
  postId: string;
  authorEmail: string;
  content: string;
  isAI: boolean;
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
  onCommentAdded,
}: {
  postId: string;
  comments?: Comment[];
  onCommentAdded?: (comment: Comment) => void;
}) {
  const { session } = useSession();
  const router = useRouter();
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [loaded, setLoaded] = useState(!!comments && comments.length > 0);
  const [localComments, setLocalComments] = useState<Comment[]>(comments || []);
  const [loading, setLoading] = useState(false);

  async function loadComments() {
    if (loaded || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/posts/comments?postId=${postId}`);
      if (res.ok) {
        const json = await res.json();
        const list = (json.comments || []) as Comment[];
        setLocalComments(list);
        setLoaded(true);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session || !commentText.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/posts/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, content: commentText.trim() }),
      });

      if (!res.ok) {
        const json = await res.json();
        alert(json.error || "Алдаа гарлаа");
        return;
      }

      const json = await res.json();
      const newComment: Comment = {
        id: json.comment.id,
        postId,
        authorEmail: session.email,
        content: commentText.trim(),
        isAI: false,
        createdAt: new Date().toISOString(),
      };

      if (onCommentAdded) {
        onCommentAdded(newComment);
      }

      setCommentText("");
      setShowInput(false);
    } catch (err: any) {
      alert(err.message || "Сүлжээний алдаа гарлаа");
    } finally {
      setSubmitting(false);
    }
  }

  const aiComments = localComments.filter((c) => c.isAI) || [];
  const userComments = localComments.filter((c) => !c.isAI) || [];
  const showAIPending = loaded && aiComments.length === 0 && userComments.length === 0;

  return (
    <div className="mt-4 space-y-3">
      {/* Lazy load trigger */}
      {!loaded && (
        <button onClick={loadComments} className="text-xs text-slate-400 hover:text-slate-200">
          💬 Сэтгэгдэл харах
        </button>
      )}

      {loading && (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 px-3 py-2 text-xs text-slate-300">
          Loading comments...
        </div>
      )}

      {showAIPending && (
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 text-xs text-cyan-200">
          🤖 AI шүүмжлэл 10–20 сек дотор автоматаар харагдана.
        </div>
      )}
      {/* AI Comments */}
      {aiComments.map((comment) => (
        <div
          key={comment.id}
          className="rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/5 to-blue-500/5 px-4 py-3"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 text-sm">
              🤖
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-cyan-300">AI Шүүмжлэгч</span>
                <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-300 font-medium">
                  ✨ Автомат
                </span>
              </div>
              <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                {comment.content}
              </p>
              <p className="mt-2 text-[10px] text-slate-500">{formatRelativeTime(comment.createdAt)}</p>
            </div>
          </div>
        </div>
      ))}

      {/* User Comments */}
      {userComments.map((comment) => (
        <div
          key={comment.id}
          className="rounded-2xl border border-slate-700/50 bg-slate-800/30 px-4 py-3"
        >
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                router.push(`/profile?user=${encodeURIComponent(comment.authorEmail)}`);
              }}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-500 text-xs font-bold text-white cursor-pointer hover:scale-110 hover:ring-2 hover:ring-violet-400/50 transition-all"
              title={`${comment.authorEmail.split("@")[0]}-н profile харах`}
              style={{ pointerEvents: 'auto' }}
            >
              {comment.authorEmail[0].toUpperCase()}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    router.push(`/profile?user=${encodeURIComponent(comment.authorEmail)}`);
                  }}
                  className="text-xs font-semibold text-slate-200 hover:text-violet-300 transition-colors cursor-pointer"
                  style={{ pointerEvents: 'auto' }}
                >
                  {comment.authorEmail.split("@")[0]}
                </button>
                <span className="text-[10px] text-slate-500">{formatRelativeTime(comment.createdAt)}</span>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">{comment.content}</p>
            </div>
          </div>
        </div>
      ))}

      {/* Add Comment */}
      {session && (
        <div>
          {!showInput ? (
            <button
              onClick={() => setShowInput(true)}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-800/30 transition-colors"
            >
              💬 Сэтгэгдэл нэмэх
            </button>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-2">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Таны санал бодол..."
                className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-violet-500/40 focus:outline-none"
                rows={3}
                disabled={submitting}
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={submitting || !commentText.trim()}
                  className="rounded-full bg-gradient-to-r from-violet-500 to-purple-500 px-4 py-1.5 text-xs font-medium text-white shadow-[0_4px_12px_rgba(139,92,246,0.4)] hover:shadow-[0_6px_16px_rgba(139,92,246,0.6)] disabled:opacity-60 transition-all"
                >
                  {submitting ? "Илгээж байна..." : "Илгээх"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowInput(false);
                    setCommentText("");
                  }}
                  disabled={submitting}
                  className="rounded-full border border-slate-700 px-4 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:border-slate-600 disabled:opacity-60 transition-colors"
                >
                  Болих
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
