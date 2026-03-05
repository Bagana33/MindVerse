import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "../../../../lib/session";
import { deleteContest, getContest, updateContest } from "../../../../lib/contests";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const contest = await getContest(params.id);

    if (!contest) {
      return NextResponse.json({ ok: false, error: "Уралдаан олдсонгүй" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, contest });
  } catch (err: any) {
    console.error("Get contest error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Уралдааныг авахад алдаа гарлаа" },
      { status: 500 }
    );
  }
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
    return NextResponse.json({ ok: false, error: "Зөвхөн багш засах боломжтой" }, { status: 403 });
  }

  const params = await context.params;
  const existing = await getContest(params.id);
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Уралдаан олдсонгүй" }, { status: 404 });
  }

  if (existing.authorEmail !== session.email) {
    return NextResponse.json({ ok: false, error: "Та зөвхөн өөрийн уралдааныг засах боломжтой" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { title, description, startDate, endDate, prize, targetGrades } = body;

    const updates: any = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (startDate !== undefined) updates.startDate = startDate;
    if (endDate !== undefined) updates.endDate = endDate;
    if (prize !== undefined) updates.prize = prize;
    if (targetGrades !== undefined) updates.targetGrades = targetGrades;

    const updated = await updateContest(params.id, session.email, updates);
    if (!updated) {
      return NextResponse.json({ ok: false, error: "Засах боломжгүй" }, { status: 400 });
    }

    return NextResponse.json({ ok: true, contest: updated });
  } catch (err: any) {
    console.error("Update contest error:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Серверийн алдаа" },
      { status: 500 }
    );
  }
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
    return NextResponse.json({ ok: false, error: "Зөвхөн багш устгах боломжтой" }, { status: 403 });
  }

  const params = await context.params;
  try {
    const success = await deleteContest(params.id, session.email);

    if (!success) {
      return NextResponse.json({ ok: false, error: "Уралдаан олдсонгүй эсвэл устгах эрхгүй" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Delete contest error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Устгахад алдаа гарлаа" },
      { status: 500 }
    );
  }
}
