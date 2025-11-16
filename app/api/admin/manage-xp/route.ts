import { NextResponse } from "next/server";
import { getSessionFromCookies } from "../../../../lib/session";
import { setExperience, addExperience, getUser } from "../../../../lib/users";

// POST: Manage student XP (teacher only)
export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  
  if (!session) {
    return NextResponse.json({ ok: false, error: "Нэвтэрнэ үү" }, { status: 401 });
  }

  if (session.role !== "teacher") {
    return NextResponse.json({ ok: false, error: "Зөвхөн багш XP удирдах эрхтэй" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const studentEmail = body.studentEmail?.trim();
  const action = body.action; // 'set' or 'add'
  const amount = parseInt(body.amount);

  if (!studentEmail) {
    return NextResponse.json({ ok: false, error: "Сурагчийн email оруулна уу" }, { status: 400 });
  }

  if (!action || (action !== 'set' && action !== 'add')) {
    return NextResponse.json({ ok: false, error: "Үйлдэл буруу байна (set эсвэл add)" }, { status: 400 });
  }

  if (isNaN(amount)) {
    return NextResponse.json({ ok: false, error: "XP дүн тоон утга байх ёстой" }, { status: 400 });
  }

  // Verify student exists
  const student = await getUser(studentEmail);
  if (!student) {
    return NextResponse.json({ ok: false, error: "Сурагч олдсонгүй" }, { status: 404 });
  }

  if (student.role !== "student") {
    return NextResponse.json({ ok: false, error: "Зөвхөн сурагчийн XP өөрчлөх боломжтой" }, { status: 400 });
  }

  let updatedUser;
  if (action === 'set') {
    updatedUser = await setExperience(studentEmail, amount);
  } else {
    updatedUser = await addExperience(studentEmail, amount);
  }

  if (!updatedUser) {
    return NextResponse.json({ ok: false, error: "XP өөрчлөхөд алдаа гарлаа" }, { status: 500 });
  }

  return NextResponse.json({ 
    ok: true, 
    user: {
      email: updatedUser.email,
      name: updatedUser.name,
      experience: updatedUser.experience,
    },
    message: action === 'set' 
      ? `${updatedUser.name || updatedUser.email}-н XP ${amount} болж өөрчлөгдлөө`
      : `${updatedUser.name || updatedUser.email}-д ${amount} XP нэмэгдлээ`
  });
}
