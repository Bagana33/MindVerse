import { NextResponse } from "next/server";
import { getPostComments } from "../../../../lib/comments";

// GET: Fetch comments for a post
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const postId = searchParams.get("postId");

  if (!postId) {
    return NextResponse.json(
      { ok: false, error: "Post ID шаардлагатай" },
      { status: 400 }
    );
  }

  const comments = await getPostComments(postId);
  return NextResponse.json({ ok: true, comments });
}
