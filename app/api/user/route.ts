import { NextResponse } from "next/server";
import { getUser } from "../../../lib/users";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");

  if (!email) {
    return NextResponse.json({ ok: false, error: "Email шаардлагатай" }, { status: 400 });
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
    experience: user.experience,
  };

  return NextResponse.json({ ok: true, user: safe });
}
