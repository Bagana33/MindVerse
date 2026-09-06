import { NextResponse } from "next/server";
import { getSessionFromCookies } from "../../../../lib/session";
import { markAllNotificationsRead, markNotificationRead, getUnreadCount } from "../../../../lib/notifications";
import { invalidateServerCache } from "../../../../lib/serverCache";

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Нэвтэрнэ үү" }, { status: 401 });
  }

  const normalized = session.email.toLowerCase().trim();
  let body: any = {};
  try {
    body = await req.json();
  } catch {}

  const notificationId = body?.id;

  if (notificationId) {
    const success = await markNotificationRead(notificationId, normalized);
    const unreadCount = await getUnreadCount(normalized);
    invalidateServerCache(`notifs:${normalized}`);
    return NextResponse.json({ ok: true, marked: success ? 1 : 0, unreadCount });
  }

  const marked = await markAllNotificationsRead(normalized);
  const unreadCount = await getUnreadCount(normalized);
  invalidateServerCache(`notifs:${normalized}`);
  return NextResponse.json({ ok: true, marked, unreadCount });
}

