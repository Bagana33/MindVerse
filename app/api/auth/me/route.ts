import { NextResponse } from "next/server";
import { getSessionFromCookies } from "../../../../lib/session";
import { supabase } from "../../../../lib/supabase";
import {
  getSigningKey,
  SigningConfigurationError,
} from "../../../../lib/signingKey";
import { getCached, setCached } from "../../../../lib/serverCache";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

export async function GET() {
  let session;
  try {
    // Anonymous requests also expose readiness without revealing configuration details.
    getSigningKey("session");
    session = await getSessionFromCookies();
  } catch (error) {
    if (!(error instanceof SigningConfigurationError)) throw error;
    return NextResponse.json(
      {
        ok: false,
        session: null,
        code: "AUTH_CONFIGURATION_UNAVAILABLE",
        error: "Нэвтрэх үйлчилгээ түр боломжгүй байна.",
      },
      { status: 503, headers: PRIVATE_HEADERS },
    );
  }
  if (!session) {
    return NextResponse.json(
      { ok: false, session: null },
      { status: 401, headers: PRIVATE_HEADERS },
    );
  }

  // If session already has avatar info, return immediately without DB hit
  if (session.avatarUrl !== undefined || session.avatarColor !== undefined) {
    return NextResponse.json(
      { ok: true, session },
      { headers: PRIVATE_HEADERS },
    );
  }

  // Check short-lived server memory cache
  const cacheKey = `user_meta:${session.email}`;
  const cachedMeta = getCached<{ avatarUrl?: string; avatarColor?: string }>(
    cacheKey,
    30_000,
  );
  if (cachedMeta) {
    return NextResponse.json(
      {
        ok: true,
        session: {
          ...session,
          avatarUrl: cachedMeta.avatarUrl || session.avatarUrl,
          avatarColor: cachedMeta.avatarColor || session.avatarColor,
        },
      },
      { headers: PRIVATE_HEADERS },
    );
  }

  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("avatar_url, avatar_color")
      .eq("email", session.email)
      .abortSignal(AbortSignal.timeout(10_000))
      .maybeSingle();
    if (error) throw error;

    const avatarMeta = {
      avatarUrl: user?.avatar_url || session.avatarUrl,
      avatarColor: user?.avatar_color || session.avatarColor,
    };
    setCached(cacheKey, avatarMeta);

    const fullSession = {
      ...session,
      ...avatarMeta,
    };

    return NextResponse.json(
      { ok: true, session: fullSession },
      { headers: PRIVATE_HEADERS },
    );
  } catch (err) {
    // If DB has momentary hiccup, fallback cleanly to session token data
    return NextResponse.json(
      { ok: true, session },
      { headers: PRIVATE_HEADERS },
    );
  }
}
