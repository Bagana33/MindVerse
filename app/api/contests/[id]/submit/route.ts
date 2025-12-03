import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "../../../../../lib/session";
import { submitToContest, getContest } from "../../../../../lib/contests";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Нэвтэрнэ үү" }, { status: 401 });
  }

  if (session.role !== "student") {
    return NextResponse.json({ ok: false, error: "Зөвхөн сурагч илгээх боломжтой" }, { status: 403 });
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
    const { fileUrl, description } = body;

    if (!fileUrl) {
      return NextResponse.json({ ok: false, error: "Файл шаардлагатай" }, { status: 400 });
    }

    const submission = submitToContest(params.id, {
      userEmail: session.email,
      userName: session.name || session.email,
      fileUrl,
      description: description?.trim(),
    });

    if (!submission) {
      return NextResponse.json({ ok: false, error: "Илгээх боломжгүй (аль хэдийн илгээсэн эсвэл уралдаан дууссан)" }, { status: 400 });
    }

    const updatedContest = getContest(params.id);
    return NextResponse.json({ ok: true, contest: updatedContest, submission });
  } catch (err: any) {
    console.error("Submit to contest error:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Серверийн алдаа" },
      { status: 500 }
    );
  }
}

