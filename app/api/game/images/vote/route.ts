import { NextResponse } from "next/server";
import { getSessionFromCookies } from "../../../../../lib/session";
import { supabase } from "../../../../../lib/supabase";

async function toClient(images: any[]) {
  // Get all unique user emails
  const userEmails = new Set<string>();
  images.forEach(img => {
    if (img.added_by) userEmails.add(img.added_by);
  });

  // Fetch user info for all emails
  const userInfoMap = new Map<string, { name?: string; nickname?: string }>();
  if (userEmails.size > 0) {
    try {
      const { getUser } = await import("../../../../../lib/users");
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
    .sort((a, b) => b.score - a.score || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Нэвтэрнэ үү" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, vote } = body; // vote: "like" | "dislike"
    if (!id || !["like", "dislike"].includes(vote)) {
      return NextResponse.json({ ok: false, error: "Буруу өгөгдөл" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("game_images")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      // If table doesn't exist, return error with helpful message
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json({ 
          ok: false, 
          error: "Game table үүсээгүй байна. Supabase дээр migration ажиллуулна уу." 
        }, { status: 500 });
      }
      return NextResponse.json({ ok: false, error: "Зураг олдсонгүй" }, { status: 404 });
    }
    
    if (!data) {
      return NextResponse.json({ ok: false, error: "Зураг олдсонгүй" }, { status: 404 });
    }

    const liked = new Set<string>(data.liked_by || []);
    const disliked = new Set<string>(data.disliked_by || []);

    const user = session.email;
    // Toggle logic
    if (vote === "like") {
      if (liked.has(user)) {
        liked.delete(user);
      } else {
        liked.add(user);
        disliked.delete(user);
      }
    } else {
      if (disliked.has(user)) {
        disliked.delete(user);
      } else {
        disliked.add(user);
        liked.delete(user);
      }
    }

    const { error: updateError } = await supabase
      .from("game_images")
      .update({
        liked_by: Array.from(liked),
        disliked_by: Array.from(disliked),
      })
      .eq("id", id);

    if (updateError) {
      // If table doesn't exist, return error with helpful message
      if (updateError.code === '42P01' || updateError.message?.includes('does not exist')) {
        return NextResponse.json({ 
          ok: false, 
          error: "Game table үүсээгүй байна. Supabase дээр migration ажиллуулна уу." 
        }, { status: 500 });
      }
      console.error("Vote update error:", updateError);
      return NextResponse.json({ ok: false, error: "Санал өгөхөд алдаа" }, { status: 500 });
    }

    const { data: all, error: fetchError } = await supabase.from("game_images").select("*");
    if (fetchError) {
      console.error("Fetch all images error:", fetchError);
      return NextResponse.json({ ok: false, error: "Зургуудыг авахад алдаа" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, images: await toClient(all || []) });
  } catch (err: any) {
    console.error("Vote error:", err);
    return NextResponse.json({ ok: false, error: "Серверийн алдаа" }, { status: 500 });
  }
}

