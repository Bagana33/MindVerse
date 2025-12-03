import { supabase } from './supabase';

export type LessonFile = {
  id: string;
  fileName: string;
  fileType: string;
  fileUrl: string;
  fileSize: number;
};

export type Question = {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
};

export type LessonSubmission = {
  id: string;
  lessonId: string;
  studentEmail: string;
  studentName: string;
  fileUrl?: string;
  submittedAt: string;
  score?: number;
  feedback?: string;
  rewardXP?: number;
  gradedAt?: string;
};

export type Lesson = {
  id: string;
  title: string;
  description: string;
  authorEmail: string;
  authorName: string;
  published: boolean;
  targetGrades: string[]; // ["10", "11", "12"] or [] for all grades
  questions: Question[];
  files: LessonFile[];
  submissions: LessonSubmission[];
  createdAt: string;
  updatedAt: string;
};

function dbToLesson(dbRow: any, questions: Question[] = [], files: LessonFile[] = [], submissions: LessonSubmission[] = []): Lesson {
  return {
    id: dbRow.id,
    title: dbRow.title,
    description: dbRow.description,
    authorEmail: dbRow.author_email,
    authorName: dbRow.author_name,
    published: dbRow.published ?? true,
    targetGrades: Array.isArray(dbRow.target_grades) ? dbRow.target_grades : [],
    questions: Array.isArray(questions) ? questions : [],
    files: Array.isArray(files) ? files : [],
    submissions: Array.isArray(submissions) ? submissions : [],
    createdAt: dbRow.created_at,
    updatedAt: dbRow.updated_at,
  };
}

function dbToQuestion(dbRow: any): Question {
  return {
    id: dbRow.id,
    question: dbRow.question,
    options: dbRow.options || [],
    correctAnswer: dbRow.correct_answer,
    explanation: dbRow.explanation,
  };
}

function dbToFile(dbRow: any): LessonFile {
  return {
    id: dbRow.id,
    fileName: dbRow.file_name,
    fileType: dbRow.file_type,
    fileUrl: dbRow.file_url,
    fileSize: dbRow.file_size || 0,
  };
}

function dbToSubmission(dbRow: any): LessonSubmission {
  return {
    id: dbRow.id,
    lessonId: dbRow.lesson_id,
    studentEmail: dbRow.student_email,
    studentName: dbRow.student_name,
    fileUrl: dbRow.file_url,
    submittedAt: dbRow.submitted_at,
    score: dbRow.score,
    feedback: dbRow.feedback,
    rewardXP: dbRow.reward_xp,
    gradedAt: dbRow.graded_at,
  };
}

