import { NextResponse } from "next/server";
import { getUser } from "../../../../lib/users";
import { generatePasswordResetToken } from "../../../../lib/otp";
import { sendPasswordResetEmail } from "../../../../lib/email";
import { getClientKey, rateLimit } from "../../../../lib/rate-limit";

export async function POST(req: Request) {
  try {
    // Rate limit: max 4 code requests per 60 seconds per IP
    const key = getClientKey(req, "auth-send-reset-code");
    const rl = rateLimit(key, { windowMs: 60_000, max: 4 });
    if (!rl.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: `Хэт олон хүсэлт илгээлээ. ${rl.retryAfterSec || 30} секундийн дараа дахин оролдоно уу.`,
        },
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
    if (!email) {
      return NextResponse.json({ ok: false, error: "Имэйл хаягаа оруулна уу" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ ok: false, error: "Зөв имэйл хаяг оруулна уу" }, { status: 400 });
    }

    // Check if user exists (fresh from DB)
    const user = await getUser(email, { bypassCache: true });
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Энэ имэйл хаягаар бүртгэлтэй хэрэглэгч олдсонгүй" },
        { status: 404 }
      );
    }

    // Generate OTP code and tamper-proof signed resetToken (valid 10 mins)
    const { code, token, expiresAt } = generatePasswordResetToken(email, 10);

    // Send email
    const emailResult = await sendPasswordResetEmail(email, code, user.name || user.nickname);
    if (!emailResult.success) {
      return NextResponse.json(
        { ok: false, error: emailResult.error || "Имэйл илгээхэд алдаа гарлаа. Дахин оролдоно уу." },
        { status: 500 }
      );
    }

    if (emailResult.devMode) {
      return NextResponse.json({
        ok: true,
        resetToken: token,
        expiresAt,
        devMode: true,
        devCode: code,
        message: `⚠️ Имэйл серверийн тохиргоо (GMAIL_APP_PASSWORD) хийгдээгүй тул туршилтын код: ${code}`,
      });
    }

    return NextResponse.json({
      ok: true,
      resetToken: token,
      expiresAt,
      message: `Таны "${email}" имэйл хаяг руу 6 оронтой баталгаажуулах код амжилттай илгээгдлээ. Спам (Junk/Spam) хавтсаа мөн шалгана уу.`,
    });
  } catch (error: any) {
    console.error("Send reset code error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Серверийн алдаа гарлаа" },
      { status: 500 }
    );
  }
}
