import { NextResponse } from "next/server";
import { getLeaderboard } from "../../../lib/users";

export async function GET() {
  const leaderboard = await getLeaderboard();
  return NextResponse.json({ ok: true, leaderboard });
}
