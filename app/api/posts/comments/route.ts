import { NextResponse } from "next/server";
import { getPostComments, createComment } from "../../../../lib/comments";
import { getSessionFromCookies } from "../../../../lib/session";

// GET: Fetch comments for a post
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const postId = searchParams.get("postId");

    if (!postId) {
      return NextResponse.json(
        { ok: false, error: "Post ID шаардлагатай" },
        { status: 400 }
      );
    }

    const comments = await getPostComments(postId);
    return new NextResponse(JSON.stringify({ ok: true, comments }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    console.error("Error fetching comments:", error);
    return NextResponse.json(
      { ok: false, error: "Сэтгэгдэл уншихад алдаа гарлаа" },
      { status: 500 }
    );
  }
}

// POST: Create a comment
export async function POST(req: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ ok: false, error: "Нэвтэрнэ үү" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const postId = body?.postId;
    const content = (body?.content ?? "").toString().trim();
    const parentCommentId = body?.parentCommentId ? body.parentCommentId.toString() : undefined;

    if (!postId) {
      return NextResponse.json(
        { ok: false, error: "Post ID шаардлагатай" },
        { status: 400 }
      );
    }

    if (!content) {
      return NextResponse.json(
        { ok: false, error: "Сэтгэгдэл хоосон байж болохгүй" },
        { status: 400 }
      );
    }

    if (content.length > 1000) {
      return NextResponse.json(
        { ok: false, error: "Сэтгэгдэл 1000 тэмдэгтээс богино байх ёстой" },
        { status: 400 }
      );
    }

    const comment = await createComment({
      postId,
      authorEmail: session.email,
      content,
      isAI: false,
      parentCommentId,
    });

    return NextResponse.json({ ok: true, comment });
  } catch (error) {
    console.error("Error creating comment:", error);
    return NextResponse.json(
      { ok: false, error: "Сэтгэгдэл хадгалахад алдаа гарлаа" },
      { status: 500 }
    );
  }
}
