// Simple in-memory lesson storage for demo

export type LessonFile = {
  id: string;
  fileName: string;
  fileType: string; // MIME type or extension
  fileUrl: string; // base64 for demo
  fileSize: number; // in bytes
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
  fileUrl?: string; // Student's uploaded file
  submittedAt: string;
  score?: number; // Teacher's score (0-100)
  feedback?: string; // Teacher's feedback
  rewardXP?: number; // XP reward given by teacher
};

export type Lesson = {
  id: string;
  title: string;
  description: string;
  authorEmail: string;
  authorName: string;
  questions: Question[];
  files: LessonFile[]; // Attached files
  submissions: LessonSubmission[]; // Student submissions
  createdAt: string;
};

const lessons: Lesson[] = [];

// Initialize demo lessons
function initializeDemoLessons() {
  // First, ensure existing lessons have files array
  lessons.forEach(lesson => {
    if (!lesson.files) {
      lesson.files = [];
    }
  });

  const demoLessons: Omit<Lesson, "id" | "createdAt">[] = [
    {
      title: "React Basics",
      description: "Learn the fundamentals of React - components, props, and state",
      authorEmail: "enkhjin@demo.com",
      authorName: "Enkhjin T.",
      files: [],
      submissions: [
        {
          id: "sub-demo-1",
          lessonId: "lesson-demo-1",
          studentEmail: "nomin@demo.com",
          studentName: "Nomin-Erdene",
          fileUrl: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iIzFhMWEyZSIvPgogIDx0ZXh0IHg9IjUwJSIgeT0iNDAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjQiIGZpbGw9IiM4YjVjZjYiIHRleHQtYW5jaG9yPSJtaWRkbGUiPgogICAgUmVhY3QgQ29tcG9uZW50IEV4YW1wbGUKICA8L3RleHQ+CiAgPHRleHQgeD0iNTAlIiB5PSI1NSUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk0YTNiOCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+CiAgICBNaW5pIGRhYWxnYXZyYSAtIE5vbWluCiAgPC90ZXh0Pgo8L3N2Zz4=",
          submittedAt: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: "sub-demo-2",
          lessonId: "lesson-demo-1",
          studentEmail: "bat-erdene@demo.com",
          studentName: "Bat-Erdene U.",
          fileUrl: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iNTAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iIzBmMTcyYSIvPgogIDxyZWN0IHg9IjUwIiB5PSI1MCIgd2lkdGg9IjQwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiM4YjVjZjYiIHJ4PSIxMCIvPgogIDx0ZXh0IHg9IjI1MCIgeT0iMTEwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjAiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj4KICAgIE15IFJlYWN0IEFwcAogIDwvdGV4dD4KICA8dGV4dCB4PSIyNTAiIHk9IjIwMCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE2IiBmaWxsPSIjNjRmZmRhIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj4KICAgIEJ5IEJhdC1FcmRlbmUKICA8L3RleHQ+Cjwvc3ZnPg==",
          submittedAt: new Date(Date.now() - 7200000).toISOString(),
          score: 95,
          rewardXP: 100,
          feedback: "Маш сайн ажил! React компонентын бүтцийг сайн ойлгосон байна. Үргэлжлүүлээрэй! 🎉",
        },
      ],
      questions: [
        {
          id: "q1",
          question: "What is JSX?",
          options: [
            "A JavaScript function",
            "A syntax extension for JavaScript",
            "A CSS framework",
            "A database query language"
          ],
          correctAnswer: 1,
          explanation: "JSX is a syntax extension for JavaScript that allows you to write HTML-like code in your JavaScript files."
        },
        {
          id: "q2",
          question: "Which hook is used for side effects?",
          options: [
            "useState",
            "useContext",
            "useEffect",
            "useReducer"
          ],
          correctAnswer: 2,
          explanation: "useEffect is the React hook used to perform side effects like data fetching, subscriptions, or DOM manipulation."
        }
      ]
    },
    {
      title: "CSS Flexbox Guide",
      description: "Master CSS Flexbox layout with practical examples",
      authorEmail: "bat-erdene@demo.com",
      authorName: "Bat-Erdene U.",
      files: [],
      submissions: [
        {
          id: "sub-demo-3",
          lessonId: "lesson-demo-2",
          studentEmail: "enkhjin@demo.com",
          studentName: "Enkhjin T.",
          fileUrl: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iNjAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iIzEzMTgyNyIvPgogIDwhLS0gRmxleGJveCBDb250YWluZXIgLS0+CiAgPHJlY3QgeD0iNTAiIHk9IjUwIiB3aWR0aD0iNTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMDZiNmQ0IiBzdHJva2Utd2lkdGg9IjIiIHJ4PSI1Ii8+CiAgPCEtLSBGbGV4IEl0ZW1zIC0tPgogIDxyZWN0IHg9IjcwIiB5PSI2NSIgd2lkdGg9IjgwIiBoZWlnaHQ9IjcwIiBmaWxsPSIjOGI1Y2Y2IiByeD0iNSIvPgogIDxyZWN0IHg9IjE3MCIgeT0iNjUiIHdpZHRoPSI4MCIgaGVpZ2h0PSI3MCIgZmlsbD0iIzhiNWNmNiIgcng9IjUiLz4KICA8cmVjdCB4PSIyNzAiIHk9IjY1IiB3aWR0aD0iODAiIGhlaWdodD0iNzAiIGZpbGw9IiM4YjVjZjYiIHJ4PSI1Ii8+CiAgPHRleHQgeD0iMzAwIiB5PSIyMDAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyMCIgZmlsbD0iIzA2YjZkNCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+CiAgICBGbGV4Ym94IExheW91dCBFeGFtcGxlCiAgPC90ZXh0PgogIDx0ZXh0IHg9IjMwMCIgeT0iMjMwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM2NGZmZGEiIHRleHQtYW5jaG9yPSJtaWRkbGUiPgogICAgQnkgRW5raGppbgogIDwvdGV4dD4KPC9zdmc+",
          submittedAt: new Date(Date.now() - 1800000).toISOString(),
          score: 88,
          rewardXP: 80,
          feedback: "Flexbox-ын үндсэн ойлголтыг сайн ойлгосон байна. Илүү төвөгтэй жишээнүүд дээр дадлага хийвэл илүү сайн болно.",
        },
      ],
      questions: [
        {
          id: "q1",
          question: "What does 'justify-content: center' do?",
          options: [
            "Centers items vertically",
            "Centers items horizontally",
            "Adds padding to items",
            "Changes item order"
          ],
          correctAnswer: 1,
          explanation: "justify-content: center aligns flex items along the main axis (horizontally by default)."
        }
      ]
    }
  ];

  demoLessons.forEach((lesson, index) => {
    const newLesson: Lesson = {
      ...lesson,
      id: `lesson-demo-${index + 1}`,
      createdAt: new Date(Date.now() - (2 - index) * 86400000).toISOString(),
    };
    lessons.push(newLesson);
  });
}

