import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Системийн хэрэглэгчийн ID (мэдээллийн постууд)
const SYSTEM_USER_ID = "news-bot";

export async function POST(req: Request) {
  try {
    // 24 цагаас хуучин постуудыг устгах
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { error: deleteError } = await supabase
      .from("posts")
      .delete()
      .eq("authorId", SYSTEM_USER_ID)
      .lt("createdAt", twentyFourHoursAgo);

    if (deleteError) {
      console.error("Delete error:", deleteError);
    }

    // ChatGPT-аас шинэ мэдээ үүсгэх
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "Та сурагчдад зориулсан технологи, программчлал, эсвэл шинжлэх ухааны сонирхолтой мэдээллийг монгол хэл дээр өгдөг мэдээллийн бот юм. Богино (2-3 өгүүлбэр), тодорхой, сонирхолтой мэдээлэл өг.",
        },
        {
          role: "user",
          content: "Өнөөдрийн технологи эсвэл програмчлалын сонирхолтой мэдээ өгнө үү?",
        },
      ],
      max_tokens: 150,
    });

    const newsContent = completion.choices[0].message.content;

    // Шинэ пост үүсгэх
    const newPost = {
      authorId: SYSTEM_USER_ID,
      content: newsContent || "Өнөөдрийн технологийн мэдээ",
      imageUrl: null,
      createdAt: new Date().toISOString(),
    };

    const { data, error: insertError } = await supabase
      .from("posts")
      .insert([newPost])
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({
      success: true,
      message: "Мэдээ шинэчлэгдлээ",
      post: data,
    });
  } catch (error) {
    console.error("Auto-refresh error:", error);
    return NextResponse.json(
      { error: "Мэдээ шинэчлэхэд алдаа гарлаа" },
      { status: 500 }
    );
  }
}
