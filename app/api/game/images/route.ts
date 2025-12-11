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

function toClient(images: GameImage[]) {
  return images
    .map((img) => ({
      id: img.id,
      imageUrl: img.image_url,
      addedBy: img.added_by,
      likes: img.liked_by?.length || 0,
      dislikes: img.disliked_by?.length || 0,
      score: (img.liked_by?.length || 0) - (img.disliked_by?.length || 0),
      likedBy: img.liked_by || [],
      dislikedBy: img.disliked_by || [],
      createdAt: img.created_at,
    }))
    .sort((a, b) => b.score - a.score || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function GET() {
  const { data, error } = await supabase
    .from("game_images")
    .select("*");

  if (error) {
    // If table doesn't exist, return empty array
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      console.log("game_images table doesn't exist yet, returning empty array");
      return NextResponse.json({ 
        ok: true, 
        images: [],
        warning: "Table not created yet. Please run migration."
      });
    }
    console.error("Game images fetch error:", error);
    return NextResponse.json({ ok: false, error: "Алдаа гарлаа" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, images: toClient(data || []) });
}

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Нэвтэрнэ үү" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { imageUrl } = body;
    if (!imageUrl) {
      return NextResponse.json({ ok: false, error: "Зураг оруулна уу" }, { status: 400 });
    }

    const id = `game-img-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const { error } = await supabase
      .from("game_images")
      .insert([{
        id,
        image_url: imageUrl,
        added_by: session.email,
      }]);

    if (error) {
      // If table doesn't exist, return error with helpful message
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json({ 
          ok: false, 
          error: "Game table үүсээгүй байна. Supabase дээр migration ажиллуулна уу." 
        }, { status: 500 });
      }
      console.error("Game image insert error:", error);
      return NextResponse.json({ ok: false, error: "Нэмэхэд алдаа гарлаа" }, { status: 500 });
    }

    // Return updated list
    const { data: all } = await supabase.from("game_images").select("*");
    return NextResponse.json({ ok: true, images: toClient(all || []) });
  } catch (err: any) {
    console.error("Game image insert error:", err);
    return NextResponse.json({ ok: false, error: "Серверийн алдаа" }, { status: 500 });
  }
}

