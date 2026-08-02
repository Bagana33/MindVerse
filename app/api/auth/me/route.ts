import { NextResponse } from "next/server";
import { getSessionFromCookies } from "../../../../lib/session";
import { supabase } from "../../../../lib/supabase";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ ok: false, session: null }, { status: 401 });
  }

  const { data: user } = await supabase
    .from("users")
    .select("avatar_url, avatar_color")
    .eq("email", session.email)
    .single();

  const fullSession = {
    ...session,
    avatarUrl: user?.avatar_url || session.avatarUrl,
    avatarColor: user?.avatar_color || session.avatarColor,
  };

  return NextResponse.json({ ok: true, session: fullSession });
}
