import { NextResponse } from "next/server";
import { getLeaderboardLight } from "../../../lib/users";
import { getCached, setCached } from "../../../lib/serverCache";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const gradeParam = searchParams.get('grade') || undefined;

  const cacheKey = `leaderboard:${gradeParam || 'all'}`;
  const cached = getCached<any>(cacheKey, 30_000);
  if (cached) {
    return NextResponse.json(cached, {
      headers: {
        'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=60',
      },
    });
  }

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

  const resObj = { ok: true, leaderboard: safe };
  setCached(cacheKey, resObj, 30_000);

  return NextResponse.json(resObj, {
    headers: {
      'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=60',
    },
  });
}
