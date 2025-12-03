import { NextRequest, NextResponse } from "next/server";
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
  const contest = getContest(params.id);
  if (!contest) {
    return NextResponse.json({ ok: false, error: "Уралдаан олдсонгүй" }, { status: 404 });
  }

  if (contest.status !== "active") {
    return NextResponse.json({ ok: false, error: "Уралдаан идэвхтэй биш байна" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { submissionId } = body;

    if (!submissionId) {
      return NextResponse.json({ ok: false, error: "Submission ID шаардлагатай" }, { status: 400 });
    }

    const submission = voteSubmission(params.id, submissionId, session.email);

    if (!submission) {
      return NextResponse.json({ ok: false, error: "Санал өгөх боломжгүй" }, { status: 400 });
    }

    const updatedContest = getContest(params.id);
    return NextResponse.json({ ok: true, contest: updatedContest });
  } catch (err: any) {
    console.error("Vote submission error:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Серверийн алдаа" },
      { status: 500 }
    );
  }
}

