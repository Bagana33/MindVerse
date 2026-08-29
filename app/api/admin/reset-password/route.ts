import { NextResponse } from "next/server";
import { getSessionFromCookies } from "../../../../lib/session";
import { resetUserPassword, getUser } from "../../../../lib/users";

export async function POST(req: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session || session.role !== "teacher") {
      return NextResponse.json({ ok: false, error: "Зөвхөн багш хандах эрхтэй" }, { status: 403 });
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "Буруу форматтай хүсэлт" }, { status: 400 });
    }

    const studentEmail = (body?.studentEmail ?? "").toString().trim().toLowerCase();
    const newPassword = (body?.newPassword ?? "").toString().trim();

    if (!studentEmail) {
      return NextResponse.json({ ok: false, error: "Сурагчийн имэйл шаардлагатай" }, { status: 400 });
    }

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { ok: false, error: "Шинэ нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой" },
        { status: 400 }
      );
    }

    const student = await getUser(studentEmail);
    if (!student) {
      return NextResponse.json({ ok: false, error: "Сурагч олдсонгүй" }, { status: 404 });
    }

    await resetUserPassword(studentEmail, newPassword);

    return NextResponse.json({
      ok: true,
      message: `"${student.name || studentEmail}" сурагчийн нууц үг амжилттай шинэчлэгдлээ.`,
    });
  } catch (error: any) {
    console.error("Admin reset password error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Серверийн алдаа гарлаа" },
      { status: 500 }
    );
  }
}
