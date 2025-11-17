import { NextResponse } from "next/server";
import { getLeaderboardLight } from "../../../lib/users";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const gradeParam = searchParams.get('grade') || undefined;
  const leaderboard = await getLeaderboardLight(gradeParam as any);
  const safe = leaderboard.map(u => ({
    email: u.email,
    name: u.name,
    nickname: u.nickname,
    avatarUrl: u.avatarUrl,
    avatarColor: u.avatarColor,
    role: u.role,
    grade: u.grade,
    experience: u.experience,
  }));
  // Cache for 15s at the edge; serve stale for 2 minutes while revalidating
  return new NextResponse(JSON.stringify({ ok: true, leaderboard: safe }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=120'
    }
  });
}
