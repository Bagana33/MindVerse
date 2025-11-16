import { NextResponse } from "next/server";
import { getSessionFromCookies } from "../../../lib/session";
import { createLesson, getAllLessons } from "../../../lib/lessons";
import { addNotification } from "../../../lib/notifications";
import { getAllUsers } from "../../../lib/users";

// GET: Fetch all lessons
export async function GET() {
  const session = await getSessionFromCookies();
  
  // Fetch all lessons
  const allLessons = await getAllLessons(true);
  
  // Filter lessons based on student grade
  let lessons = allLessons;
  if (session && session.role === "student") {
    // Get user's grade
    const { getUser } = await import("../../../lib/users");
    const user = await getUser(session.email);
    const userGrade = user?.grade;
    
    // Filter: show lessons with matching grade or no target grades (all grades)
    lessons = allLessons.filter(lesson => {
      if (!lesson.targetGrades || lesson.targetGrades.length === 0) {
        return true; // Show to all grades
      }
      if (!userGrade) {
        return false; // Student has no grade set
      }
      return lesson.targetGrades.includes(userGrade);
    });
  }
  
  return NextResponse.json({ ok: true, lessons });
}

// POST: Create a new lesson (requires teacher authentication)
export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Нэвтэрнэ үү" }, { status: 401 });
  }

  if (session.role !== "teacher") {
    return NextResponse.json({ ok: false, error: "Зөвхөн багш хичээл үүсгэх эрхтэй" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const title = (body?.title ?? "").toString().trim();
  const description = (body?.description ?? "").toString().trim();
  const targetGrades = Array.isArray(body?.targetGrades) ? body.targetGrades : [];
  const questions = body?.questions || [];
  const files = body?.files || [];

  if (!title || title.length < 1) {
    return NextResponse.json(
      { ok: false, error: "Гарчиг оруулна уу" },
      { status: 400 }
    );
  }

  if (!description || description.length < 1) {
    return NextResponse.json(
      { ok: false, error: "Тайлбар оруулна уу" },
      { status: 400 }
    );
  }

  if (!Array.isArray(questions) || questions.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Хамгийн багадаа 1 асуулт оруулна уу" },
      { status: 400 }
    );
  }

  // Validate questions
  for (const q of questions) {
    if (!q.question || q.question.trim().length === 0) {
      return NextResponse.json(
        { ok: false, error: "Асуултын текст оруулна уу" },
        { status: 400 }
      );
    }
    if (!Array.isArray(q.options) || q.options.length < 2) {
      return NextResponse.json(
        { ok: false, error: "Хамгийн багадаа 2 хариулт оруулна уу" },
        { status: 400 }
      );
    }
    // Check if all options have text
    const hasEmptyOption = q.options.some((opt: string) => !opt || opt.trim().length === 0);
    if (hasEmptyOption) {
      return NextResponse.json(
        { ok: false, error: "Бүх хариултуудыг бөглөнө үү" },
        { status: 400 }
      );
    }
    if (typeof q.correctAnswer !== "number" || q.correctAnswer < 0 || q.correctAnswer >= q.options.length) {
      return NextResponse.json(
        { ok: false, error: "Зөв хариултыг сонгоно уу" },
        { status: 400 }
      );
    }
  }

  // Validate files if provided
  if (Array.isArray(files)) {
    for (const file of files) {
      if (!file.fileName || !file.fileType || !file.fileUrl) {
        return NextResponse.json(
          { ok: false, error: "Файл буруу форматтай байна" },
          { status: 400 }
        );
      }
      // Check file size (max 20MB for demo)
      if (file.fileSize && file.fileSize > 20 * 1024 * 1024) {
        return NextResponse.json(
          { ok: false, error: `Файл хэт том байна: ${file.fileName} (максимум 20MB)` },
          { status: 400 }
        );
      }
    }
  }

  const newLesson = await createLesson({
    title,
    description,
    authorEmail: session.email,
    authorName: session.name || session.email,
    published: true, // Багш үүсгэсэн хичээл автоматаар нийтлэгдсэн
    targetGrades,
    questions: questions.map((q: any, idx: number) => ({
      id: `q${idx + 1}`,
      question: q.question.trim(),
      options: q.options.map((opt: string) => opt.trim()),
      correctAnswer: q.correctAnswer,
      explanation: q.explanation?.trim() || undefined,
    })),
    files: files.map((f: any, idx: number) => ({
      id: `file-${Date.now()}-${idx}`,
      fileName: f.fileName,
      fileType: f.fileType,
      fileUrl: f.fileUrl,
      fileSize: f.fileSize || 0,
    })),
  });

  // Send notification to all students about new lesson
  try {
    const allUsers = await getAllUsers();
    const students = allUsers.filter(u => u.role === 'student');
    const notifications = students.map(student => 
      addNotification(
        student.email,
        session.email,
        'GRADE',
        `📚 Шинэ хичээл: ${title} - ${session.name || session.email} багш`
      )
    );
    await Promise.allSettled(notifications);
  } catch (e) {
    console.error('Failed to send lesson notifications:', e);
  }

  return NextResponse.json({ ok: true, lesson: newLesson });
}
