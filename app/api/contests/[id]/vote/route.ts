import { NextResponse } from "next/server";
import { getSessionFromCookies } from "../../../../../lib/session";
import { voteSubmission, getContest } from "../../../../../lib/contests";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Нэвтэрнэ үү" }, { status: 401 });
  }

  const params = await context.params;
  const body = await req.json().catch(() => ({}));
  const submissionId = body?.submissionId;

  if (!submissionId) {
    return NextResponse.json({ ok: false, error: "Submission ID шаардлагатай" }, { status: 400 });
  }

  const success = voteSubmission(params.id, submissionId, session.email);

  if (!success) {
    return NextResponse.json({ ok: false, error: "Санал өгөхөд алдаа гарлаа" }, { status: 400 });
  }

  const contest = getContest(params.id);
  return NextResponse.json({ ok: true, contest });
}
