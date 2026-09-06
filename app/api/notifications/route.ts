import { NextResponse } from "next/server";
import { getSessionFromCookies } from "../../../lib/session";
import { getUserNotifications } from "../../../lib/notifications";
import { getCached, setCached } from "../../../lib/serverCache";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Нэвтэрнэ үү" }, { status: 401 });
  }

  const normalized = session.email.toLowerCase().trim();
  const cacheKey = `notifs:${normalized}`;
  const cached = getCached<any>(cacheKey, 5_000);
  if (cached) {
    return NextResponse.json(cached);
  }

  const notifications = await getUserNotifications(normalized, 50);
  const unreadCount = notifications.filter(n => !n.read).length;
  const resObj = { ok: true, notifications, unreadCount };
  setCached(cacheKey, resObj, 5_000);

  return NextResponse.json(resObj);
}

