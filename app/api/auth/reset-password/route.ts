import { NextResponse } from "next/server";
import { resetUserPassword, getUser } from "../../../../lib/users";
import { verifyPasswordResetToken } from "../../../../lib/otp";
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
    // Rate limit: 6 attempts / 60s per IP
    const key = getClientKey(req, "auth-reset-password");
    const rl = rateLimit(key, { windowMs: 60_000, max: 6 });
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

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return privateJson(
        { ok: false, error: "Буруу форматтай хүсэлт" },
        { status: 400 },
      );
    }

    const email = (body?.email ?? "").toString().trim().toLowerCase();
    const code = (body?.code ?? "").toString().trim();
    const resetToken = (body?.resetToken ?? "").toString().trim();
    const newPassword = (body?.newPassword ?? "").toString().trim();
    const confirmPassword = (body?.confirmPassword ?? "").toString().trim();

    if (!email) {
      return privateJson(
        { ok: false, error: "Имэйл хаягаа оруулна уу" },
        { status: 400 },
      );
    }

    if (!code) {
      return privateJson(
        {
          ok: false,
          error: "Имэйлээр ирсэн 6 оронтой баталгаажуулах кодыг оруулна уу",
        },
        { status: 400 },
      );
    }

    if (!resetToken) {
      return privateJson(
        {
          ok: false,
          error: "Баталгаажуулах токен байхгүй байна. Дахин код авна уу.",
        },
        { status: 400 },
      );
    }

    if (!newPassword || newPassword.length < 6) {
      return privateJson(
        {
          ok: false,
          error: "Шинэ нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой",
        },
        { status: 400 },
      );
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return privateJson(
        { ok: false, error: "Шинэ нууц үг хоорондоо таарахгүй байна" },
        { status: 400 },
      );
    }

    getSigningKey("password-reset-token");
    getSigningKey("password-reset-version");
    // Fresh password state is required: a previous successful reset invalidates its token.
    const existing = await getUser(email, { bypassCache: true });
    if (!existing?.password) {
      return privateJson(
        {
          ok: false,
          error:
            "Баталгаажуулах код эсвэл токен хүчингүй байна. Дахин код авна уу.",
        },
        { status: 400 },
      );
    }

    const verifyResult = verifyPasswordResetToken(
      email,
      code,
      resetToken,
      existing.password,
    );
    if (!verifyResult.valid) {
      return privateJson(
        {
          ok: false,
          error: verifyResult.error || "Баталгаажуулах код буруу байна",
        },
        { status: 400 },
      );
    }

    // 3. Reset password securely
    await resetUserPassword(email, newPassword, existing.password);

    return privateJson({
      ok: true,
      message: "Нууц үг амжилттай солигдлоо. Шинэ нууц үгээрээ нэвтэрнэ үү.",
    });
  } catch (error) {
    const unavailable = error instanceof SigningConfigurationError;
    return privateJson(
      {
        ok: false,
        error: unavailable
          ? "Нууц үг сэргээх үйлчилгээ түр боломжгүй байна."
          : "Нууц үг солиход серверийн алдаа гарлаа. Дахин оролдоно уу.",
      },
      { status: unavailable ? 503 : 500 },
    );
  }
}
