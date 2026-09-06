import { NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";
import { getCached, setCached, invalidateServerCache } from "../../../../lib/serverCache";

type GameImage = {
  id: string;
  image_url: string;
  image_urls?: string[] | null;
  added_by: string | null;
  liked_by: string[];
  created_at: string;
};

async function toClient(images: GameImage[]) {
  const userEmails = Array.from(new Set(images.map(img => img.added_by).filter(Boolean))) as string[];
  const userInfoMap = new Map<string, { name?: string; nickname?: string }>();

  if (userEmails.length > 0) {
    try {
      const { data: users } = await supabase
        .from("users")
        .select("email, name, nickname")
        .in("email", userEmails);

      (users || []).forEach((u: any) => {
        userInfoMap.set(u.email, { name: u.name, nickname: u.nickname });
      });
    } catch (err) {
      console.error("Error fetching users for game images:", err);
    }
  }

  return images
    .map((img) => {
      const userInfo = img.added_by ? userInfoMap.get(img.added_by) : null;
      let imageUrls: string[] = [];
      if (img.image_urls) {
        if (Array.isArray(img.image_urls)) {
          imageUrls = img.image_urls;
        } else if (typeof img.image_urls === 'string') {
          try {
            imageUrls = JSON.parse(img.image_urls);
          } catch {
            imageUrls = [img.image_url];
          }
        }
      } else if (img.image_url) {
        imageUrls = [img.image_url];
      }
      
      return {
        id: img.id,
        imageUrl: imageUrls[0] || img.image_url || '',
        imageUrls: imageUrls,
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
  const cacheKey = 'game:images_and_state';
  const cached = getCached<any>(cacheKey, 6_000);
  if (cached) {
    return NextResponse.json(cached);
  }

  // Get game state first
  let gameState: any = null;
  try {
    const { data: stateData } = await supabase
      .from("game_state")
      .select("*")
      .eq("id", "game-state")
      .single();
    gameState = stateData;
  } catch (stateError) {
    // Ignore state errors
  }

  if (!gameState?.lesson_id) {
    const resObj = { 
      ok: true, 
      images: [],
      gameEnded: false,
      winner: null,
      lessonId: null,
      targetGrade: null,
    };
    setCached(cacheKey, resObj, 6_000);
    return NextResponse.json(resObj);
  }

  const { data, error } = await supabase
    .from("game_images")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      return NextResponse.json({ 
        ok: true, 
        images: [],
        gameEnded: false,
        lessonId: gameState?.lesson_id || null,
        targetGrade: gameState?.target_grade || null,
      });
    }
    return NextResponse.json({ ok: false, error: "Алдаа гарлаа" }, { status: 500 });
  }

  let winner = null;
  let rankings: Array<{ email: string; name: string; likes: number; xp: number; rank: number }> = [];
  
  if (gameState?.ended && gameState.winner_email) {
    try {
      const { data: winnerUser } = await supabase
        .from("users")
        .select("email, name, nickname")
        .eq("email", gameState.winner_email)
        .single();

      if (winnerUser) {
        winner = {
          email: gameState.winner_email,
          name: winnerUser.nickname || winnerUser.name || gameState.winner_email,
        };
      }
      
      const sortedImages = (data || []).slice().sort((a: any, b: any) => {
        const likesA = a.liked_by?.length || 0;
        const likesB = b.liked_by?.length || 0;
        return likesB - likesA;
      });
      
      const topEmails = sortedImages.slice(0, 3).map((img: any) => img.added_by).filter(Boolean);
      if (topEmails.length > 0) {
        const { data: topUsers } = await supabase
          .from("users")
          .select("email, name, nickname")
          .in("email", topEmails);

        const topUserMap = new Map((topUsers || []).map((u: any) => [u.email, u]));
        const xpAwards = [5, 3, 2];
        for (let i = 0; i < Math.min(3, sortedImages.length); i++) {
          const img = sortedImages[i];
          if (img.added_by) {
            const user = topUserMap.get(img.added_by);
            rankings.push({
              email: img.added_by,
              name: user?.nickname || user?.name || img.added_by,
              likes: img.liked_by?.length || 0,
              xp: xpAwards[i] || 1,
              rank: i + 1,
            });
          }
        }
      }
    } catch (err) {
      console.error("Error fetching winner:", err);
    }
  }

  const clientImages = await toClient(data || []);
  const resObj = { 
    ok: true, 
    images: clientImages,
    gameEnded: gameState?.ended || false,
    winner,
    rankings,
    lessonId: gameState?.lesson_id || null,
    targetGrade: gameState?.target_grade || null,
  };

  setCached(cacheKey, resObj, 6_000);
  return NextResponse.json(resObj);
}

export async function POST(req: Request) {
  return NextResponse.json({ 
    ok: false, 
    error: "Энэ endpoint ашиглахгүй. /api/game/setup ашиглана уу." 
  }, { status: 400 });
}


