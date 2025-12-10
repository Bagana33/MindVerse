import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "../../../../../lib/session";
import { submitToLesson } from "../../../../../lib/lessons";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
    }

    if (session.role !== "student") {
      return NextResponse.json({ error: "Зөвхөн сурагчид submission илгээх боломжтой" }, { status: 403 });
    }

    const params = await context.params;
    const { id: lessonId } = params;
    
    let body;
    try {
      body = await request.json();
    } catch (jsonError) {
      console.error('JSON parse error in lesson submit:', jsonError);
      return NextResponse.json({ error: "Invalid JSON format" }, { status: 400 });
    }

    const { fileUrl, fileUrls } = body;

    // Support both old format (fileUrl) and new format (fileUrls array)
    // If fileUrls is provided, use it; otherwise fall back to fileUrl as array
    const urls = fileUrls 
      ? (Array.isArray(fileUrls) ? fileUrls : [fileUrls])
      : (fileUrl ? [fileUrl] : undefined);

    // Validate: max 2 files
    if (urls && urls.length > 2) {
      return NextResponse.json({ error: "Зөвхөн 2 файл оруулах боломжтой" }, { status: 400 });
    }

    const submission = await submitToLesson(lessonId, session.email, session.name || session.email, urls);

    if (!submission) {
      return NextResponse.json({ error: "Илгээхэд алдаа гарлаа" }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      submission,
      message: "Амжилттай илгээлээ! Багш таны ажлыг шалгаад XP өгнө." 
    });
  } catch (error: any) {
    console.error("Submit lesson error:", error);
    return NextResponse.json({ 
      error: error.message || "Серверийн алдаа гарлаа",
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
