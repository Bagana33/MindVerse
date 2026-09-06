import { NextResponse } from "next/server";
import { getCommentCounts } from "../../../../../lib/comments";
import { getCached, setCached } from "../../../../../lib/serverCache";

// GET /api/posts/comments/counts?ids=post1,post2,...
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const idsRaw = searchParams.get('ids') || '';
  const ids = idsRaw.split(',').map(s => s.trim()).filter(Boolean);
  if (ids.length === 0) {
    return NextResponse.json({ ok: true, counts: {} });
  }

  const cacheKey = `comment_counts:${ids.sort().join(',')}`;
  const cached = getCached<any>(cacheKey, 20_000);
  if (cached) {
    return NextResponse.json({ ok: true, counts: cached });
  }

  const counts = await getCommentCounts(ids);
  setCached(cacheKey, counts, 20_000);

  return new NextResponse(JSON.stringify({ ok: true, counts }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
    },
  });
}
