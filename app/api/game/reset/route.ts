import { NextResponse } from "next/server";
import { getSessionFromCookies } from "../../../../lib/session";
import { supabase } from "../../../../lib/supabase";

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Нэвтэрнэ үү" }, { status: 401 });
  }

  if (session.role !== "teacher") {
    return NextResponse.json({ ok: false, error: "Зөвхөн багш тоглоом дахин эхлүүлэх эрхтэй" }, { status: 403 });
  }

  try {
    // Clear all game images
    const { error: deleteImagesError } = await supabase
      .from("game_images")
      .delete()
      .neq("id", ""); // Delete all

    if (deleteImagesError && deleteImagesError.code !== '42P01') {
      // Ignore "table doesn't exist" error
      console.error("Error deleting game images:", deleteImagesError);
    }

    // Reset game state
    const { error: resetStateError } = await supabase
      .from("game_state")
      .upsert({
        id: "game-state",
        lesson_id: null,
        target_grade: null,
        ended: false,
        winner_email: null,
        winner_submission_id: null,
        ended_at: null,
        ended_by: null,
      }, {
        onConflict: "id"
      });

    if (resetStateError) {
      console.error("Error resetting game state:", resetStateError);
      return NextResponse.json({ ok: false, error: "Тоглоом дахин эхлүүлэхэд алдаа гарлаа" }, { status: 500 });
    }

    const { invalidateServerCache } = await import("../../../../lib/serverCache");
    invalidateServerCache('game');

    return NextResponse.json({
      ok: true,
      message: "Тоглоом амжилттай дахин эхлэв",
    });
  } catch (err: any) {
    console.error("Reset game error:", err);
    return NextResponse.json({ ok: false, error: "Серверийн алдаа" }, { status: 500 });
  }
}

