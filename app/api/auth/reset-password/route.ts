import { NextResponse } from "next/server";
import { resetUserPassword, getUser } from "../../../../lib/users";
import { getClientKey, rateLimit } from "../../../../lib/rate-limit";

export async function POST(req: Request) {
  try {
    // Rate limit: 5 requests / 60s per IP
    const key = getClientKey(req, "auth-reset-password");
    const rl = rateLimit(key, { windowMs: 60_000, max: 5 });
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, error: `Хэт олон хүсэлт илгээлээ. ${rl.retryAfterSec || 30} секундийн дараа дахин оролдоно уу.` },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec || 30) } }
      );
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "Буруу форматтай хүсэлт" }, { status: 400 });
    }

    const email = (body?.email ?? "").toString().trim().toLowerCase();
    const newPassword = (body?.newPassword ?? "").toString().trim();
    const confirmPassword = (body?.confirmPassword ?? "").toString().trim();

    if (!email) {
      return NextResponse.json({ ok: false, error: "Имэйл хаягаа оруулна уу" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ ok: false, error: "Зөв имэйл хаяг оруулна уу" }, { status: 400 });
    }

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { ok: false, error: "Шинэ нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой" },
        { status: 400 }
      );
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return NextResponse.json(
        { ok: false, error: "Шинэ нууц үг хоорондоо таарахгүй байна" },
        { status: 400 }
      );
    }

    // Check if user exists
    const existing = await getUser(email);
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Энэ имэйл хаягаар бүртгэлтэй хэрэглэгч олдсонгүй" },
        { status: 404 }
      );
    }

    // Reset password
    await resetUserPassword(email, newPassword);

    return NextResponse.json({
      ok: true,
      message: "Нууц үг амжилттай солигдлоо. Шинэ нууц үгээрээ нэвтэрнэ үү.",
    });
  } catch (error: any) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Нууц үг солиход серверийн алдаа гарлаа" },
      { status: 500 }
    );
  }
}
