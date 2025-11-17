import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "../../../../lib/session";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function DELETE(request: NextRequest) {
  const session = await getSessionFromCookies();
  
  // Only teachers can delete students
  if (!session || session.role !== "teacher") {
    return NextResponse.json({ error: "Зөвхөн багш устгах эрхтэй" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { studentEmail } = body;

    if (!studentEmail) {
      return NextResponse.json({ error: "Сурагчийн email шаардлагатай" }, { status: 400 });
    }

    // Verify the user exists and is a student
    const { data: userData, error: userCheckError } = await supabase
      .from('users')
      .select('role, email')
      .eq('email', studentEmail)
      .single();

    if (userCheckError || !userData) {
      return NextResponse.json({ error: "Сурагч олдсонгүй" }, { status: 404 });
    }

    if (userData.role !== 'student') {
      return NextResponse.json({ error: "Зөвхөн сурагчийг устгах боломжтой" }, { status: 400 });
    }

    // Delete in order (due to foreign key constraints):
    // 1. Comments by this student
    const { error: commentsError } = await supabase
      .from('comments')
      .delete()
      .eq('author_email', studentEmail);

    if (commentsError) {
      console.error("Error deleting comments:", commentsError);
    }

    // 2. Reactions by this student
    const { error: reactionsError } = await supabase
      .from('reactions')
      .delete()
      .eq('user_email', studentEmail);

    if (reactionsError) {
      console.error("Error deleting reactions:", reactionsError);
    }

    // 3. Notifications to/from this student
    const { error: notificationsError } = await supabase
      .from('notifications')
      .delete()
      .or(`recipient_email.eq.${studentEmail},sender_email.eq.${studentEmail}`);

    if (notificationsError) {
      console.error("Error deleting notifications:", notificationsError);
    }

    // 4. Contest submissions by this student
    const { error: submissionsError } = await supabase
      .from('contest_submissions')
      .delete()
      .eq('student_email', studentEmail);

    if (submissionsError) {
      console.error("Error deleting contest submissions:", submissionsError);
    }

    // 5. Lesson submissions by this student
    const { error: lessonSubmissionsError } = await supabase
      .from('lesson_submissions')
      .delete()
      .eq('student_email', studentEmail);

    if (lessonSubmissionsError) {
      console.error("Error deleting lesson submissions:", lessonSubmissionsError);
    }

    // 6. Posts by this student
    const { error: postsError } = await supabase
      .from('posts')
      .delete()
      .eq('author_email', studentEmail);

    if (postsError) {
      console.error("Error deleting posts:", postsError);
    }

    // 7. Finally, delete the user
    const { error: userDeleteError } = await supabase
      .from('users')
      .delete()
      .eq('email', studentEmail);

    if (userDeleteError) {
      console.error("Error deleting user:", userDeleteError);
      return NextResponse.json(
        { error: "Сурагчийг устгахад алдаа гарлаа" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${studentEmail} амжилттай устгагдлаа`,
    });

  } catch (error: any) {
    console.error("Delete student error:", error);
    return NextResponse.json(
      { error: "Серверийн алдаа гарлаа" },
      { status: 500 }
    );
  }
}
