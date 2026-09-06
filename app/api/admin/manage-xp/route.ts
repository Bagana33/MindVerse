import { NextResponse } from "next/server";
import { getSessionFromCookies } from "../../../../lib/session";
import { setExperience, addExperience, getUser } from "../../../../lib/users";
import { supabase } from "../../../../lib/supabase";
import { invalidateServerCache } from "../../../../lib/serverCache";

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
  const applyToAll = Boolean(body.applyToAll);
  const targetGrade = typeof body.targetGrade === "string" && body.targetGrade.trim() !== "" ? body.targetGrade.trim() : null;

  if (!applyToAll && !studentEmail) {
    return NextResponse.json({ ok: false, error: "Сурагчийн email оруулна уу" }, { status: 400 });
  }

  if (!action || (action !== 'set' && action !== 'add')) {
    return NextResponse.json({ ok: false, error: "Үйлдэл буруу байна (set эсвэл add)" }, { status: 400 });
  }

  if (isNaN(amount)) {
    return NextResponse.json({ ok: false, error: "XP дүн тоон утга байх ёстой" }, { status: 400 });
  }

  // Bulk update (all students, optionally filtered by grade)
  if (applyToAll) {
    let listQuery = supabase
      .from("users")
      .select("email,name,experience,role,grade")
      .eq("role", "student");

    if (targetGrade) {
      listQuery = listQuery.eq("grade", targetGrade);
    }

    const { data: students, error: listError } = await listQuery;

    if (listError) {
      console.error("Failed to fetch students for bulk XP update:", listError);
      return NextResponse.json({ ok: false, error: "Сурагчдын жагсаалтыг авахад алдаа гарлаа" }, { status: 500 });
    }

    if (!students || students.length === 0) {
      return NextResponse.json({ ok: false, error: "Сурагч олдсонгүй" }, { status: 404 });
    }

    // Set exact XP for all students
    if (action === "set") {
      let updateQuery = supabase
        .from("users")
        .update({ experience: Math.max(0, amount) })
        .eq("role", "student");

      if (targetGrade) {
        updateQuery = updateQuery.eq("grade", targetGrade);
      }

      const { data: updated, error: bulkError } = await updateQuery.select("email");

      if (bulkError) {
        console.error("Bulk set XP failed:", bulkError);
        return NextResponse.json({ ok: false, error: "XP өөрчлөхөд алдаа гарлаа" }, { status: 500 });
      }

      const affected = updated?.length || 0;
      invalidateServerCache('leaderboard');
      invalidateServerCache('user_db');
      invalidateServerCache('user_info');

      return NextResponse.json({
        ok: true,
        count: affected,
        message: `${targetGrade ? `${targetGrade} ангийн` : "Бүх"} ${affected} сурагчдын XP ${Math.max(0, amount)} болж шинэчлэгдлээ`,
      });
    }

    // Add XP for all students individually to preserve current values
    const updateResults = await Promise.allSettled(
      students.map((student) => {
        const nextXP = Math.max(0, (student.experience || 0) + amount);
        return supabase
          .from("users")
          .update({ experience: nextXP })
          .eq("email", student.email)
          .select("email")
          .single();
      })
    );

    const updatedCount = updateResults.reduce((count, result) => {
      if (result.status === "fulfilled" && !result.value.error) {
        return count + 1;
      }
      if (result.status === "fulfilled" && result.value.error) {
        console.error("Failed to update XP for student:", result.value.error);
      }
      if (result.status === "rejected") {
        console.error("XP update promise rejected:", result.reason);
      }
      return count;
    }, 0);

    if (updatedCount === 0) {
      return NextResponse.json({ ok: false, error: "XP өөрчлөхөд алдаа гарлаа" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      count: updatedCount,
      message: `${targetGrade ? `${targetGrade} ангийн` : "Бүх"} ${updatedCount} сурагчдад ${amount} XP нэмэгдлээ`,
    });
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
