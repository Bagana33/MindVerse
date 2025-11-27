import { NextResponse } from "next/server";
import { deleteContest, getContest, updateContest } from "../../../../lib/contests";
import { getSessionFromCookies } from "../../../../lib/session";

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

export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Нэвтэрнэ үү" }, { status: 401 });
  }

  if (session.role !== "teacher") {
    return NextResponse.json({ ok: false, error: "Зөвхөн багш өөрчлөх эрхтэй" }, { status: 403 });
  }

  const params = await context.params;
  const existing = getContest(params.id);
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Уралдаан олдсонгүй" }, { status: 404 });
  }

  if (existing.authorEmail !== session.email) {
    return NextResponse.json({ ok: false, error: "Зөвхөн зохиогч засах боломжтой" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const title = body?.title?.toString().trim();
  const description = body?.description?.toString().trim();
  const startDate = body?.startDate;
  const endDate = body?.endDate;
  const prize = body?.prize !== undefined ? parseInt(body.prize) : undefined;
  const targetGrades = Array.isArray(body?.targetGrades) ? body.targetGrades : undefined;

  if (title !== undefined && title.length < 1) {
    return NextResponse.json({ ok: false, error: "Гарчиг оруулна уу" }, { status: 400 });
  }
  if (description !== undefined && description.length < 1) {
    return NextResponse.json({ ok: false, error: "Тайлбар оруулна уу" }, { status: 400 });
  }

  const newStart = startDate ?? existing.startDate;
  const newEnd = endDate ?? existing.endDate;
  const start = new Date(newStart);
  const end = new Date(newEnd);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return NextResponse.json({ ok: false, error: "Огноо буруу форматтай байна" }, { status: 400 });
  }
  if (end <= start) {
    return NextResponse.json({ ok: false, error: "Дуусах огноо эхлэх огнооноос хойш байх ёстой" }, { status: 400 });
  }

  if (prize !== undefined && (prize < 0 || prize > 1000)) {
    return NextResponse.json({ ok: false, error: "Шагнал 0-1000 XP хооронд байх ёстой" }, { status: 400 });
  }

  const updated = updateContest(params.id, session.email, {
    title,
    description,
    startDate: new Date(newStart).toISOString(),
    endDate: new Date(newEnd).toISOString(),
    prize,
    targetGrades,
  });

  if (!updated) {
    return NextResponse.json({ ok: false, error: "Уралдаан олдсонгүй эсвэл засах эрхгүй" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, contest: updated });
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Нэвтэрнэ үү" }, { status: 401 });
  }

  if (session.role !== "teacher") {
    return NextResponse.json({ ok: false, error: "Зөвхөн багш устгах эрхтэй" }, { status: 403 });
  }

  const params = await context.params;
  const success = deleteContest(params.id, session.email);

  if (!success) {
    return NextResponse.json({ ok: false, error: "Уралдаан олдсонгүй эсвэл устгах эрхгүй" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
