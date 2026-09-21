import { NextResponse } from "next/server";
import { getUserPosts } from "../../../../../lib/posts";
import { getSessionFromCookies } from "../../../../../lib/session";

// GET: Fetch posts for a specific user
export async function GET(
  req: Request,
  context: { params: Promise<{ email: string }> }
) {
  const params = await context.params;
  const userEmail = decodeURIComponent(params.email);

  try {
    const [posts, session] = await Promise.all([getUserPosts(userEmail), getSessionFromCookies()]);
    
    return NextResponse.json({ ok: true, posts: posts.filter(post => post.visibility === 'PUBLIC' || post.authorEmail === session?.email) }, {
      headers: { 'Cache-Control': 'private, no-store', 'Vary': 'Cookie' },
    });
  } catch (error) {
    console.error('Error fetching user posts:', error);
    return NextResponse.json(
      { ok: false, error: "Алдаа гарлаа" },
      { status: 500 }
    );
  }
}
