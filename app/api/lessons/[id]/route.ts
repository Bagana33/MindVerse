import { NextResponse } from "next/server";
import { getLesson, updateLesson, deleteLesson } from "../../../../lib/lessons";
import { getSessionFromCookies } from "../../../../lib/session";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const lesson = await getLesson(params.id);
  
  if (!lesson) {
    return NextResponse.json({ ok: false, error: "Хичээл олдсонгүй" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, lesson });
}

export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Нэвтэрнэ үү" }, { status: 401 });
  }

  if (session.role !== "teacher") {
    return NextResponse.json({ ok: false, error: "Зөвхөн багш хичээл засах эрхтэй" }, { status: 403 });
  }

  const params = await context.params;
  const body = await req.json().catch(() => ({}));

  const title = body?.title?.toString().trim();
  const description = body?.description?.toString().trim();
  const targetGrades = Array.isArray(body?.targetGrades) ? body.targetGrades : undefined;
  const questions = body?.questions;
  const files = body?.files;
  let sanitizedFiles: any[] | undefined = undefined;

  // Validate if provided
  if (title !== undefined && title.length < 1) {
    return NextResponse.json({ ok: false, error: "Гарчиг оруулна уу" }, { status: 400 });
  }

  if (description !== undefined && description.length < 1) {
    return NextResponse.json({ ok: false, error: "Тайлбар оруулна уу" }, { status: 400 });
  }

  if (questions !== undefined) {
    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ ok: false, error: "Хамгийн багадаа 1 асуулт оруулна уу" }, { status: 400 });
    }

    // Validate questions
    for (const q of questions) {
      if (!q.question || q.question.trim().length === 0) {
        return NextResponse.json({ ok: false, error: "Асуултын текст оруулна уу" }, { status: 400 });
      }
      if (!Array.isArray(q.options) || q.options.length < 2) {
        return NextResponse.json({ ok: false, error: "Хамгийн багадаа 2 хариулт оруулна уу" }, { status: 400 });
      }
      const hasEmptyOption = q.options.some((opt: string) => !opt || opt.trim().length === 0);
      if (hasEmptyOption) {
        return NextResponse.json({ ok: false, error: "Бүх хариултуудыг бөглөнө үү" }, { status: 400 });
      }
      if (typeof q.correctAnswer !== "number" || q.correctAnswer < 0 || q.correctAnswer >= q.options.length) {
        return NextResponse.json({ ok: false, error: "Зөв хариултыг сонгоно уу" }, { status: 400 });
      }
    }
  }

  // Validate files if provided
  if (files !== undefined) {
    if (!Array.isArray(files)) {
      return NextResponse.json({ ok: false, error: "Файлын формат буруу байна" }, { status: 400 });
    }
    sanitizedFiles = [];
    for (const [idx, file] of files.entries()) {
      if (!file?.fileName || !file?.fileUrl) {
        return NextResponse.json({ ok: false, error: "Файл буруу форматтай байна" }, { status: 400 });
      }
      if (file.fileSize && file.fileSize > 20 * 1024 * 1024) {
        return NextResponse.json({ ok: false, error: `Файл хэт том байна: ${file.fileName} (максимум 20MB)` }, { status: 400 });
      }
      sanitizedFiles.push({
        id: file.id || `file-${Date.now()}-${idx}`,
        fileName: file.fileName,
        fileType: file.fileType || 'application/octet-stream',
        fileUrl: file.fileUrl,
        fileSize: file.fileSize || 0,
      });
    }
  }

  // Build updates object
  const updates: any = {};
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (targetGrades !== undefined) updates.targetGrades = targetGrades;
  if (questions !== undefined) {
    updates.questions = questions.map((q: any, idx: number) => ({
      id: `q${idx + 1}`,
      question: q.question.trim(),
      options: q.options.map((opt: string) => opt.trim()),
      correctAnswer: q.correctAnswer,
      explanation: q.explanation?.trim() || undefined,
    }));
  }
  if (sanitizedFiles !== undefined) {
    updates.files = sanitizedFiles;
  }

  const updatedLesson = await updateLesson(params.id, session.email, updates);

  if (!updatedLesson) {
    return NextResponse.json({ ok: false, error: "Хичээл олдсонгүй эсвэл засах эрхгүй" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, lesson: updatedLesson });
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Нэвтэрнэ үү" }, { status: 401 });
  }

  if (session.role !== "teacher") {
    return NextResponse.json({ ok: false, error: "Зөвхөн багш хичээл устгах эрхтэй" }, { status: 403 });
  }

  const params = await context.params;
  const success = await deleteLesson(params.id, session.email);

  if (!success) {
    return NextResponse.json({ ok: false, error: "Хичээл олдсонгүй эсвэл устгах эрхгүй" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