// Initialize on first load
initializeDemoLessons();

export function createLesson(data: Omit<Lesson, "id" | "createdAt">): Lesson {
  const newLesson: Lesson = {
    ...data,
    id: `lesson-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
  };
  lessons.unshift(newLesson);
  return newLesson;
}

export function getAllLessons(): Lesson[] {
  return [...lessons];
}

export function getLesson(id: string): Lesson | undefined {
  return lessons.find(l => l.id === id);
}

export function deleteLesson(id: string, userEmail: string): boolean {
  const index = lessons.findIndex(l => l.id === id && l.authorEmail === userEmail);
  if (index === -1) return false;
  lessons.splice(index, 1);
  return true;
}

export function submitToLesson(
  lessonId: string,
  studentEmail: string,
  studentName: string,
  fileUrl?: string
): LessonSubmission | null {
  const lesson = lessons.find(l => l.id === lessonId);
  if (!lesson) return null;

  // Check if student already submitted
  const existingSubmission = lesson.submissions.find(s => s.studentEmail === studentEmail);
  if (existingSubmission) return null; // Already submitted

  const newSubmission: LessonSubmission = {
    id: `submission-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    lessonId,
    studentEmail,
    studentName,
    fileUrl,
    submittedAt: new Date().toISOString(),
  };

  lesson.submissions.push(newSubmission);
  return newSubmission;
}

export function gradeSubmission(
  lessonId: string,
  submissionId: string,
  score: number,
  rewardXP: number,
  feedback?: string
): LessonSubmission | null {
  const lesson = lessons.find(l => l.id === lessonId);
  if (!lesson) return null;

  const submission = lesson.submissions.find(s => s.id === submissionId);
  if (!submission) return null;

  submission.score = score;
  submission.rewardXP = rewardXP;
  submission.feedback = feedback;

  return submission;
}

export function getSubmission(lessonId: string, studentEmail: string): LessonSubmission | null {
  const lesson = lessons.find(l => l.id === lessonId);
  if (!lesson) return null;

  return lesson.submissions.find(s => s.studentEmail === studentEmail) || null;
}
