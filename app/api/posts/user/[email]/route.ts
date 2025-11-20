import { NextResponse } from "next/server";
import { getUserPosts } from "../../../../../lib/posts";

// GET: Fetch posts for a specific user
export async function GET(
  req: Request,
  context: { params: Promise<{ email: string }> }
) {
  const params = await context.params;
  const userEmail = decodeURIComponent(params.email);

  try {
    const posts = await getUserPosts(userEmail);
    
    return NextResponse.json({ ok: true, posts });
  } catch (error) {
    console.error('Error fetching user posts:', error);
    return NextResponse.json(
      { ok: false, error: "Алдаа гарлаа" },
      { status: 500 }
    );
  }
}
