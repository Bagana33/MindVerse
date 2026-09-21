import { NextResponse } from "next/server";
import { getUser } from "../../../../lib/users";
import { generatePasswordResetToken } from "../../../../lib/otp";
import {
  isEmailConfigured,
  sendPasswordResetEmail,
} from "../../../../lib/email";
import {
  getSigningKey,
  SigningConfigurationError,
} from "../../../../lib/signingKey";
import { getClientKey, rateLimit } from "../../../../lib/rate-limit";

function privateJson(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "private, no-store");
  return NextResponse.json(body, { ...init, headers });
}

export async function POST(req: Request) {
  try {
    // Rate limit: max 4 code requests per 60 seconds per IP
    const key = getClientKey(req, "auth-send-reset-code");
    const rl = rateLimit(key, { windowMs: 60_000, max: 4 });
    if (!rl.ok) {
      return privateJson(
        {
          ok: false,
          error: `Хэт олон хүсэлт илгээлээ. ${rl.retryAfterSec || 30} секундийн дараа дахин оролдоно уу.`,
        },
        {
          status: 429,
          headers: { "Retry-After": String(rl.retryAfterSec || 30) },
        },
      );
    }

    // Check configuration before reading account data or creating a reset code.
    getSigningKey("password-reset-token");
    getSigningKey("password-reset-code");
    getSigningKey("password-reset-version");
    if (process.env.NODE_ENV === "production" && !isEmailConfigured()) {
      return privateJson(
        {
          ok: false,
          error: "Нууц үг сэргээх имэйлийн үйлчилгээ түр боломжгүй байна.",
        },
        { status: 503 },
      );
    }

    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      return privateJson(
        { ok: false, error: "Буруу форматтай хүсэлт" },
        { status: 400 },
      );
    }

    const emailValue =
      body && typeof body === "object" && "email" in body ? body.email : "";
    const email =
      typeof emailValue === "string" ? emailValue.trim().toLowerCase() : "";
    if (!email) {
      return privateJson(
        { ok: false, error: "Имэйл хаягаа оруулна уу" },
        { status: 400 },
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email.length > 320 || !emailRegex.test(email)) {
      return privateJson(
        { ok: false, error: "Зөв имэйл хаяг оруулна уу" },
        { status: 400 },
      );
    }

    // Check if user exists (fresh from DB)
    const user = await getUser(email, { bypassCache: true });
    if (!user) {
      return privateJson(
        {
          ok: false,
          error: "Энэ имэйл хаягаар бүртгэлтэй хэрэглэгч олдсонгүй",
        },
        { status: 404 },
      );
    }

    if (!user.password) {
      return privateJson(
        {
          ok: false,
          error:
            "Энэ бүртгэлийн нууц үгийг сэргээх боломжгүй байна. Багштай холбоо барина уу.",
        },
        { status: 400 },
      );
    }

    // Bind the code to the current password so changing it invalidates this reset token.
    const { code, token, expiresAt } = generatePasswordResetToken(
      email,
      user.password,
      10,
    );

    // Send email
    const emailResult = await sendPasswordResetEmail(
      email,
      code,
      user.name || user.nickname,
    );
    if (
      emailResult.configurationError ||
      (process.env.NODE_ENV === "production" && emailResult.devMode)
    ) {
      return privateJson(
        {
          ok: false,
          error: "Нууц үг сэргээх имэйлийн үйлчилгээ түр боломжгүй байна.",
        },
        { status: 503 },
      );
    }
    if (!emailResult.success) {
      return privateJson(
        {
          ok: false,
          error:
            emailResult.error ||
            "Имэйл илгээхэд алдаа гарлаа. Дахин оролдоно уу.",
        },
        { status: 502 },
      );
    }

    if (emailResult.devMode) {
      return privateJson({
        ok: true,
        resetToken: token,
        expiresAt,
        devMode: true,
        devCode: code,
        message: `⚠️ Имэйл серверийн тохиргоо (GMAIL_APP_PASSWORD) хийгдээгүй тул туршилтын код: ${code}`,
      });
    }

    return privateJson({
      ok: true,
      resetToken: token,
      expiresAt,
      message: `Таны "${email}" имэйл хаяг руу 6 оронтой баталгаажуулах код амжилттай илгээгдлээ. Спам (Junk/Spam) хавтсаа мөн шалгана уу.`,
    });
  } catch (error) {
    const unavailable = error instanceof SigningConfigurationError;
    return privateJson(
      {
        ok: false,
        error: unavailable
          ? "Нууц үг сэргээх үйлчилгээ түр боломжгүй байна."
          : "Серверийн алдаа гарлаа. Дахин оролдоно уу.",
      },
      { status: unavailable ? 503 : 500 },
    );
  }
}
