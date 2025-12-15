import { NextResponse } from "next/server";
import { getSessionFromCookies } from "../../../../lib/session";
import { supabase } from "../../../../lib/supabase";

type GameImage = {
  id: string;
  image_url: string;
  image_urls?: string[] | null;
  added_by: string | null;
  liked_by: string[];
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
      // Use image_urls if available, otherwise fall back to single image_url
      const imageUrls = img.image_urls && img.image_urls.length > 0 
        ? img.image_urls 
        : (img.image_url ? [img.image_url] : []);
      return {
        id: img.id,
        imageUrl: imageUrls[0] || img.image_url, // Keep for backward compatibility
        imageUrls: imageUrls, // Array of all images
        addedBy: img.added_by,
        studentName: userInfo?.name || null,
        studentNickname: userInfo?.nickname || null,
        likes: img.liked_by?.length || 0,
        likedBy: img.liked_by || [],
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

  // Get winner and rankings info
  let winner = null;
  let rankings: Array<{ email: string; name: string; likes: number; xp: number; rank: number }> = [];
  
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
      
      // Get rankings from game_state if available (stored as JSON)
      // For now, we'll calculate from images
      const sortedImages = (data || []).sort((a: any, b: any) => {
        const likesA = a.liked_by?.length || 0;
        const likesB = b.liked_by?.length || 0;
        return likesB - likesA;
      });
      
      // Award XP based on rank
      const xpAwards = [5, 3, 2]; // 1st, 2nd, 3rd
      for (let i = 0; i < Math.min(3, sortedImages.length); i++) {
        const img = sortedImages[i];
        if (img.added_by) {
          try {
            const user = await getUser(img.added_by);
            if (user) {
              rankings.push({
                email: img.added_by,
                name: user.nickname || user.name || img.added_by,
                likes: img.liked_by?.length || 0,
                xp: xpAwards[i],
                rank: i + 1,
              });
            }
          } catch (err) {
            console.error(`Error fetching user ${img.added_by}:`, err);
          }
        }
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
    rankings,
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

