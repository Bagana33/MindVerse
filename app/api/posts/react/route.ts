import { NextResponse } from "next/server";
import { getSessionFromCookies } from "../../../../lib/session";
import { toggleReactionWithType, getPostMeta, ReactionType } from "../../../../lib/posts";
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

  const postMeta = await getPostMeta(postId);
  if (!postMeta) {
    return NextResponse.json({ ok: false, error: "Post олдсонгүй" }, { status: 404 });
  }

  // Parse body for type
  let body: any = {};
  try { body = await req.json(); } catch {}
  const rawType = (body?.type || '').toString().toUpperCase();
  const type: ReactionType = 
    rawType === 'WOW' ? 'WOW' : 
    rawType === 'LOVE' ? 'LOVE' : 
    rawType === 'COOL' ? 'COOL' : 
    rawType === 'STAR' ? 'STAR' : 
    'FIRE';

  // Toggle / update reaction by type
  const result = await toggleReactionWithType(postId, session.email, type);
  
  if (!result.success) {
    return NextResponse.json({ ok: false, error: "Reaction хийхэд алдаа гарлаа" }, { status: 500 });
  }

  // XP and notifications are executed in parallel to reduce response latency.
  if (result.added) {
    const tasks: Promise<any>[] = [addExperience(session.email, 0.3)];
    const isOtherAuthor = postMeta.authorEmail && postMeta.authorEmail !== session.email;

    if (isOtherAuthor) {
      tasks.push(addExperience(postMeta.authorEmail, 1));
      const emoji =
        type === "FIRE" ? "🔥" :
        type === "WOW" ? "😮" :
        type === "LOVE" ? "💖" :
        type === "COOL" ? "😎" :
        type === "STAR" ? "⭐" : "🔥";

      tasks.push(
        addNotification(
          postMeta.authorEmail,
          session.email,
          "LIKE",
          `${emoji} ${session.name || session.email} таны "${postMeta.title}" пост дээр ${type.toLowerCase()} реакц өглөө`
        )
      );
    }

    const settled = await Promise.allSettled(tasks);
    settled.forEach((r, i) => {
      if (r.status === "rejected") {
        console.error(`Reaction side-effect #${i + 1} failed:`, r.reason);
      }
    });
  }

  return NextResponse.json({
    ok: true,
    added: result.added,
    removed: result.removed,
    updated: result.updated,
  });
}
