import { NextResponse } from "next/server";
import { Role, Session, setSessionCookie } from "../../../../lib/session";
import { createUser, verifyUser, getUser } from "../../../../lib/users";
import { getClientKey, rateLimit } from "../../../../lib/rate-limit";

export async function POST(req: Request) {
  try {
    // Basic rate limit to protect CPU (bcrypt) under bursts
    const key = getClientKey(req, 'auth-login');
    const rl = rateLimit(key, { windowMs: 30_000, max: 8 }); // 8 req / 30s per IP
    if (!rl.ok) {
      return new NextResponse(
        JSON.stringify({ ok: false, error: "Хэт олон оролдлого. Дахин оролдох хугацаа: " + rl.retryAfterSec + " сек" }),
        { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfterSec || 30) } }
      );
    }
    let body;
    try {
      body = await req.json();
    } catch (jsonError) {
      console.error('JSON parse error:', jsonError);
      return NextResponse.json({ ok: false, error: "Invalid JSON format" }, { status: 400 });
    }

    const email = (body?.email ?? "").toString().trim();
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

    let sessionUserName = name;
    let sessionRole: Role = role;

    if (mode === "signup") {
      try {
        const created = await createUser(email, password, name, role, grade);
        sessionUserName = created.name;
        sessionRole = created.role as Role;
      } catch (err: any) {
        return NextResponse.json({ ok: false, error: err.message || "Бүртгэл амжилтгүй" }, { status: 400 });
      }
    } else {
      // Sign-in flow
      const existing = await getUser(email);
      if (existing && (typeof existing.password !== 'string' || existing.password.length === 0)) {
        return NextResponse.json(
          { ok: false, error: "Энэ имэйл дээр нууц үг тохируулаагүй байна. Бүртгүүлэх (Signup) сонголтоор нууц үг үүсгэнэ үү." },
          { status: 400 }
        );
      }

      const user = await verifyUser(email, password);
      if (!user) {
        return NextResponse.json({ ok: false, error: "Email эсвэл нууц үг буруу байна" }, { status: 401 });
      }
      sessionUserName = user.name;
      sessionRole = user.role as Role;
    }

    const session: Session = { email, name: sessionUserName, role: sessionRole };
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