export async function createLesson(data: Omit<Lesson, "id" | "createdAt" | "updatedAt" | "submissions">): Promise<Lesson> {
  const lessonId = `lesson-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const { data: lessonData, error: lessonError } = await supabase
    .from('lessons')
    .insert([{
      id: lessonId,
      title: data.title,
      description: data.description,
      author_email: data.authorEmail,
      author_name: data.authorName,
      published: data.published ?? true,
      target_grades: data.targetGrades || [],
    }])
    .select()
    .single();

  if (lessonError || !lessonData) {
    throw lessonError || new Error('Failed to create lesson');
  }

  if (data.questions && data.questions.length > 0) {
    await supabase.from('lesson_questions').insert(
      data.questions.map((q, idx) => ({
        id: `${lessonId}-q${idx + 1}`,
        lesson_id: lessonId,
        question: q.question,
        options: q.options,
        correct_answer: q.correctAnswer,
        explanation: q.explanation,
        order_index: idx,
      }))
    );
  }

  if (data.files && data.files.length > 0) {
    await supabase.from('lesson_files').insert(
      data.files.map(f => ({
        id: f.id || `${lessonId}-file-${Date.now()}`,
        lesson_id: lessonId,
        file_name: f.fileName,
        file_type: f.fileType,
        file_url: f.fileUrl,
        file_size: f.fileSize || 0,
      }))
    );
  }

  return dbToLesson(lessonData, data.questions, data.files, []);
}

export async function getAllLessons(includeUnpublished: boolean = false): Promise<Lesson[]> {
  let query = supabase
    .from('lessons')
    .select('*')
    .order('created_at', { ascending: false });

  if (!includeUnpublished) {
    query = query.eq('published', true);
  }

  const { data: lessonsData, error } = await query;
  if (error || !lessonsData) return [];

  const lessons = await Promise.all(
    lessonsData.map(async (lessonRow) => {
      const [q, f, s] = await Promise.all([
        supabase.from('lesson_questions').select('*').eq('lesson_id', lessonRow.id).order('order_index'),
        supabase.from('lesson_files').select('*').eq('lesson_id', lessonRow.id),
        supabase.from('lesson_submissions').select('*').eq('lesson_id', lessonRow.id).order('submitted_at', { ascending: false }),
      ]);

      return dbToLesson(
        lessonRow,
        (q.data || []).map(dbToQuestion),
        (f.data || []).map(dbToFile),
        (s.data || []).map(dbToSubmission)
      );
    })
  );

  return lessons;
}

export async function getLesson(id: string): Promise<Lesson | null> {
  const { data: lessonData, error } = await supabase
    .from('lessons')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !lessonData) return null;

  const [q, f, s] = await Promise.all([
    supabase.from('lesson_questions').select('*').eq('lesson_id', id).order('order_index'),
    supabase.from('lesson_files').select('*').eq('lesson_id', id),
    supabase.from('lesson_submissions').select('*').eq('lesson_id', id).order('submitted_at', { ascending: false }),
  ]);

  return dbToLesson(
    lessonData,
    (q.data || []).map(dbToQuestion),
    (f.data || []).map(dbToFile),
    (s.data || []).map(dbToSubmission)
  );
}

export async function updateLesson(
  id: string,
  userEmail: string,
  updates: {
    title?: string;
    description?: string;
    targetGrades?: string[];
    questions?: Question[];
    files?: LessonFile[];
  }
): Promise<Lesson | null> {
  // Verify ownership
  const existingLesson = await getLesson(id);
  if (!existingLesson || existingLesson.authorEmail !== userEmail) {
    return null;
  }

  // Update lesson metadata
  const lessonUpdate: any = {};
  if (updates.title !== undefined) lessonUpdate.title = updates.title;
  if (updates.description !== undefined) lessonUpdate.description = updates.description;
  if (updates.targetGrades !== undefined) lessonUpdate.target_grades = updates.targetGrades;

  if (Object.keys(lessonUpdate).length > 0) {
    const { error: lessonError } = await supabase
      .from('lessons')
      .update(lessonUpdate)
      .eq('id', id);

    if (lessonError) {
      throw lessonError;
    }
  }

  // Update questions if provided
  if (updates.questions !== undefined) {
    // Delete existing questions
    await supabase.from('lesson_questions').delete().eq('lesson_id', id);

    // Insert new questions
    if (updates.questions.length > 0) {
      await supabase.from('lesson_questions').insert(
        updates.questions.map((q, idx) => ({
          id: `${id}-q${idx + 1}`,
          lesson_id: id,
          question: q.question,
          options: q.options,
          correct_answer: q.correctAnswer,
          explanation: q.explanation,
          order_index: idx,
        }))
      );
    }
  }

  // Update files if provided
  if (updates.files !== undefined) {
    // Delete existing files
    await supabase.from('lesson_files').delete().eq('lesson_id', id);

    // Insert new files
    if (updates.files.length > 0) {
      await supabase.from('lesson_files').insert(
        updates.files.map(f => ({
          id: f.id || `${id}-file-${Date.now()}`,
          lesson_id: id,
          file_name: f.fileName,
          file_type: f.fileType,
          file_url: f.fileUrl,
          file_size: f.fileSize || 0,
        }))
      );
    }
  }

  // Return updated lesson
  return await getLesson(id);
}

export async function deleteLesson(id: string, userEmail: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('lessons')
    .delete()
    .eq('id', id)
    .eq('author_email', userEmail)
    .select();

  return !error && data && data.length > 0;
}

export async function submitToLesson(
  lessonId: string,
  studentEmail: string,
  studentName: string,
  fileUrl?: string
): Promise<LessonSubmission | null> {
  // Check if submission already exists
  const { data: existing } = await supabase
    .from('lesson_submissions')
    .select('*')
    .eq('lesson_id', lessonId)
    .eq('student_email', studentEmail)
    .single();

  let submissionId: string;
  let data: any;
  let error: any;

  if (existing) {
    // Update existing submission (resubmission)
    submissionId = existing.id;
    const { data: updated, error: updateError } = await supabase
      .from('lesson_submissions')
      .update({
        file_url: fileUrl,
        student_name: studentName,
        submitted_at: new Date().toISOString(),
        // Reset grading when resubmitting
        score: null,
        feedback: null,
        reward_xp: null,
        graded_at: null,
      })
      .eq('id', submissionId)
      .select()
      .single();
    
    data = updated;
    error = updateError;
  } else {
    // Create new submission
    submissionId = `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const { data: inserted, error: insertError } = await supabase
      .from('lesson_submissions')
      .insert([{
        id: submissionId,
        lesson_id: lessonId,
        student_email: studentEmail,
        student_name: studentName,
        file_url: fileUrl,
      }])
      .select()
      .single();
    
    data = inserted;
    error = insertError;
  }

  if (error || !data) return null;

  return dbToSubmission(data);
}

export async function gradeSubmission(
  lessonId: string,
  submissionId: string,
  score: number,
  rewardXP: number,
  feedback?: string
): Promise<LessonSubmission | null> {
  const { data, error } = await supabase
    .from('lesson_submissions')
    .update({
      score,
      reward_xp: rewardXP,
      feedback,
      graded_at: new Date().toISOString(),
    })
    .eq('id', submissionId)
    .eq('lesson_id', lessonId)
    .select()
    .single();

  if (error || !data) return null;

  return dbToSubmission(data);
}

export async function getSubmission(lessonId: string, studentEmail: string): Promise<LessonSubmission | null> {
  const { data, error } = await supabase
    .from('lesson_submissions')
    .select('*')
    .eq('lesson_id', lessonId)
    .eq('student_email', studentEmail)
    .single();

  if (error || !data) return null;

  return dbToSubmission(data);
}
