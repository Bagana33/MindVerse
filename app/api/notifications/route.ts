import { NextResponse } from "next/server";
import { getSessionFromCookies } from "../../../lib/session";
import { getUserNotifications, getUnreadCount } from "../../../lib/notifications";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Нэвтэрнэ үү" }, { status: 401 });
  }
  const notifications = await getUserNotifications(session.email);
  const unreadCount = notifications.filter(n => !n.read).length;
  return NextResponse.json({ ok: true, notifications, unreadCount });
}
