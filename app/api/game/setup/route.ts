import { NextResponse } from "next/server";
import { getSessionFromCookies } from "../../../../lib/session";
import { supabase } from "../../../../lib/supabase";
import { getLesson } from "../../../../lib/lessons";
import { getAllUsers } from "../../../../lib/users";

// POST: Setup game with lesson and grade (teacher only)
export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Нэвтэрнэ үү" }, { status: 401 });
  }

  if (session.role !== "teacher") {
    return NextResponse.json({ ok: false, error: "Зөвхөн багш тоглоом тохируулах эрхтэй" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { lessonId, targetGrade } = body;

    if (!lessonId) {
      return NextResponse.json({ ok: false, error: "Хичээл сонгоно уу" }, { status: 400 });
    }

    // Verify lesson exists
    const lesson = await getLesson(lessonId);
    if (!lesson) {
      return NextResponse.json({ ok: false, error: "Хичээл олдсонгүй" }, { status: 404 });
    }

    // Get all students for the selected grade
    const allUsers = await getAllUsers();
    const studentsInGrade = targetGrade
      ? allUsers.filter(u => u.role === "student" && u.grade === targetGrade)
      : allUsers.filter(u => u.role === "student");

    // Get submissions for this lesson
    const { data: allSubmissions, error: submissionsError } = await supabase
      .from("lesson_submissions")
      .select("*")
      .eq("lesson_id", lessonId)
      .order("submitted_at", { ascending: false });

    if (submissionsError) {
      console.error("Error fetching submissions:", submissionsError);
      return NextResponse.json({ ok: false, error: "Даалгаврын ажлуудыг авахад алдаа" }, { status: 500 });
    }

    // Filter submissions by student grade
    const studentEmails = new Set(studentsInGrade.map(s => s.email));
    const filteredSubmissions = (allSubmissions || []).filter(sub => 
      studentEmails.has(sub.student_email)
    );

    // Clear existing game_images for this game
    await supabase.from("game_images").delete().neq("id", ""); // Delete all

    // Create game_images entries for each submission
    const gameImages = [];
    for (const submission of filteredSubmissions) {
      // Get all file URLs from submission
      let fileUrls: string[] = [];
      if (submission.file_urls) {
        // Handle JSONB array from Supabase
        if (Array.isArray(submission.file_urls)) {
          fileUrls = submission.file_urls;
        } else if (typeof submission.file_urls === 'string') {
          try {
            const parsed = JSON.parse(submission.file_urls);
            fileUrls = Array.isArray(parsed) ? parsed : [parsed];
          } catch {
            fileUrls = [];
          }
        } else if (typeof submission.file_urls === 'object') {
          // Handle JSONB object (Supabase might return it as object)
          fileUrls = Array.isArray(submission.file_urls) ? submission.file_urls : [];
        }
      } else if (submission.file_url) {
        fileUrls = [submission.file_url];
      }
      
      if (fileUrls.length > 0) {
        const gameImageId = `game-img-${submission.id}`;
        
        // Prepare upsert data - only include image_urls if column exists
        const upsertData: any = {
          id: gameImageId,
          image_url: fileUrls[0], // Keep for backward compatibility
          added_by: submission.student_email,
          submission_id: submission.id,
          liked_by: [],
        };
        
        // Add image_urls if we have multiple files
        if (fileUrls.length > 0) {
          upsertData.image_urls = fileUrls;
        }
        
        const { error: insertError } = await supabase
          .from("game_images")
          .upsert(upsertData, {
            onConflict: "id"
          });

        if (insertError) {
          console.error(`Error upserting game image ${gameImageId}:`, insertError);
          // If image_urls column doesn't exist, try without it
          if (insertError.message?.includes('image_urls') || insertError.code === '42703') {
            const { error: retryError } = await supabase
              .from("game_images")
              .upsert({
                id: gameImageId,
                image_url: fileUrls[0],
                added_by: submission.student_email,
                submission_id: submission.id,
                liked_by: [],
              }, {
                onConflict: "id"
              });
            if (!retryError) {
              console.log(`Game image ${gameImageId} added without image_urls (migration may not be run)`);
            }
          }
        } else {
          gameImages.push({
            id: gameImageId,
            image_url: fileUrls[0],
            image_urls: fileUrls,
            added_by: submission.student_email,
            submission_id: submission.id,
          });
        }
      }
    }

    // Update game state
    const { error: stateError } = await supabase
      .from("game_state")
      .upsert({
        id: "game-state",
        lesson_id: lessonId,
        target_grade: targetGrade || null,
        ended: false,
        winner_email: null,
        winner_submission_id: null,
        ended_at: null,
        ended_by: null,
      }, {
        onConflict: "id"
      });

    if (stateError) {
      console.error("Error updating game state:", stateError);
    }

    return NextResponse.json({
      ok: true,
      message: `${filteredSubmissions.length} ажил олдлоо`,
      count: filteredSubmissions.length,
    });
  } catch (err: any) {
    console.error("Setup game error:", err);
    return NextResponse.json({ ok: false, error: "Серверийн алдаа" }, { status: 500 });
  }
}

