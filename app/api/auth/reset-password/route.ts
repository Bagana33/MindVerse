import { NextResponse } from "next/server";
import { resetUserPassword, getUser } from "../../../../lib/users";
import { verifyPasswordResetToken } from "../../../../lib/otp";
import { getClientKey, rateLimit } from "../../../../lib/rate-limit";

export async function POST(req: Request) {
  try {
    // Rate limit: 6 attempts / 60s per IP
    const key = getClientKey(req, "auth-reset-password");
    const rl = rateLimit(key, { windowMs: 60_000, max: 6 });
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
    const code = (body?.code ?? "").toString().trim();
    const resetToken = (body?.resetToken ?? "").toString().trim();
    const newPassword = (body?.newPassword ?? "").toString().trim();
    const confirmPassword = (body?.confirmPassword ?? "").toString().trim();

    if (!email) {
      return NextResponse.json({ ok: false, error: "Имэйл хаягаа оруулна уу" }, { status: 400 });
    }

    if (!code) {
      return NextResponse.json({ ok: false, error: "Имэйлээр ирсэн 6 оронтой баталгаажуулах кодыг оруулна уу" }, { status: 400 });
    }

    if (!resetToken) {
      return NextResponse.json({ ok: false, error: "Баталгаажуулах токен байхгүй байна. Дахин код авна уу." }, { status: 400 });
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

    // 1. Verify OTP code and token signature
    const verifyResult = verifyPasswordResetToken(email, code, resetToken);
    if (!verifyResult.valid) {
      return NextResponse.json(
        { ok: false, error: verifyResult.error || "Баталгаажуулах код буруу байна" },
        { status: 400 }
      );
    }

    // 2. Check if user exists (fresh from DB)
    const existing = await getUser(email, { bypassCache: true });
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Энэ имэйл хаягаар бүртгэлтэй хэрэглэгч олдсонгүй" },
        { status: 404 }
      );
    }

    // 3. Reset password securely
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
