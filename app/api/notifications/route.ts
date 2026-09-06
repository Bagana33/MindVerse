import { NextResponse } from "next/server";
import { getSessionFromCookies } from "../../../lib/session";
import { getUserNotifications } from "../../../lib/notifications";
import { getCached, setCached } from "../../../lib/serverCache";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Нэвтэрнэ үү" }, { status: 401 });
  }

  const cacheKey = `notifs:${session.email}`;
  const cached = getCached<any>(cacheKey, 15_000);
  if (cached) {
    return NextResponse.json(cached);
  }

  const notifications = await getUserNotifications(session.email, 30);
  const unreadCount = notifications.filter(n => !n.read).length;
  const resObj = { ok: true, notifications, unreadCount };
  setCached(cacheKey, resObj, 15_000);

  return NextResponse.json(resObj);
}

