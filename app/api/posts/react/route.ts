import { NextResponse } from "next/server";
import { getSessionFromCookies } from "../../../../lib/session";
import { toggleReactionWithType, getPost, ReactionType } from "../../../../lib/posts";
import { addExperience } from "../../../../lib/users";
import { addNotification } from "../../../../lib/notifications";

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Нэвтэрнэ үү" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const postId = searchParams.get("id");

  if (!postId) {
    return NextResponse.json({ ok: false, error: "Post ID шаардлагатай" }, { status: 400 });
  }

  const post = await getPost(postId);
  if (!post) {
    return NextResponse.json({ ok: false, error: "Post олдсонгүй" }, { status: 404 });
  }

  // Parse body for type
  let body: any = {};
  try { body = await req.json(); } catch {}
  const rawType = (body?.type || '').toString().toUpperCase();
  const type: ReactionType = rawType === 'WOW' ? 'WOW' : rawType === 'LOVE' ? 'LOVE' : 'FIRE';

  // Toggle / update reaction by type
  const result = await toggleReactionWithType(postId, session.email, type);
  
  if (!result.success) {
    return NextResponse.json({ ok: false, error: "Reaction хийхэд алдаа гарлаа" }, { status: 500 });
  }

  // Award 0.3 XP to the user who reacted (if newly added)
  if (result.added) {
    await addExperience(session.email, 0.3);
  }

  // If reaction newly added (not removed/updated), send notification to post author
  if (result.added && post.authorEmail !== session.email) {
    try {
      const emoji = type === 'FIRE' ? '🔥' : type === 'WOW' ? '😮' : '💖';
      await addNotification(
        post.authorEmail,
        session.email,
        "LIKE",
        `${emoji} ${session.name || session.email} таны "${post.title}" пост дээр ${type.toLowerCase()} реакц өглөө`
      );
    } catch (e) {
      console.error('Failed to send reaction notification:', e);
    }
  }

  // Aggregate counts per type
  const counts = { FIRE: 0, WOW: 0, LOVE: 0 } as Record<ReactionType, number>;
  result.post?.reactions.forEach(r => { counts[r.type] = (counts[r.type] || 0) + 1; });

  return NextResponse.json({
    ok: true,
    added: result.added,
    removed: result.removed,
    updated: result.updated,
    userReaction: result.post ? result.post.reactions.find(r => r.userEmail === session.email)?.type || null : null,
    counts,
    total: result.post?.reactions.length || 0,
  });
}
