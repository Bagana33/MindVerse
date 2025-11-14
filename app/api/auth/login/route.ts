import { NextResponse } from "next/server";
import { Role, Session, setSessionCookie } from "../../../../lib/session";
import { getOrCreateUser } from "../../../../lib/users";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = (body?.email ?? "").toString().trim();
  const name = (body?.name ?? "").toString().trim() || undefined;
  const roleRaw = (body?.role ?? "student").toString().trim().toLowerCase();
  const role: Role = roleRaw === "teacher" ? "teacher" : "student";

  if (!email) {
    return NextResponse.json({ ok: false, error: "Email is required" }, { status: 400 });
  }

  // Create or get user in storage
  await getOrCreateUser(email, name, role);

  const session: Session = { email, name, role };
  await setSessionCookie(session);
  return NextResponse.json({ ok: true, session });
}
