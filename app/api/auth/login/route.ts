import { NextResponse } from "next/server";
import { Role, Session, setSessionCookie } from "../../../../lib/session";
import { getOrCreateUser } from "../../../../lib/users";

export async function POST(req: Request) {
  try {
    let body;
    try {
      body = await req.json();
    } catch (jsonError) {
      console.error('JSON parse error:', jsonError);
      return NextResponse.json({ ok: false, error: "Invalid JSON format" }, { status: 400 });
    }

    const email = (body?.email ?? "").toString().trim();
    const name = (body?.name ?? "").toString().trim() || undefined;
    const roleRaw = (body?.role ?? "student").toString().trim().toLowerCase();
    const role: Role = roleRaw === "teacher" ? "teacher" : "student";

    if (!email) {
      return NextResponse.json({ ok: false, error: "Email шаардлагатай" }, { status: 400 });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ ok: false, error: "Email хаяг буруу байна" }, { status: 400 });
    }

    // Create or get user in storage
    await getOrCreateUser(email, name, role);

    const session: Session = { email, name, role };
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
