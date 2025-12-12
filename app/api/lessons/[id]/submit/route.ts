import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "../../../../../lib/session";
import { submitToLesson } from "../../../../../lib/lessons";

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
    
    let body;
    try {
      body = await request.json();
    } catch (jsonError) {
      console.error('JSON parse error in lesson submit:', jsonError);
      return NextResponse.json({ error: "Invalid JSON format" }, { status: 400 });
    }

    const { fileUrl, fileUrls } = body;

    // Support both old format (fileUrl) and new format (fileUrls array)
    // If fileUrls is provided, use it; otherwise fall back to fileUrl as array
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
        // Check if submission already exists in game
        const { data: existing } = await supabase
          .from("game_images")
          .select("*")
          .eq("submission_id", submission.id)
          .single();

        if (!existing) {
          // Add to game
          const gameImageId = `game-img-${submission.id}`;
          await supabase
            .from("game_images")
            .upsert({
              id: gameImageId,
              image_url: submission.fileUrls[0], // Use first file
              added_by: session.email,
              submission_id: submission.id,
              liked_by: [],
            }, {
              onConflict: "id"
            });
        }
      }
    } catch (err) {
      // Ignore errors - game might not be set up yet
      console.log("Auto-add to game error (non-critical):", err);
    }

    return NextResponse.json({ 
      success: true, 
      submission,
      message: "Амжилттай илгээлээ! Багш таны ажлыг шалгаад XP өгнө." 
    });
  } catch (error: any) {
    console.error("Submit lesson error:", error);
    return NextResponse.json({ 
      error: error.message || "Серверийн алдаа гарлаа",
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
