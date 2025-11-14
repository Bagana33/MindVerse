import { NextResponse } from "next/server";
import { getSessionFromCookies } from "../../../../lib/session";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ ok: false, session: null }, { status: 401 });
  }

  return NextResponse.json({ ok: true, session });
}
