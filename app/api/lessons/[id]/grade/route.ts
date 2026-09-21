import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "../../../../../lib/session";
import { gradeSubmission, getLesson } from "../../../../../lib/lessons";
import { addExperience } from "../../../../../lib/users";
import { addNotification } from "../../../../../lib/notifications";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromCookies();
    if (!session)
      return NextResponse.json(
        { error: "Нэвтрэх шаардлагатай" },
        { status: 401 },
      );
    if (session.role !== "teacher")
      return NextResponse.json(
        { error: "Зөвхөн багш оноо өгөх боломжтой" },
        { status: 403 },
      );
    const { id: lessonId } = await context.params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body))
      return NextResponse.json(
        { error: "Буруу форматтай хүсэлт" },
        { status: 400 },
      );
    const { submissionId, score, rewardXP, feedback } = body;
    if (
      typeof submissionId !== "string" ||
      !submissionId ||
      !Number.isFinite(score) ||
      score < 0 ||
      score > 100
    ) {
      return NextResponse.json(
        { error: "Оноо 0–100 хооронд байх ёстой" },
        { status: 400 },
      );
    }
    if (!Number.isInteger(rewardXP) || rewardXP < 0 || rewardXP > 500)
      return NextResponse.json(
        { error: "XP 0–500 хооронд бүхэл тоо байх ёстой" },
        { status: 400 },
      );
    if (
      feedback !== undefined &&
      (typeof feedback !== "string" || feedback.length > 10000)
    )
      return NextResponse.json(
        { error: "Тайлбарын формат буруу байна" },
        { status: 400 },
      );
    const lesson = await getLesson(lessonId);
    if (!lesson)
      return NextResponse.json({ error: "Хичээл олдсонгүй" }, { status: 404 });
    const existing = lesson.submissions?.find(
      (submission) => submission.id === submissionId,
    );
    if (!existing)
      return NextResponse.json(
        { error: "Даалгавар олдсонгүй" },
        { status: 404 },
      );
    const previousXP = Number.isFinite(existing.rewardXP)
      ? Math.max(0, existing.rewardXP!)
      : 0;
    // Earned XP is retained. Lowering then raising a grade cannot award the same XP twice.
    const totalXP = Math.max(previousXP, rewardXP);
    const deltaXP = totalXP - previousXP;
    const submission = await gradeSubmission(
      lessonId,
      submissionId,
      score,
      totalXP,
      feedback,
      {
        rewardXP: existing.rewardXP ?? null,
        submittedAt: existing.submittedAt,
      },
    );
    if (!submission)
      return NextResponse.json(
        { error: "Даалгавар өөрчлөгдсөн байна. Шинэчлээд дахин үнэлнэ үү" },
        { status: 409 },
      );
    if (
      deltaXP > 0 &&
      !(await addExperience(submission.studentEmail, deltaXP))
    ) {
      await gradeSubmission(
        lessonId,
        submissionId,
        score,
        previousXP,
        feedback,
        {
          rewardXP: totalXP,
          submittedAt: submission.submittedAt,
          preserveGrade: true,
        },
      ).catch(() => null);
      return NextResponse.json(
        {
          error:
            "Үнэлгээ хадгалагдсан боловч XP шинэчлэгдсэнгүй. Дахин оролдоно уу",
        },
        { status: 503 },
      );
    }
    await addNotification(
      submission.studentEmail,
      session.email,
      "GRADE",
      `📝 "${lesson.title}" хичээлийн даалгаварт ${score} оноо авлаа.${deltaXP ? ` +${deltaXP} XP` : ""}`,
    ).catch(() => {});
    return NextResponse.json({
      success: true,
      submission,
      rewardXP: deltaXP,
      message: `Үнэлгээг хадгаллаа.${deltaXP ? ` +${deltaXP} XP.` : ""}`,
    });
  } catch {
    return NextResponse.json(
      { error: "Үнэлгээг хадгалж чадсангүй. Дахин оролдоно уу" },
      { status: 503 },
    );
  }
}
