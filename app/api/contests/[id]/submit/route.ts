import { NextResponse } from "next/server";
import { getSessionFromCookies } from "../../../../../lib/session";
import { submitToContest, getContest } from "../../../../../lib/contests";
import { addExperience } from "../../../../../lib/users";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Нэвтэрнэ үү" }, { status: 401 });
  }

  if (session.role !== "student") {
    return NextResponse.json({ ok: false, error: "Зөвхөн сурагч оролцох боломжтой" }, { status: 403 });
  }

  const params = await context.params;
  const contest = getContest(params.id);
  
  if (!contest) {
    return NextResponse.json({ ok: false, error: "Уралдаан олдсонгүй" }, { status: 404 });
  }

  if (contest.status !== "active") {
    return NextResponse.json({ ok: false, error: "Уралдаан идэвхтэй биш байна" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const title = (body?.title ?? "").toString().trim();
  const description = (body?.description ?? "").toString().trim();
  const imageUrl = body?.imageUrl || "";

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

  const submission = submitToContest(params.id, {
    userEmail: session.email,
    userName: session.name || session.email,
    title,
    description,
    imageUrl,
  });

  if (!submission) {
    return NextResponse.json(
      { ok: false, error: "Та аль хэдийн оролцсон байна" },
      { status: 400 }
    );
  }

  // Give 20 XP for participating
  await addExperience(session.email, 20);

  return NextResponse.json({ ok: true, submission });
}
