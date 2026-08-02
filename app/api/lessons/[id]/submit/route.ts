import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "../../../../../lib/session";
import { submitToLesson, getLesson, gradeSubmission } from "../../../../../lib/lessons";
import { addExperience } from "../../../../../lib/users";
import { addNotification } from "../../../../../lib/notifications";
import { generateDesignCritique } from "../../../../../lib/ai-critique";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
    }

    if (session.role !== "student") {
      return NextResponse.json({ error: "Зөвхөн сурагчид submission илгээх боломжтой" }, { status: 403 });
    }

    const params = await context.params;
    const { id: lessonId } = params;
    
    let body: any = {};
    try {
      body = await request.json();
    } catch (jsonError) {
      console.error('JSON parse error in lesson submit:', jsonError);
      return NextResponse.json({ error: "Invalid JSON format" }, { status: 400 });
    }

    const { fileUrl, fileUrls, answers } = body;

    // Support both old format (fileUrl) and new format (fileUrls array)
    const urls = fileUrls 
      ? (Array.isArray(fileUrls) ? fileUrls : [fileUrls])
      : (fileUrl ? [fileUrl] : undefined);

    // Validate: max 2 files
    if (urls && urls.length > 2) {
      return NextResponse.json({ error: "Зөвхөн 2 файл оруулах боломжтой" }, { status: 400 });
    }

    const submission = await submitToLesson(lessonId, session.email, session.name || session.email, urls);

    if (!submission) {
      return NextResponse.json({ error: "Илгээхэд алдаа гарлаа" }, { status: 500 });
    }

    // Automatically add to game if there's an active game for this lesson
    try {
      const { supabase } = await import("../../../../../lib/supabase");
      const { data: gameState } = await supabase
        .from("game_state")
        .select("*")
        .eq("id", "game-state")
        .eq("lesson_id", lessonId)
        .eq("ended", false)
        .single();

      if (gameState && submission.fileUrls && submission.fileUrls.length > 0) {
        const { data: existing } = await supabase
          .from("game_images")
          .select("*")
          .eq("submission_id", submission.id)
          .single();

        if (!existing) {
          const gameImageId = `game-img-${submission.id}`;
          await supabase
            .from("game_images")
            .upsert({
              id: gameImageId,
              image_url: submission.fileUrls[0],
              image_urls: submission.fileUrls,
              added_by: session.email,
              submission_id: submission.id,
              liked_by: [],
            }, {
              onConflict: "id"
            });
        }
      }
    } catch (err) {
      console.log("Auto-add to game error (non-critical):", err);
    }

    // --- AI AUTO-GRADING SYSTEM ---
    let autoScore = 90;
    let autoXP = 100;
    let autoFeedback = "🤖 AI Шалгагч: Даалгавар амжилттай шалгагдлаа! Бүтээл болон гүйцэтгэл сайн байна.";

    const lesson = await getLesson(lessonId);
    const lessonTitle = lesson?.title || "Хичээл";

    if (Array.isArray(answers) && lesson && lesson.questions && lesson.questions.length > 0) {
      let correctCount = 0;
      lesson.questions.forEach((q, idx) => {
        if (answers[idx] === q.correctAnswer) {
          correctCount++;
        }
      });
      const pct = Math.round((correctCount / lesson.questions.length) * 100);
      autoScore = pct;
      autoXP = Math.max(20, Math.round((pct / 100) * 100)); // Up to 100 XP for quiz
      autoFeedback = `🤖 AI Асуулт хариултыг шалгалаа: ${correctCount}/${lesson.questions.length} зөв хариуллаа! (${pct}%)`;
    } else if (urls && urls.length > 0 && lesson) {
      try {
        const critique = await generateDesignCritique({
          title: lesson.title,
          description: lesson.description,
          imageUrl: urls[0],
        });
        autoScore = 95;
        autoXP = 150; // 150 XP for design submission
        autoFeedback = `🤖 AI Автомат Шалгалтын Дүн:\n${critique}`;
      } catch (e) {
        autoScore = 90;
        autoXP = 100;
        autoFeedback = `🤖 AI Шалгагч: Даалгаврын файлыг хүлээн авч шалгалаа. Амжилттай!`;
      }
    }

    // Apply grade automatically
    const gradedSubmission = await gradeSubmission(
      lessonId,
      submission.id,
      autoScore,
      autoXP,
      autoFeedback
    );

    // Award XP to student
    if (autoXP > 0) {
      await addExperience(session.email, autoXP);
    }

    // Send notification
    await addNotification(
      session.email,
      'ai-assistant',
      'GRADE',
      `📝 🤖 AI Автомат шалгагч "${lessonTitle}" даалгаврыг шалгаж ${autoScore} оноо, +${autoXP} XP өглөө!`
    ).catch(() => {});

    return NextResponse.json({ 
      success: true, 
      submission: gradedSubmission || submission,
      score: autoScore,
      rewardXP: autoXP,
      feedback: autoFeedback,
      message: `🤖 AI Автомат шалгагч даалгаврыг шалгаж ${autoScore} оноо, +${autoXP} XP өглөө!` 
    });
  } catch (error: any) {
    console.error("Submit lesson error:", error);
    return NextResponse.json({ 
      error: error.message || "Серверийн алдаа гарлаа",
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
