import { NextResponse } from "next/server";
import { getSessionFromCookies } from "../../../../lib/session";
import { supabase } from "../../../../lib/supabase";
import { getCached, setCached } from "../../../../lib/serverCache";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ ok: false, session: null }, { status: 401 });
  }

  // If session already has avatar info, return immediately without DB hit
  if (session.avatarUrl !== undefined || session.avatarColor !== undefined) {
    return NextResponse.json({ ok: true, session });
  }

  // Check short-lived server memory cache
  const cacheKey = `user_meta:${session.email}`;
  const cachedMeta = getCached<{ avatarUrl?: string; avatarColor?: string }>(cacheKey, 30_000);
  if (cachedMeta) {
    return NextResponse.json({
      ok: true,
      session: {
        ...session,
        avatarUrl: cachedMeta.avatarUrl || session.avatarUrl,
        avatarColor: cachedMeta.avatarColor || session.avatarColor,
      },
    });
  }

  try {
    const { data: user } = await supabase
      .from("users")
      .select("avatar_url, avatar_color")
      .eq("email", session.email)
      .maybeSingle();

    const avatarMeta = {
      avatarUrl: user?.avatar_url || session.avatarUrl,
      avatarColor: user?.avatar_color || session.avatarColor,
    };
    setCached(cacheKey, avatarMeta);

    const fullSession = {
      ...session,
      ...avatarMeta,
    };

    return NextResponse.json({ ok: true, session: fullSession });
  } catch (err) {
    // If DB has momentary hiccup, fallback cleanly to session token data
    return NextResponse.json({ ok: true, session });
  }
}

