import { NextResponse } from "next/server";
import { getSessionFromCookies } from "../../../lib/session";
import { createContest, getAllContests } from "../../../lib/contests";

// GET: Fetch all contests
export async function GET() {
  try {
    const session = await getSessionFromCookies();
    const allContests = await getAllContests();

    // Filter contests based on student grade
    let contests = allContests;
    if (session && session.role === "student") {
      const { getUser } = await import("../../../lib/users");
      const user = await getUser(session.email);
      const userGrade = user?.grade;

      // Filter: show contests with matching grade or no target grades (all grades)
      contests = allContests.filter((contest) => {
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
  } catch (err: any) {
    console.error("Get contests error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Уралдааныг авахад алдаа гарлаа" },
      { status: 500 }
    );
  }
}

// POST: Create a new contest (requires teacher authentication)
export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Нэвтэрнэ үү" }, { status: 401 });
  }

  if (session.role !== "teacher") {
    return NextResponse.json({ ok: false, error: "Зөвхөн багш уралдаан үүсгэх боломжтой" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { title, description, startDate, endDate, prize, targetGrades } = body;

    if (!title || !description || !startDate || !endDate || prize === undefined) {
      return NextResponse.json(
        { ok: false, error: "Бүх талбарыг бөглөнө үү" },
        { status: 400 }
      );
    }

    const contest = await createContest({
      title: title.trim(),
      description: description.trim(),
      authorEmail: session.email,
      authorName: session.name || session.email,
      startDate,
      endDate,
      prize: Number(prize) || 0,
      targetGrades: Array.isArray(targetGrades) ? targetGrades : [],
    });

    return NextResponse.json({ ok: true, contest });
  } catch (err: any) {
    console.error("Create contest error:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Серверийн алдаа" },
      { status: 500 }
    );
  }
}
