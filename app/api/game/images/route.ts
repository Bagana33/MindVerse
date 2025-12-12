import { NextResponse } from "next/server";
import { getSessionFromCookies } from "../../../../lib/session";
import { supabase } from "../../../../lib/supabase";

type GameImage = {
  id: string;
  image_url: string;
  added_by: string | null;
  liked_by: string[];
  disliked_by: string[];
  created_at: string;
};

async function toClient(images: GameImage[]) {
  // Get all unique user emails
  const userEmails = new Set<string>();
  images.forEach(img => {
    if (img.added_by) userEmails.add(img.added_by);
  });

  // Fetch user info for all emails
  const userInfoMap = new Map<string, { name?: string; nickname?: string }>();
  if (userEmails.size > 0) {
    try {
      const { getUser } = await import("../../../../lib/users");
      const userPromises = Array.from(userEmails).map(async (email) => {
        try {
          const user = await getUser(email);
          if (user) {
            userInfoMap.set(email, {
              name: user.name,
              nickname: user.nickname,
            });
          }
        } catch (err) {
          console.error(`Error fetching user ${email}:`, err);
        }
      });
      await Promise.allSettled(userPromises);
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  }

  return images
    .map((img) => {
      const userInfo = img.added_by ? userInfoMap.get(img.added_by) : null;
      return {
        id: img.id,
        imageUrl: img.image_url,
        addedBy: img.added_by,
        studentName: userInfo?.name || null,
        studentNickname: userInfo?.nickname || null,
        likes: img.liked_by?.length || 0,
        dislikes: img.disliked_by?.length || 0,
        score: (img.liked_by?.length || 0) - (img.disliked_by?.length || 0),
        likedBy: img.liked_by || [],
        dislikedBy: img.disliked_by || [],
        createdAt: img.created_at,
      };
    })
    .sort((a, b) => b.likes - a.likes || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function GET() {
  // Get game state first
  let gameState = null;
  try {
    const { data: stateData } = await supabase
      .from("game_state")
      .select("*")
      .eq("id", "game-state")
      .single();
    gameState = stateData;
  } catch (stateError) {
    // Ignore state errors, game might not have state table yet
  }

  // If no lesson selected, return empty
  if (!gameState?.lesson_id) {
    return NextResponse.json({ 
      ok: true, 
      images: [],
      gameEnded: false,
      winner: null,
      lessonId: null,
      targetGrade: null,
    });
  }

  // Get game images (which are linked to lesson submissions)
  const { data, error } = await supabase
    .from("game_images")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    // If table doesn't exist, return empty array
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      console.log("game_images table doesn't exist yet, returning empty array");
      return NextResponse.json({ 
        ok: true, 
        images: [],
        gameEnded: false,
        lessonId: gameState?.lesson_id || null,
        targetGrade: gameState?.target_grade || null,
        warning: "Table not created yet. Please run migration."
      });
    }
    console.error("Game images fetch error:", error);
    return NextResponse.json({ ok: false, error: "Алдаа гарлаа" }, { status: 500 });
  }

  // Get winner info
  let winner = null;
  if (gameState?.ended && gameState.winner_email) {
    try {
      const { getUser } = await import("../../../../lib/users");
      const winnerUser = await getUser(gameState.winner_email);
      if (winnerUser) {
        winner = {
          email: gameState.winner_email,
          name: winnerUser.nickname || winnerUser.name || gameState.winner_email,
        };
      }
    } catch (err) {
      console.error("Error fetching winner:", err);
    }
  }

  return NextResponse.json({ 
    ok: true, 
    images: await toClient(data || []),
    gameEnded: gameState?.ended || false,
    winner,
    lessonId: gameState?.lesson_id || null,
    targetGrade: gameState?.target_grade || null,
  });
}

// POST is no longer used - images come from lesson submissions via /api/game/setup
export async function POST(req: Request) {
  return NextResponse.json({ 
    ok: false, 
    error: "Энэ endpoint ашиглахгүй. /api/game/setup ашиглана уу." 
  }, { status: 400 });
}

