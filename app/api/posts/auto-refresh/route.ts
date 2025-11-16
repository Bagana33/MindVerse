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

// Системийн хэрэглэгчийн email
const SYSTEM_USER_EMAIL = "news-bot";

export async function POST(req: Request) {
  try {
    // Ensure news-bot user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', SYSTEM_USER_EMAIL)
      .single();

    if (!existingUser) {
      const { error: userError } = await supabase
        .from('users')
        .insert([{
          email: SYSTEM_USER_EMAIL,
          name: '📰 Мэдээ',
          role: 'teacher',
          experience: 0,
        }]);

      if (userError) {
        console.error("User creation error:", userError);
      }
    }

    // 24 цагаас хуучин постуудыг устгах
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { error: deleteError } = await supabase
      .from("posts")
      .delete()
      .eq("author_email", SYSTEM_USER_EMAIL)
      .lt("created_at", twentyFourHoursAgo);

    if (deleteError) {
      console.error("Delete error:", deleteError);
    }

    // ChatGPT-аас graphic design мэдээ үүсгэх
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "Та graphic design сурагчдад зориулсан дизайн, зураг зурах, өнгө, typography, UI/UX, брэнд дизайн гэх мэт сонирхолтой мэдээ, зөвлөмж өгдөг мэдээллийн бот юм. Монгол хэл дээр богино (2-3 өгүүлбэр), практик, хэрэгтэй мэдээлэл өг. Жишээ нь: дизайны зарчим, өнгөний хослол, шинэ trend, tool-ийн зөвлөмж гэх мэт.",
        },
        {
          role: "user",
          content: "Өнөөдөр graphic design-тай холбоотой ямар нэг сонирхолтой мэдээ эсвэл зөвлөмж өгнө үү?",
        },
      ],
      max_tokens: 200,
    });

    const newsContent = completion.choices[0].message.content;

    // DALL-E ашиглаж зураг үүсгэх
    let imageUrl = null;
    try {
      const imagePrompt = "A modern, minimalist graphic design illustration featuring vibrant gradients, geometric shapes, and creative typography. Abstract, professional, inspiring for designers. Neon colors, clean aesthetic.";
      
      const imageResponse = await openai.images.generate({
        model: "dall-e-3",
        prompt: imagePrompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
      });

      imageUrl = imageResponse.data[0].url;
    } catch (imageError) {
      console.error("Image generation error:", imageError);
      // Зураг үүсгэхэд алдаа гарсан ч мэдээ үүснэ
    }

    const postId = `post-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Шинэ пост үүсгэх
    const newPost = {
      id: postId,
      author_email: SYSTEM_USER_EMAIL,
      text: newsContent || "Өнөөдрийн дизайны мэдээ",
      image_data: imageUrl,
      created_at: new Date().toISOString(),
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
