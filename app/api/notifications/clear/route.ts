import { NextResponse } from "next/server";
import { getSessionFromCookies } from "../../../../lib/session";
import { clearAllNotifications } from "../../../../lib/notifications";
import { invalidateServerCache } from "../../../../lib/serverCache";

// POST: Clear all notifications for the current user
export async function POST() {
  const session = await getSessionFromCookies();
  
  if (!session) {
    return NextResponse.json({ ok: false, error: "Нэвтэрнэ үү" }, { status: 401 });
  }

  const normalized = session.email.toLowerCase().trim();
  const cleared = await clearAllNotifications(normalized);
  invalidateServerCache(`notifs:${normalized}`);

  return NextResponse.json({ ok: true, cleared });
}

