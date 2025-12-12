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

    // Sort images by likes (highest first)
    const sortedImages = [...images].sort((a, b) => {
      const likesA = a.liked_by?.length || 0;
      const likesB = b.liked_by?.length || 0;
      if (likesB !== likesA) {
        return likesB - likesA;
      }
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });

    if (sortedImages.length === 0) {
      return NextResponse.json({ ok: false, error: "Зураг байхгүй байна" }, { status: 400 });
    }

    // Award XP to top 3
    const rankings: Array<{ email: string; name: string; likes: number; xp: number; rank: number }> = [];
    
    // 1st place: 5 XP
    if (sortedImages.length >= 1 && sortedImages[0].added_by) {
      const firstEmail = sortedImages[0].added_by;
      const firstUser = await getUser(firstEmail);
      if (firstUser) {
        await addExperience(firstEmail, 5);
        rankings.push({
          email: firstEmail,
          name: firstUser.nickname || firstUser.name || firstEmail,
          likes: sortedImages[0].liked_by?.length || 0,
          xp: 5,
          rank: 1,
        });
      }
    }

    // 2nd place: 3 XP
    if (sortedImages.length >= 2 && sortedImages[1].added_by) {
      const secondEmail = sortedImages[1].added_by;
      const secondUser = await getUser(secondEmail);
      if (secondUser) {
        await addExperience(secondEmail, 3);
        rankings.push({
          email: secondEmail,
          name: secondUser.nickname || secondUser.name || secondEmail,
          likes: sortedImages[1].liked_by?.length || 0,
          xp: 3,
          rank: 2,
        });
      }
    }

    // 3rd place: 2 XP
    if (sortedImages.length >= 3 && sortedImages[2].added_by) {
      const thirdEmail = sortedImages[2].added_by;
      const thirdUser = await getUser(thirdEmail);
      if (thirdUser) {
        await addExperience(thirdEmail, 2);
        rankings.push({
          email: thirdEmail,
          name: thirdUser.nickname || thirdUser.name || thirdEmail,
          likes: sortedImages[2].liked_by?.length || 0,
          xp: 2,
          rank: 3,
        });
      }
    }

    const winnerImage = sortedImages[0];
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

    // Get winner's display name
    const winnerName = winner.nickname || winner.name || winnerEmail;

    // Send notifications to all users
    try {
      const allUsers = await getAllUsers();
      let notificationMessage = "🎉 Vote game дууссан! ";
      if (rankings.length > 0) {
        const winners = rankings.map(r => `${r.rank}. ${r.name} (${r.likes} like, +${r.xp} XP)`).join(", ");
        notificationMessage += winners;
      } else {
        notificationMessage += `${winnerName} баяр хүргэе!`;
      }
      
      const notifications = allUsers.map(user =>
        addNotification(
          user.email,
          session.email,
          'CONTEST_WIN',
          notificationMessage
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
        likes: sortedImages[0].liked_by?.length || 0,
      },
      rankings,
      message: `Тоглоом дууссан! ${rankings.map(r => `${r.rank}. ${r.name} (+${r.xp} XP)`).join(", ")}`,
    });
  } catch (err: any) {
    console.error("End game error:", err);
    return NextResponse.json({ ok: false, error: "Серверийн алдаа" }, { status: 500 });
  }
}

