import { NextResponse } from "next/server";
import { getLeaderboard } from "../../../lib/users";

export async function GET() {
  const leaderboard = await getLeaderboard();
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
  return NextResponse.json({ ok: true, leaderboard: safe });
}
