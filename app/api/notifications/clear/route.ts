import { NextResponse } from "next/server";
import { getSessionFromCookies } from "../../../../lib/session";
import { clearAllNotifications } from "../../../../lib/notifications";

// POST: Clear all notifications for the current user
export async function POST() {
  const session = await getSessionFromCookies();
  
  if (!session) {
    return NextResponse.json({ ok: false, error: "Нэвтэрнэ үү" }, { status: 401 });
  }

  const cleared = await clearAllNotifications(session.email);

  return NextResponse.json({ ok: true, cleared });
}
