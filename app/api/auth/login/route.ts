import { NextResponse } from "next/server";
import { Role, Session, setSessionCookie } from "../../../../lib/session";
import { createUser, getUser } from "../../../../lib/users";
import { getClientKey, rateLimit } from "../../../../lib/rate-limit";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    // Classroom & NAT-friendly IP rate limit (120 req / 30s per IP allows 30+ students simultaneously)
    const ipKey = getClientKey(req, 'auth-login');
    const ipRl = rateLimit(ipKey, { windowMs: 30_000, max: 120 });
    if (!ipRl.ok) {
      return new NextResponse(
        JSON.stringify({ ok: false, error: "Серверийн ачаалал өндөр байна. Дахин оролдох хугацаа: " + ipRl.retryAfterSec + " сек" }),
        { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(ipRl.retryAfterSec || 30) } }
      );
    }

    let body;
    try {
      body = await req.json();
    } catch (jsonError) {
      console.error('JSON parse error:', jsonError);
      return NextResponse.json({ ok: false, error: "Invalid JSON format" }, { status: 400 });
    }

    const email = (body?.email ?? "").toString().trim().toLowerCase();
    const password = (body?.password ?? "").toString().trim();
    const name = (body?.name ?? "").toString().trim() || undefined;
    const mode = (body?.mode ?? "signin").toString().trim();
    const roleRaw = (body?.role ?? "student").toString().trim().toLowerCase();
    const role: Role = roleRaw === "teacher" ? "teacher" : "student";
    const grade = body?.grade ? body.grade.toString().trim() : undefined;

    if (!email) {
      return NextResponse.json({ ok: false, error: "Email шаардлагатай" }, { status: 400 });
    }

    if (!password) {
      return NextResponse.json({ ok: false, error: "Нууц үг шаардлагатай" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ ok: false, error: "Email хаяг буруу байна" }, { status: 400 });
    }

    // Per-account rate limit to protect individual emails from brute-force (10 attempts / min)
    const emailRl = rateLimit(`auth-acc:${email}`, { windowMs: 60_000, max: 10 });
    if (!emailRl.ok) {
      return new NextResponse(
        JSON.stringify({ ok: false, error: `Энэ хаяг дээр олон буруу оролдлого хийгдлээ. ${emailRl.retryAfterSec || 30} сек дараа оролдоно уу.` }),
        { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(emailRl.retryAfterSec || 30) } }
      );
    }

    let sessionUserName = name;
    let sessionNickname: string | undefined;
    let sessionRole: Role = role;
    let sessionAvatarUrl: string | undefined;
    let sessionAvatarColor: string | undefined;

    if (mode === "signup") {
      try {
        const created = await createUser(email, password, name, role, grade);
        sessionUserName = created.name;
        sessionNickname = created.nickname;
        sessionRole = created.role as Role;
        sessionAvatarUrl = created.avatarUrl;
        sessionAvatarColor = created.avatarColor;
      } catch (err: any) {
        return NextResponse.json({ ok: false, error: err.message || "Бүртгэл амжилтгүй" }, { status: 400 });
      }
    } else {
      // Single DB query for signin verification (avoids double roundtrip)
      const existing = await getUser(email);
      if (!existing) {
        return NextResponse.json({ ok: false, error: "Email эсвэл нууц үг буруу байна" }, { status: 401 });
      }

      if (typeof existing.password !== 'string' || existing.password.length === 0) {
        return NextResponse.json(
          { ok: false, error: "Энэ имэйл дээр нууц үг тохируулаагүй байна. Бүртгүүлэх (Signup) сонголтоор нууц үг үүсгэнэ үү." },
          { status: 400 }
        );
      }

      let isValid = false;
      try {
        isValid = await bcrypt.compare(password, existing.password);
      } catch (e) {
        isValid = false;
      }

      if (!isValid) {
        return NextResponse.json({ ok: false, error: "Email эсвэл нууц үг буруу байна" }, { status: 401 });
      }

      sessionUserName = existing.name;
      sessionNickname = existing.nickname;
      sessionRole = existing.role as Role;
      sessionAvatarUrl = existing.avatarUrl;
      sessionAvatarColor = existing.avatarColor;
    }

    const session: Session = {
      email,
      name: sessionUserName,
      nickname: sessionNickname,
      role: sessionRole,
      avatarUrl: sessionAvatarUrl,
      avatarColor: sessionAvatarColor,
    };
    await setSessionCookie(session);
    return NextResponse.json({ ok: true, session });
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: error.message || "Серверийн алдаа гарлаа" 
    }, { status: 500 });
  }
}

