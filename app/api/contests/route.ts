import { NextResponse } from "next/server";
import { getSessionFromCookies } from "../../../lib/session";
import { createContest, getAllContests } from "../../../lib/contests";

// GET: Fetch all contests
export async function GET() {
  const session = await getSessionFromCookies();
  const allContests = getAllContests();
  
  // Filter contests based on student grade
  let contests = allContests;
  if (session && session.role === "student") {
    // Get user's grade
    const { getUser } = await import("../../../lib/users");
    const user = await getUser(session.email);
    const userGrade = user?.grade;
    
    // Filter: show contests with matching grade or no target grades (all grades)
    contests = allContests.filter(contest => {
      if (!contest.targetGrades || contest.targetGrades.length === 0) {
        return true; // Show to all grades
      }
      if (!userGrade) {
        return false; // Student has no grade set
      }
      return contest.targetGrades.includes(userGrade);
    });
  }
  
  return NextResponse.json({ ok: true, contests });
}

// POST: Create a new contest (requires teacher authentication)
export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Нэвтэрнэ үү" }, { status: 401 });
  }

  if (session.role !== "teacher") {
    return NextResponse.json({ ok: false, error: "Зөвхөн багш уралдаан үүсгэх эрхтэй" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const title = (body?.title ?? "").toString().trim();
  const description = (body?.description ?? "").toString().trim();
  const startDate = body?.startDate || "";
  const endDate = body?.endDate || "";
  const prize = parseInt(body?.prize) || 50;
  const targetGrades = Array.isArray(body?.targetGrades) ? body.targetGrades : [];

  if (!title || title.length < 1) {
    return NextResponse.json(
      { ok: false, error: "Гарчиг оруулна уу" },
      { status: 400 }
    );
  }

  if (!description || description.length < 1) {
    return NextResponse.json(
      { ok: false, error: "Тайлбар оруулна уу" },
      { status: 400 }
    );
  }

  if (!startDate || !endDate) {
    return NextResponse.json(
      { ok: false, error: "Эхлэх болон дуусах огноо оруулна уу" },
      { status: 400 }
    );
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return NextResponse.json(
      { ok: false, error: "Огноо буруу форматтай байна" },
      { status: 400 }
    );
  }

  if (end <= start) {
    return NextResponse.json(
      { ok: false, error: "Дуусах огноо эхлэх огнооноос хойш байх ёстой" },
      { status: 400 }
    );
  }

  if (prize < 0 || prize > 1000) {
    return NextResponse.json(
      { ok: false, error: "Шагнал 0-1000 XP хооронд байх ёстой" },
      { status: 400 }
    );
  }

  const newContest = createContest({
    title,
    description,
    authorEmail: session.email,
    authorName: session.name || session.email,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    prize,
    targetGrades,
  });

  return NextResponse.json({ ok: true, contest: newContest });
}
