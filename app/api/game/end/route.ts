import { NextResponse } from "next/server";
import { getSessionFromCookies } from "../../../../lib/session";
import { supabase } from "../../../../lib/supabase";
import { addExperience, getAllUsers, getUser } from "../../../../lib/users";
import { addNotification } from "../../../../lib/notifications";

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Нэвтэрнэ үү" }, { status: 401 });
  }

  if (session.role !== "teacher") {
    return NextResponse.json({ ok: false, error: "Зөвхөн багш тоглоом дуусгах эрхтэй" }, { status: 403 });
  }

  try {
    // Check if game is already ended
    const { data: gameState, error: stateError } = await supabase
      .from("game_state")
      .select("*")
      .eq("id", "game-state")
      .single();

    if (stateError && stateError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error("Error fetching game state:", stateError);
    }

    if (gameState?.ended) {
      return NextResponse.json({ ok: false, error: "Тоглоом аль хэдийн дууссан байна" }, { status: 400 });
    }

    // Get all images
    const { data: images, error: imagesError } = await supabase
      .from("game_images")
      .select("*");

    if (imagesError) {
      if (imagesError.code === '42P01' || imagesError.message?.includes('does not exist')) {
        return NextResponse.json({ 
          ok: false, 
          error: "Game table үүсээгүй байна. Supabase дээр migration ажиллуулна уу." 
        }, { status: 500 });
      }
      console.error("Error fetching images:", imagesError);
      return NextResponse.json({ ok: false, error: "Зургуудыг авахад алдаа" }, { status: 500 });
    }

    if (!images || images.length === 0) {
      return NextResponse.json({ ok: false, error: "Зураг байхгүй байна" }, { status: 400 });
    }

    // Find image with most likes
    let winnerImage = images[0];
    let maxLikes = (images[0].liked_by?.length || 0) - (images[0].disliked_by?.length || 0);

    for (const img of images) {
      const score = (img.liked_by?.length || 0) - (img.disliked_by?.length || 0);
      if (score > maxLikes) {
        maxLikes = score;
        winnerImage = img;
      }
    }

    const winnerEmail = winnerImage.added_by;
    const winnerSubmissionId = winnerImage.submission_id;
    if (!winnerEmail) {
      return NextResponse.json({ ok: false, error: "Ялагчийг тодорхойлох боломжгүй" }, { status: 400 });
    }

    // Get winner user info
    const winner = await getUser(winnerEmail);
    if (!winner) {
      return NextResponse.json({ ok: false, error: "Ялагч олдсонгүй" }, { status: 404 });
    }

    // Give 2 XP to winner
    await addExperience(winnerEmail, 2);

    // Get winner's display name
    const winnerName = winner.nickname || winner.name || winnerEmail;

    // Send notifications to all users
    try {
      const allUsers = await getAllUsers();
      const notifications = allUsers.map(user =>
        addNotification(
          user.email,
          session.email,
          'CONTEST_WIN',
          `🎉 ${winnerName} баяр хүргэе! Vote game-д хамгийн их like авсан тул +2 XP хүртлээ!`
        )
      );
      await Promise.allSettled(notifications);
    } catch (notifError) {
      console.error("Failed to send notifications:", notifError);
      // Continue even if notifications fail
    }

    // Update game state to mark as ended
    const { error: updateError } = await supabase
      .from("game_state")
      .upsert({
        id: "game-state",
        lesson_id: gameState?.lesson_id || null,
        target_grade: gameState?.target_grade || null,
        ended: true,
        winner_email: winnerEmail,
        winner_submission_id: winnerSubmissionId || null,
        ended_at: new Date().toISOString(),
        ended_by: session.email,
      }, {
        onConflict: "id"
      });

    if (updateError) {
      console.error("Error updating game state:", updateError);
      // Continue even if state update fails
    }

    return NextResponse.json({
      ok: true,
      winner: {
        email: winnerEmail,
        name: winnerName,
        imageId: winnerImage.id,
        likes: winnerImage.liked_by?.length || 0,
        score: maxLikes,
      },
      message: `${winnerName} баяр хүргэе! +2 XP хүртлээ.`,
    });
  } catch (err: any) {
    console.error("End game error:", err);
    return NextResponse.json({ ok: false, error: "Серверийн алдаа" }, { status: 500 });
  }
}

