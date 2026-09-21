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
  fileUrl?: string; // Keep for backward compatibility
  fileUrls?: string[]; // New: array of file URLs (up to 2)
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
  targetGrades: string[]; // ["9", "10", "11", "12"] or [] for all grades
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
  // Handle both old file_url and new file_urls
  const fileUrls = dbRow.file_urls 
    ? (Array.isArray(dbRow.file_urls) ? dbRow.file_urls : JSON.parse(dbRow.file_urls))
    : (dbRow.file_url ? [dbRow.file_url] : undefined);
  
  return {
    id: dbRow.id,
    lessonId: dbRow.lesson_id,
    studentEmail: dbRow.student_email,
    studentName: dbRow.student_name,
    fileUrl: dbRow.file_url, // Keep for backward compatibility
    fileUrls: fileUrls, // New array format
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

export async function getAllLessons(includeUnpublished: boolean = false, signal: AbortSignal = AbortSignal.timeout(10_000)): Promise<Lesson[]> {
  let query = supabase
    .from('lessons')
    .select('*')
    .order('created_at', { ascending: false })
    .abortSignal(signal);

  if (!includeUnpublished) {
    query = query.eq('published', true);
  }

  const { data: lessonsData, error } = await query;
  if (error) throw error;
  if (!lessonsData || lessonsData.length === 0) return [];

  const lessonIds = lessonsData.map((l: any) => l.id);

  // Execute 2 fast batch queries in parallel for ALL lessons combined (instead of N*3 queries)
  const [questionsRes, filesRes] = await Promise.all([
    supabase.from('lesson_questions').select('*').in('lesson_id', lessonIds).order('order_index').abortSignal(signal),
    supabase.from('lesson_files').select('*').in('lesson_id', lessonIds).abortSignal(signal),
  ]);
  if (questionsRes.error) throw questionsRes.error;
  if (filesRes.error) throw filesRes.error;

  const questionsByLesson = new Map<string, Question[]>();
  for (const q of (questionsRes.data || [])) {
    if (!questionsByLesson.has(q.lesson_id)) {
      questionsByLesson.set(q.lesson_id, []);
    }
    questionsByLesson.get(q.lesson_id)!.push(dbToQuestion(q));
  }

  const filesByLesson = new Map<string, LessonFile[]>();
  for (const f of (filesRes.data || [])) {
    if (!filesByLesson.has(f.lesson_id)) {
      filesByLesson.set(f.lesson_id, []);
    }
    filesByLesson.get(f.lesson_id)!.push(dbToFile(f));
  }

  return lessonsData.map((lessonRow: any) => {
    return dbToLesson(
      lessonRow,
      questionsByLesson.get(lessonRow.id) || [],
      filesByLesson.get(lessonRow.id) || [],
      []
    );
  });
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
  fileUrls?: string[]
): Promise<LessonSubmission | null> {
  if (fileUrls !== undefined && (!Array.isArray(fileUrls) || fileUrls.length < 1 || fileUrls.length > 2)) return null;
  const signal = AbortSignal.timeout(10_000);
  const { data: existing, error: readError } = await supabase
    .from('lesson_submissions').select('*')
    .eq('lesson_id', lessonId).eq('student_email', studentEmail)
    .abortSignal(signal).maybeSingle();
  if (readError) throw readError;

  if (existing) {
    const current = dbToSubmission(existing);
    // Quiz-only and repeated identical uploads must not delete files or reset a teacher's grade.
    if (fileUrls === undefined || JSON.stringify(current.fileUrls || []) === JSON.stringify(fileUrls)) return current;
    const { data, error } = await supabase.from('lesson_submissions')
      .update({
        file_url: fileUrls[0], file_urls: fileUrls, student_name: studentName,
        submitted_at: new Date().toISOString(), score: null, feedback: null, graded_at: null,
        // reward_xp is the earned high-water mark and survives every resubmission.
      })
      .eq('id', existing.id).eq('lesson_id', lessonId)
      .eq('submitted_at', existing.submitted_at)
      .abortSignal(signal).select().maybeSingle();
    if (error) throw error;
    return data ? dbToSubmission(data) : null;
  }

  const { data, error } = await supabase.from('lesson_submissions')
    .insert([{
      id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      lesson_id: lessonId, student_email: studentEmail, student_name: studentName,
      file_url: fileUrls?.[0] || null, file_urls: fileUrls || null,
    }])
    .abortSignal(signal).select().single();
  // The existing unique(lesson_id, student_email) constraint rejects concurrent duplicate creates.
  if (error?.code === '23505') return null;
  if (error) throw error;
  return data ? dbToSubmission(data) : null;
}

export async function gradeSubmission(
  lessonId: string,
  submissionId: string,
  score: number,
  rewardXP: number,
  feedback?: string,
  expected?: { rewardXP: number | null; submittedAt: string; preserveGrade?: boolean }
): Promise<LessonSubmission | null> {
  if (!Number.isFinite(score) || score < 0 || score > 100 || !Number.isInteger(rewardXP) || rewardXP < 0 || rewardXP > 500) return null;
  const update = expected?.preserveGrade
    ? { reward_xp: rewardXP }
    : { score, reward_xp: rewardXP, feedback, graded_at: new Date().toISOString() };
  let query = supabase.from('lesson_submissions').update(update)
    .eq('id', submissionId).eq('lesson_id', lessonId);
  if (expected) {
    query = query.eq('submitted_at', expected.submittedAt);
    query = expected.rewardXP === null ? query.is('reward_xp', null) : query.eq('reward_xp', expected.rewardXP);
  }
  const { data, error } = await query.abortSignal(AbortSignal.timeout(10_000)).select().maybeSingle();
  if (error) throw error;
  // A concurrent grade/reward claim changes reward_xp, so only one caller can award its delta.
  return data ? dbToSubmission(data) : null;
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
