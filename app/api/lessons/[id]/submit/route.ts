import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "../../../../../lib/session";
import {
  submitToLesson,
  getLesson,
  gradeSubmission,
} from "../../../../../lib/lessons";
import { addExperience, getUser } from "../../../../../lib/users";
import { addNotification } from "../../../../../lib/notifications";

function failure(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return failure("Нэвтрэх шаардлагатай", 401);
    if (session.role !== "student")
      return failure("Зөвхөн сурагчид даалгавар илгээх боломжтой", 403);
    const { id: lessonId } = await context.params;
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body))
      return failure("Буруу форматтай хүсэлт", 400);
    const input = body as Record<string, unknown>;
    const hasAnswers = input.answers !== undefined;
    const fileValue =
      input.fileUrls !== undefined
        ? input.fileUrls
        : input.fileUrl !== undefined
          ? [input.fileUrl]
          : undefined;
    let urls: string[] | undefined;
    if (fileValue !== undefined) {
      if (
        !Array.isArray(fileValue) ||
        fileValue.length < 1 ||
        fileValue.length > 2
      )
        return failure("1–2 файл сонгоно уу", 400);
      urls = [];
      for (const value of fileValue) {
        if (typeof value !== "string" || value.length > 2048)
          return failure("Файлын холбоос буруу байна", 400);
        try {
          const url = new URL(value);
          if (url.protocol !== "https:" || url.username || url.password)
            return failure("Файлын HTTPS холбоос оруулна уу", 400);
          urls.push(url.toString());
        } catch {
          return failure("Файлын холбоос буруу байна", 400);
        }
      }
      if (new Set(urls).size !== urls.length)
        return failure("Ижил файлыг давхар сонгосон байна", 400);
    }
    if (!hasAnswers && !urls)
      return failure("Хариулт эсвэл даалгаврын файл илгээнэ үү", 400);

    // Access, complete answer structure and lesson existence are checked before any write.
    const lesson = await getLesson(lessonId);
    if (!lesson) return failure("Хичээл олдсонгүй", 404);
    if (!lesson.published)
      return failure("Энэ хичээл нийтлэгдээгүй байна", 403);
    if (lesson.targetGrades?.length) {
      const student = await getUser(session.email, { bypassCache: true });
      if (!student?.grade || !lesson.targetGrades.includes(student.grade))
        return failure("Энэ хичээл таны ангид зориулагдаагүй байна", 403);
    }
    let quizScore: number | undefined;
    let feedback: string | undefined;
    if (hasAnswers) {
      const answers = input.answers;
      if (
        !Array.isArray(answers) ||
        !lesson.questions.length ||
        answers.length !== lesson.questions.length ||
        answers.some(
          (answer, index) =>
            !Number.isInteger(answer) ||
            answer < 0 ||
            answer >= lesson.questions[index].options.length,
        )
      ) {
        return failure("Бүх асуултад зөв форматтай хариулт сонгоно уу", 400);
      }
      const correct = lesson.questions.filter(
        (question, index) => answers[index] === question.correctAnswer,
      ).length;
      quizScore = Math.round((correct / lesson.questions.length) * 100);
      feedback = `${correct}/${lesson.questions.length} зөв хариуллаа (${quizScore}%).`;
    }

    const submission = await submitToLesson(
      lessonId,
      session.email,
      session.name || session.email,
      urls,
    );
    if (!submission)
      return failure(
        "Даалгавар өөрчлөгдсөн байна. Хуудсаа шинэчлээд дахин оролдоно уу",
        409,
      );

    let saved = submission;
    let awardedXP = 0;
    if (quizScore !== undefined) {
      const previousXP = Number.isFinite(submission.rewardXP)
        ? Math.max(0, submission.rewardXP!)
        : 0;
      const totalXP = Math.max(previousXP, quizScore); // Up to 100 total quiz XP; repeated attempts never re-award it.
      const graded = await gradeSubmission(
        lessonId,
        submission.id,
        quizScore,
        totalXP,
        feedback,
        {
          rewardXP: submission.rewardXP ?? null,
          submittedAt: submission.submittedAt,
          // Quiz results must not replace a file submission's pending/teacher assessment.
          preserveGrade: !!(submission.fileUrls?.length || submission.fileUrl),
        },
      );
      if (!graded)
        return failure(
          "Үр дүн өөр хүсэлтээр шинэчлэгдсэн байна. Хуудсаа шинэчлээд дахин оролдоно уу",
          409,
        );
      saved = graded;
      const delta = totalXP - previousXP;
      if (delta > 0) {
        const updatedUser = await addExperience(session.email, delta);
        if (!updatedUser) {
          // Release only our unchanged claim, allowing a retry when XP was not delivered.
          await gradeSubmission(
            lessonId,
            submission.id,
            quizScore,
            previousXP,
            feedback,
            {
              rewardXP: totalXP,
              submittedAt: submission.submittedAt,
              preserveGrade: true,
            },
          ).catch(() => null);
          return failure(
            "Үр дүн хадгалагдсан боловч XP шинэчлэгдсэнгүй. Дахин оролдоно уу",
            503,
          );
        }
        awardedXP = delta;
        await addNotification(
          session.email,
          "quiz",
          "GRADE",
          `📝 "${lesson.title}" асуултад ${quizScore} оноо авлаа. +${delta} XP`,
        ).catch(() => {});
      }
    }

    // Uploaded work is accepted for teacher review; no fabricated AI grade or XP is returned.
    if (urls?.length) {
      try {
        const { supabase } = await import("../../../../../lib/supabase");
        const signal = AbortSignal.timeout(5_000);
        const { data: gameState } = await supabase
          .from("game_state")
          .select("id")
          .eq("id", "game-state")
          .eq("lesson_id", lessonId)
          .eq("ended", false)
          .abortSignal(signal)
          .maybeSingle();
        if (gameState) {
          await supabase
            .from("game_images")
            .upsert(
              {
                id: `game-img-${submission.id}`,
                image_url: urls[0],
                image_urls: urls,
                added_by: session.email,
                submission_id: submission.id,
                liked_by: [],
              },
              { onConflict: "id", ignoreDuplicates: true },
            )
            .abortSignal(signal);
        }
      } catch {
        /* Game participation does not change whether the assignment was accepted. */
      }
    }
    return NextResponse.json({
      success: true,
      submission: saved,
      ...(quizScore !== undefined
        ? { score: quizScore, rewardXP: awardedXP, feedback }
        : {}),
      message:
        quizScore !== undefined
          ? `Үр дүнг хадгаллаа. ${feedback}${awardedXP ? ` +${awardedXP} XP.` : ""}`
          : "Файлыг хүлээн авлаа. Багшийн үнэлгээг хүлээнэ үү.",
    });
  } catch {
    return failure("Даалгаврыг хадгалж чадсангүй. Дахин оролдоно уу", 503);
  }
}
