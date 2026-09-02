import { NextResponse } from "next/server";
import { getSessionFromCookies } from "../../../lib/session";
import { createPost, deletePost, getPostsPage } from "../../../lib/posts";
import { addNotification, addNotificationBatch } from "../../../lib/notifications";
import { getAllUsers, ensureAIUserExists } from "../../../lib/users";
import { createComment } from "../../../lib/comments";
import { generateDesignCritique } from "../../../lib/ai-critique";
import { getCached, setCached, invalidateServerCache } from "../../../lib/serverCache";

// GET: Fetch all posts
export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  const { searchParams } = new URL(req.url);
  const limit = Math.max(1, Math.min(200, Number(searchParams.get('limit') || 20))); // Increased max to 200
  const before = searchParams.get('before') || undefined;
  const grade = searchParams.get('grade') || undefined; // Filter by grade
  const search = searchParams.get('search') || undefined; // Database search term

  const cacheKey = `posts:${limit}:${before || ''}:${grade || ''}:${search || ''}:${session ? session.email : 'public'}`;
  const cachedData = getCached<any>(cacheKey, 15_000);
  if (cachedData) {
    return NextResponse.json(cachedData);
  }

  const posts = await getPostsPage(limit, before, grade, search);

  // If user is signed in, include their private posts; otherwise only public posts
  const visible = session
    ? posts.filter((p) => p.visibility === 'PUBLIC' || p.authorEmail === session.email)
    : posts.filter((p) => p.visibility === 'PUBLIC');

  const responseObj = { ok: true, posts: visible };
  setCached(cacheKey, responseObj);

  return NextResponse.json(responseObj);
}


// POST: Create a new post (requires authentication)
export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Нэвтэрнэ үү" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const title = (body?.title ?? "").toString().trim();
  const description = (body?.description ?? "").toString().trim();
  const imageUrl = body?.imageUrl ? body.imageUrl.toString() : undefined;
  const visibility = (body?.visibility || 'PUBLIC').toString().toUpperCase();

  // Validate title
  if (!title || title.length < 3) {
    return NextResponse.json(
      { ok: false, error: "Гарчиг хамгийн багадаа 3 тэмдэгт байх ёстой" },
      { status: 400 }
    );
  }
  
  if (title.length > 200) {
    return NextResponse.json(
      { ok: false, error: "Гарчиг 200 тэмдэгтээс богино байх ёстой" },
      { status: 400 }
    );
  }

  // Validate description
  if (!description || description.length < 10) {
    return NextResponse.json(
      { ok: false, error: "Тайлбар хамгийн багадаа 10 тэмдэгт байх ёстой" },
      { status: 400 }
    );
  }

  if (description.length > 2000) {
    return NextResponse.json(
      { ok: false, error: "Тайлбар 2000 тэмдэгтээс богино байх ёстой" },
      { status: 400 }
    );
  }

  // Validate image URL if provided
  if (imageUrl && imageUrl.length > 10000000) { // ~10MB base64
    return NextResponse.json(
      { ok: false, error: "Зураг хэт том байна" },
      { status: 400 }
    );
  }

  const newPost = await createPost({
    title,
    description,
    author: session.name || session.email,
    authorEmail: session.email,
    ...(imageUrl && { imageUrl }),
    visibility: visibility === 'PRIVATE' ? 'PRIVATE' : 'PUBLIC',
  });

  // AI automatic critique for public user posts
  if (visibility === 'PUBLIC' && !['ai-assistant', 'news-bot'].includes(session.email)) {
    try {
      const aiCritique = await generateDesignCritique({ title, description, imageUrl });

      await ensureAIUserExists();
      await createComment({
        postId: newPost.id,
        authorEmail: 'ai-assistant',
        content: aiCritique,
        isAI: true,
      });

      await addNotification(
        session.email,
        'ai-assistant',
        'LIKE',
        '🤖 AI шүүмжлэл таны бүтээлд бэлэн боллоо!'
      );
    } catch (aiError) {
      console.error('AI critique error:', aiError);
    }
  }

  // Send notification to all users about new post (non-blocking async batch)
  if (visibility === 'PUBLIC') {
    getAllUsers()
      .then((allUsers) => {
        const recipientEmails = allUsers
          .filter((u) => u.email !== session.email)
          .map((u) => u.email);
        return addNotificationBatch(
          recipientEmails,
          session.email,
          'LIKE',
          `🎨 ${session.name || session.email} шинэ пост нийтэллээ: ${title}`
        );
      })
      .catch((e) => console.error('Failed async notification broadcast:', e));
  }

  invalidateServerCache('posts');
  return NextResponse.json({ ok: true, post: newPost });
}

// DELETE: Remove a post (requires authentication and ownership)
export async function DELETE(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Нэвтэрнэ үү" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const postId = searchParams.get("id");

  if (!postId) {
    return NextResponse.json({ ok: false, error: "Post ID шаардлагатай" }, { status: 400 });
  }

  const deleted = await deletePost(postId, session.email);
  if (!deleted) {
    return NextResponse.json({ ok: false, error: "Post олдсонгүй эсвэл устгах эрхгүй" }, { status: 404 });
  }

  invalidateServerCache('posts');
  return NextResponse.json({ ok: true });
}
