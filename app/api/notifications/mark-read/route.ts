import { NextResponse } from "next/server";
import { getSessionFromCookies } from "../../../../lib/session";
import { markAllNotificationsRead, getUnreadCount } from "../../../../lib/notifications";
import { invalidateServerCache } from "../../../../lib/serverCache";

export async function POST() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Нэвтэрнэ үү" }, { status: 401 });
  }
  const marked = await markAllNotificationsRead(session.email);
  const unreadCount = await getUnreadCount(session.email);
  invalidateServerCache(`notifs:${session.email}`);
  return NextResponse.json({ ok: true, marked, unreadCount });
}

