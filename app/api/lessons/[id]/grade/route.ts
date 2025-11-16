import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "../../../../../lib/session";
import { gradeSubmission, getLesson } from "../../../../../lib/lessons";
import { addExperience } from "../../../../../lib/users";
import { addNotification } from "../../../../../lib/notifications";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  }

  if (session.role !== "teacher") {
    return NextResponse.json({ error: "Зөвхөн багш оноо өгөх боломжтой" }, { status: 403 });
  }

  try {
    const params = await context.params;
    const { id: lessonId } = params;
    const body = await request.json();
    const { submissionId, score, rewardXP, feedback } = body;

    if (typeof score !== "number" || score < 0 || score > 100) {
      return NextResponse.json({ error: "Оноо 0-100 хооронд байх ёстой" }, { status: 400 });
    }

    if (typeof rewardXP !== "number" || rewardXP < 0 || rewardXP > 500) {
      return NextResponse.json({ error: "Reward XP 0-500 хооронд байх ёстой" }, { status: 400 });
    }

    // Verify lesson exists
    const lesson = await getLesson(lessonId);
    if (!lesson) {
      return NextResponse.json({ error: "Хичээл олдсонгүй" }, { status: 404 });
    }

    // Any teacher can grade submissions (removed author check)
    
    const submission = await gradeSubmission(lessonId, submissionId, score, rewardXP, feedback);

    if (!submission) {
      return NextResponse.json({ error: "Submission олдсонгүй" }, { status: 404 });
    }

    // Award XP to student + notification
    if (rewardXP > 0) {
      await addExperience(submission.studentEmail, rewardXP);
    }
    await addNotification(
      submission.studentEmail,
      session.email,
      "GRADE",
      `📝 "${lesson.title}" хичээлийн даалгаварт ${score} оноо авлаа! +${rewardXP} XP`
    );

    return NextResponse.json({ 
      success: true, 
      submission,
      message: `${submission.studentName}-д ${rewardXP} XP өглөө!` 
    });
  } catch (error: any) {
    console.error("Grade submission error:", error);
    return NextResponse.json({ error: "Серверийн алдаа гарлаа" }, { status: 500 });
  }
}
