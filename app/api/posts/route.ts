import { NextResponse } from "next/server";
import { getSessionFromCookies } from "../../../lib/session";
import { createPost, deletePost, getPostsPage, updatePostContent } from "../../../lib/posts";
import { addNotification, addNotificationBatch } from "../../../lib/notifications";
import { getAllUsers, ensureAIUserExists } from "../../../lib/users";
import { createComment } from "../../../lib/comments";
import { generateDesignCritique } from "../../../lib/ai-critique";
import { getOrLoadCached, invalidateServerCache } from "../../../lib/serverCache";

// GET: Fetch all posts
export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  const { searchParams } = new URL(req.url);
  const requestedLimit = Number(searchParams.get('limit') || 20);
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(200, Math.floor(requestedLimit))) : 20;
  const before = searchParams.get('before') || undefined;
  const grade = searchParams.get('grade') || undefined; // Filter by grade
  const search = searchParams.get('search')?.trim() || undefined;
  const postId = searchParams.get('id') || undefined;
  // Visibility is evaluated for each request. Never share a personalized HTTP response.
  const headers = { 'Cache-Control': 'private, no-store', 'Vary': 'Cookie' };
  if ((before && !Number.isFinite(Date.parse(before))) || (search && search.length > 200) || (postId && postId.length > 200)) {
    return NextResponse.json({ ok: false, error: 'Хайлтын утга буруу байна' }, { status: 400, headers });
  }

  try {
    // The database read is identical across users; apply authorization after caching it.
    const cacheKey = `posts:${JSON.stringify(postId ? ['id', postId] : [limit, before || '', grade || '', search || ''])}`;
    const posts = await getOrLoadCached(cacheKey, () => postId
      ? getPostsPage(1, undefined, undefined, undefined, postId)
      : getPostsPage(limit, before, grade, search), 20_000);
    const visible = session
      ? posts.filter((p) => p.visibility === 'PUBLIC' || p.authorEmail === session.email)
      : posts.filter((p) => p.visibility === 'PUBLIC');

    return NextResponse.json({ ok: true, posts: visible }, { headers });
  } catch (error) {
    console.error('Error loading posts:', error);
    return NextResponse.json({ ok: false, error: 'Бүтээлүүдийг ачаалж чадсангүй. Дахин оролдоно уу.' }, {
      status: 503, headers,
    });
  }
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

  invalidateServerCache('posts');

  // Background non-blocking task: AI critique and notifications (does not block HTTP response)
  if (visibility === 'PUBLIC' && !['ai-assistant', 'news-bot'].includes(session.email)) {
    (async () => {
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
        invalidateServerCache('posts');
      } catch (aiError) {
        console.error('Background AI critique error:', aiError);
      }
    })().catch(() => {});
  }

  return NextResponse.json({ ok: true, post: newPost });
}

// PATCH: Save an existing post without deleting its discussion or reactions.
export async function PATCH(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ ok: false, error: 'Нэвтэрнэ үү' }, { status: 401 });
  const id = new URL(req.url).searchParams.get('id');
  const body = await req.json().catch(() => null);
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const description = typeof body?.description === 'string' ? body.description.trim() : '';
  if (!id || id.length > 200 || title.length < 3 || title.length > 200 || description.length < 10 || description.length > 2000) {
    return NextResponse.json({ ok: false, error: 'Гарчиг 3–200, тайлбар 10–2000 тэмдэгттэй байна.' }, { status: 400 });
  }
  if (body.imageUrl !== undefined && body.imageUrl !== null && (typeof body.imageUrl !== 'string' || body.imageUrl.length > 10_000_000)) {
    return NextResponse.json({ ok: false, error: 'Зургийн утга буруу эсвэл хэт том байна.' }, { status: 400 });
  }
  try {
    const post = await updatePostContent(id, session.email, { title, description, imageUrl: body.imageUrl });
    if (!post) return NextResponse.json({ ok: false, error: 'Бүтээл олдсонгүй эсвэл засах эрхгүй байна.' }, { status: 404 });
    return NextResponse.json({ ok: true, post });
  } catch (error) {
    console.error('Post update failed:', error);
    return NextResponse.json({ ok: false, error: 'Хадгалсныг баталгаажуулж чадсангүй. Бүтээлээ шинэчилж шалгаад дахин оролдоно уу.' }, { status: 503 });
  } finally {
    invalidateServerCache('posts');
  }
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
