import { NextResponse } from "next/server";
import { getLesson } from "../../../../lib/lessons";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const lesson = getLesson(params.id);
  
  if (!lesson) {
    return NextResponse.json({ ok: false, error: "Хичээл олдсонгүй" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, lesson });
}
