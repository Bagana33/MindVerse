import { NextResponse } from "next/server";
import { getCommentCounts } from "../../../../../lib/comments";

// GET /api/posts/comments/counts?ids=post1,post2,...
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const idsRaw = searchParams.get('ids') || '';
  const ids = idsRaw.split(',').map(s => s.trim()).filter(Boolean);
  if (ids.length === 0) {
    return NextResponse.json({ ok: true, counts: {} });
  }
  const counts = await getCommentCounts(ids);
  return new NextResponse(JSON.stringify({ ok: true, counts }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=60'
    }
  });
}
