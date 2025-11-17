import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "../../../../lib/session";
import { updateUser } from "../../../../lib/users";

export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  }

  try {
    const body = await request.json();
  const { nickname, bio, avatarUrl, avatarColor, grade } = body;

    // Validate inputs
    if (nickname !== undefined) {
      if (nickname.trim().length > 0 && nickname.trim().length < 3) {
        return NextResponse.json({ error: "Nickname хамгийн багадаа 3 тэмдэгт байх ёстой" }, { status: 400 });
      }
      if (nickname.trim().length > 50) {
        return NextResponse.json({ error: "Nickname хамгийн ихдээ 50 тэмдэгт байх ёстой" }, { status: 400 });
      }
    }

    if (bio !== undefined && bio.trim().length > 500) {
      return NextResponse.json({ error: "Bio хамгийн ихдээ 500 тэмдэгт байх ёстой" }, { status: 400 });
    }

    if (avatarColor !== undefined && avatarColor && !/^#[0-9A-F]{6}$/i.test(avatarColor)) {
      return NextResponse.json({ error: "Өнгийн формат буруу байна" }, { status: 400 });
    }

    // Validate grade (optional)
    if (grade !== undefined) {
      const g = String(grade).trim();
      if (!['10','11','12'].includes(g)) {
        return NextResponse.json({ error: "Анги 10/11/12 байх ёстой" }, { status: 400 });
      }
    }

    // Update user with new data
    const updates: any = {};
    if (nickname !== undefined) updates.nickname = nickname.trim() || undefined;
    if (bio !== undefined) updates.bio = bio.trim() || undefined;
    if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl || undefined;
    if (avatarColor !== undefined) updates.avatarColor = avatarColor || undefined;
    if (grade !== undefined) updates.grade = String(grade).trim();

    const user = await updateUser(session.email, updates);

    if (!user) {
      return NextResponse.json({ error: "Хэрэглэгч олдсонгүй" }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true,
      user: {
        email: user.email,
        name: user.name,
        nickname: user.nickname,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        avatarColor: user.avatarColor,
        role: user.role,
        grade: (user as any).grade,
        experience: user.experience,
      }
    });
  } catch (error: any) {
    console.error("Update profile error:", error);
    return NextResponse.json({ error: "Серверийн алдаа гарлаа" }, { status: 500 });
  }
}
