import { NextResponse } from "next/server";
import { getLeaderboardLight } from "../../../lib/users";
import { getOrLoadCached } from "../../../lib/serverCache";
import { getPublicAvatarUrl } from "../../../lib/avatars";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const requestedGrade = searchParams.get('grade');
  const gradeParam = ['9', '10', '11', '12'].includes(requestedGrade || '') ? requestedGrade! : undefined;

  const cacheKey = `leaderboard:${gradeParam || 'all'}`;
  try {
    const resObj = await getOrLoadCached(cacheKey, async () => {
      const leaderboard = await getLeaderboardLight(gradeParam);
      const safe = leaderboard.map(u => ({
        email: u.email,
        name: u.name,
        nickname: u.nickname,
        avatarUrl: getPublicAvatarUrl(u.email, u.avatarUrl),
        avatarColor: u.avatarColor,
        role: u.role,
        grade: u.grade,
        experience: u.experience,
      }));

      return { ok: true, leaderboard: safe };
    }, 30_000);

    return NextResponse.json(resObj, {
      headers: {
        'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    console.error('Error loading leaderboard:', error);
    return NextResponse.json({ ok: false, error: 'Чансааг ачаалж чадсангүй. Дахин оролдоно уу.' }, {
      status: 503, headers: { 'Cache-Control': 'no-store' },
    });
  }
}
