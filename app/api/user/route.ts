import { NextResponse } from "next/server";
import { getUser } from "../../../lib/users";
import { getCached, setCached } from "../../../lib/serverCache";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = (searchParams.get("email") || "").toLowerCase().trim();

  if (!email) {
    return NextResponse.json({ ok: false, error: "Email шаардлагатай" }, { status: 400 });
  }

  const cacheKey = `user_info:${email}`;
  const cached = getCached<any>(cacheKey, 30_000);
  if (cached) {
    return NextResponse.json(cached, {
      headers: {
        'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=60',
      },
    });
  }

  const user = await getUser(email);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Хэрэглэгч олдсонгүй" }, { status: 404 });
  }

  // Return safe subset (omit password)
  const safe = {
    email: user.email,
    name: user.name,
    nickname: user.nickname,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    avatarColor: user.avatarColor,
    role: user.role,
    grade: (user as any).grade,
    experience: user.experience,
  };

  const resObj = { ok: true, user: safe };
  setCached(cacheKey, resObj, 30_000);

  return NextResponse.json(resObj, {
    headers: {
      'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=60',
    },
  });
}

