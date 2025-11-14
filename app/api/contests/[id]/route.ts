import { NextResponse } from "next/server";
import { getContest } from "../../../../lib/contests";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const contest = getContest(params.id);
  
  if (!contest) {
    return NextResponse.json({ ok: false, error: "Уралдаан олдсонгүй" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, contest });
}
