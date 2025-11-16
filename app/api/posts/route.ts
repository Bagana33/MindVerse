import { NextResponse } from "next/server";
import { getSessionFromCookies } from "../../../lib/session";
import { createPost, getAllPosts, deletePost } from "../../../lib/posts";
import { addNotification } from "../../../lib/notifications";
import { getAllUsers } from "../../../lib/users";

// GET: Fetch all posts
export async function GET() {
  const session = await getSessionFromCookies();
  const posts = await getAllPosts();

  // If user is signed in, include their private posts; otherwise only public posts
  const visible = session
    ? posts.filter((p) => p.visibility === 'PUBLIC' || p.authorEmail === session.email)
    : posts.filter((p) => p.visibility === 'PUBLIC');

  return NextResponse.json({ ok: true, posts: visible });
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

  // Send notification to all users about new post (if public)
  if (visibility === 'PUBLIC') {
    try {
      const allUsers = await getAllUsers();
      const notifications = allUsers
        .filter(u => u.email !== session.email) // Don't notify the author
        .map(u => 
          addNotification(
            u.email,
            session.email,
            'LIKE',
            `🎨 ${session.name || session.email} шинэ пост нийтэллээ: ${title}`
          )
        );
      await Promise.allSettled(notifications);
    } catch (e) {
      console.error('Failed to send notifications:', e);
    }
  }

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

  return NextResponse.json({ ok: true });
}
