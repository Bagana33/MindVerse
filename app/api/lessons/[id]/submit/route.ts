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

    const { fileUrl } = body;

    const submission = await submitToLesson(lessonId, session.email, session.name || session.email, fileUrl);

    if (!submission) {
      return NextResponse.json({ error: "Та аль хэдийн submission илгээсэн байна" }, { status: 400 });
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
