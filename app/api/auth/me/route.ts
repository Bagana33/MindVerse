import { NextResponse } from "next/server";
import { getSessionFromCookies } from "../../../../lib/session";
import { getOrCreateUser } from "../../../../lib/users";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ ok: false, session: null }, { status: 401 });
  }
  
  // Ensure user exists in storage
  await getOrCreateUser(session.email, session.name, session.role);
  
  return NextResponse.json({ ok: true, session });
}
