"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { DashboardLayout } from "../../../components/layout/DashboardLayout";
import { useSession } from "../../../components/auth/useSession";
import Link from "next/link";
import Modal from "../../../components/ui/Modal";
import { invalidateCache } from "../../../lib/fetchCache";

type Question = {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
};

type LessonFile = {
  id: string;
  fileName: string;
  fileType: string;
  fileUrl: string;
  fileSize: number;
};

type LessonSubmission = {
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
};

type Lesson = {
  id: string;
  title: string;
  description: string;
  authorName: string;
  authorEmail: string;
  questions: Question[];
  files?: LessonFile[];
  submissions?: LessonSubmission[];
  createdAt: string;
};

function normalizeDescription(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export default function LessonDetailPage() {
  const { session } = useSession();
  const params = useParams();
  const lessonId = String(params.id);
  const requestRef = useRef(0);
  const actionRef = useRef(false);
  const uploadRef = useRef(false);
  const questionHeadingRef = useRef<HTMLHeadingElement>(null);
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [quizSaving, setQuizSaving] = useState(false);
  const [quizError, setQuizError] = useState("");
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);

  // Submission states
  const [showSubmitSection, setShowSubmitSection] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filePreviews, setFilePreviews] = useState<string[]>([]); // Array of file URLs
  const [filesToUpload, setFilesToUpload] = useState<string[]>([]); // Array of file URLs to submit
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [uploadingSubmission, setUploadingSubmission] = useState(false);
  const [uploadingFileIndex, setUploadingFileIndex] = useState<number | null>(
    null,
  ); // Track which file is uploading
  const [showRewardPopup, setShowRewardPopup] = useState(false);
  const [rewardMessage, setRewardMessage] = useState("");

  // Grading states
  const [gradingSubmissionId, setGradingSubmissionId] = useState<string | null>(
    null,
  );
  const [gradeScore, setGradeScore] = useState(100);
  const [gradeXP, setGradeXP] = useState(50);
  const [gradeFeedback, setGradeFeedback] = useState("");
  const [grading, setGrading] = useState(false);

  const fetchLesson = useCallback(async () => {
    const request = ++requestRef.current;
    setLoading(true);
    setLoadError("");
    try {
      const response = await fetch(`/api/lessons/${lessonId}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
      if (response.status === 404)
        throw new Error(
          "Энэ хичээл олдсонгүй. Устгагдсан эсвэл холбоос нь өөрчлөгдсөн байж болно.",
        );
      const json = await response.json();
      if (!response.ok || !json.ok || !json.lesson)
        throw new Error("Хичээлийг ачаалж чадсангүй. Дахин оролдоно уу.");
      if (request !== requestRef.current) return;
      const loaded = {
        ...json.lesson,
        questions: Array.isArray(json.lesson.questions)
          ? json.lesson.questions
          : [],
        files: json.lesson.files || [],
        submissions: json.lesson.submissions || [],
      };
      setLesson(loaded);
      setSelectedAnswers(new Array(loaded.questions.length).fill(-1));
      setCurrentQuestion(0);
      setShowResults(false);
    } catch (error) {
      if (request === requestRef.current)
        setLoadError(
          error instanceof Error &&
            ![
              "TimeoutError",
              "TypeError",
              "AbortError",
              "SyntaxError",
            ].includes(error.name)
            ? error.message
            : "Холболт удаан байна. Дахин оролдоно уу.",
        );
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [lessonId]);
  useEffect(() => {
    setLesson(null);
    setShowSubmitSection(false);
    setGradingSubmissionId(null);
    setFilesToUpload([]);
    setFilePreviews([]);
    setShowRewardPopup(false);
    setSubmitError(null);
    setQuizError("");
    void fetchLesson();
    return () => {
      requestRef.current += 1;
    };
  }, [fetchLesson]);
  useEffect(() => {
    questionHeadingRef.current?.focus({ preventScroll: false });
  }, [currentQuestion]);
  useEffect(() => {
    if (showResults) resultHeadingRef.current?.focus({ preventScroll: false });
  }, [showResults]);

  function applySubmission(submission?: LessonSubmission) {
    if (!submission) return;
    setLesson((current) =>
      current
        ? {
            ...current,
            submissions: [
              ...(current.submissions || []).filter(
                (item) => item.id !== submission.id,
              ),
              submission,
            ],
          }
        : current,
    );
    invalidateCache("/api/lessons");
  }

  function handleAnswer(answerIndex: number) {
    const updated = [...selectedAnswers];
    updated[currentQuestion] = answerIndex;
    setSelectedAnswers(updated);
  }

  function nextQuestion() {
    if (lesson && currentQuestion < lesson.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  }

  function previousQuestion() {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  }

  async function submitQuiz() {
    if (
      !lesson ||
      !lesson.questions.length ||
      selectedAnswers.some((answer) => answer < 0) ||
      actionRef.current ||
      uploadRef.current
    )
      return;
    const correct = lesson.questions.reduce(
      (count, question, index) =>
        count + (selectedAnswers[index] === question.correctAnswer ? 1 : 0),
      0,
    );
    setScore(correct);
    setShowResults(true);
    setQuizError("");
    setShowRewardPopup(false);
    if (session?.role !== "student") return;
    actionRef.current = true;
    setQuizSaving(true);
    const request = requestRef.current;
    try {
      const response = await fetch(`/api/lessons/${lesson.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: selectedAnswers }),
        signal: AbortSignal.timeout(45000),
      });
      const json = await response.json();
      if (!response.ok || !json.success)
        throw new Error(json.error || "Үр дүнг хадгалж чадсангүй.");
      if (request !== requestRef.current) return;
      applySubmission(json.submission);
      setRewardMessage(
        `Үр дүнг хадгаллаа.${typeof json.score === "number" ? ` ${json.score} оноо.` : ""}${typeof json.rewardXP === "number" ? ` +${json.rewardXP} XP.` : ""}`,
      );
      setShowRewardPopup(true);
    } catch (error) {
      if (request === requestRef.current)
        setQuizError(
          error instanceof Error &&
            ![
              "TimeoutError",
              "TypeError",
              "AbortError",
              "SyntaxError",
            ].includes(error.name)
            ? error.message
            : "Хадгалалтын хариу ирсэнгүй. Хуудсаа шинэчилж бүртгэгдсэн эсэхийг шалгана уу.",
        );
    } finally {
      actionRef.current = false;
      setQuizSaving(false);
    }
  }

  function resetQuiz() {
    if (actionRef.current) return;
    setQuizError("");
    setShowRewardPopup(false);
    setCurrentQuestion(0);
    setSelectedAnswers(new Array(lesson?.questions.length || 0).fill(-1));
    setShowResults(false);
    setScore(0);
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const field = event.currentTarget;
    const files = Array.from(field.files || []);
    if (!files.length || uploadRef.current || actionRef.current) return;
    setSubmitError(null);
    if (filesToUpload.length + files.length > 2) {
      setSubmitError("Хамгийн ихдээ 2 файл байршуулна уу.");
      field.value = "";
      return;
    }
    if (files.some((file) => file.size > 50 * 1024 * 1024)) {
      setSubmitError("Файл тус бүрийн хэмжээ 50 MB-аас бага байна.");
      field.value = "";
      return;
    }
    uploadRef.current = true;
    setUploadingSubmission(true);
    const request = requestRef.current;
    try {
      for (let index = 0; index < files.length; index++) {
        setUploadingFileIndex(index);
        const signResponse = await fetch("/api/uploads/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folder: "neoncanvas/submissions" }),
          signal: AbortSignal.timeout(15000),
        });
        const sign = await signResponse.json();
        if (
          !signResponse.ok ||
          !sign.ok ||
          !sign.cloudName ||
          !sign.apiKey ||
          !sign.signature
        )
          throw new Error("Байршуулалтыг эхлүүлж чадсангүй.");
        const form = new FormData();
        form.append("file", files[index]);
        form.append("api_key", sign.apiKey);
        form.append("timestamp", String(sign.timestamp));
        form.append("signature", sign.signature);
        form.append("folder", sign.folder || "neoncanvas/submissions");
        const response = await fetch(
          `https://api.cloudinary.com/v1_1/${sign.cloudName}/auto/upload`,
          { method: "POST", body: form, signal: AbortSignal.timeout(90000) },
        );
        const json = await response.json();
        if (!response.ok || !json.secure_url)
          throw new Error("Файлыг байршуулж чадсангүй.");
        if (request !== requestRef.current) return;
        // Keep earlier successful files if a later upload fails.
        setFilesToUpload((current) => [...current, json.secure_url]);
        setFilePreviews((current) => [...current, json.secure_url]);
      }
    } catch {
      if (request === requestRef.current)
        setSubmitError(
          "Файл байршуулалт амжилтгүй. Бэлэн файлууд хадгалагдсан; үлдсэнийг дахин сонгоно уу.",
        );
    } finally {
      uploadRef.current = false;
      setUploadingSubmission(false);
      setUploadingFileIndex(null);
      field.value = "";
    }
  }

  function removeFile(index: number) {
    const newFiles = filesToUpload.filter((_, i) => i !== index);
    const newPreviews = filePreviews.filter((_, i) => i !== index);
    setFilesToUpload(newFiles);
    setFilePreviews(newPreviews);
  }

  async function handleSubmitWork() {
    if (!session || !lesson || actionRef.current || uploadRef.current) return;
    if (filesToUpload.length < 1 || filesToUpload.length > 2) {
      setSubmitError("Илгээх 1–2 файлаа эхлээд сонгож байршуулна уу.");
      return;
    }
    actionRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    setShowRewardPopup(false);
    const request = requestRef.current;
    try {
      const response = await fetch(`/api/lessons/${lesson.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileUrls: filesToUpload,
        }),
        signal: AbortSignal.timeout(60000),
      });
      const json = await response.json();
      if (!response.ok || !json.success)
        throw new Error(json.error || "Даалгаврыг илгээж чадсангүй.");
      if (request !== requestRef.current) return;
      applySubmission(json.submission);
      setRewardMessage(
        typeof json.message === "string"
          ? json.message
          : "Файлыг хүлээн авлаа. Багшийн үнэлгээг хүлээнэ үү.",
      );
      setShowRewardPopup(true);
      setShowSubmitSection(false);
      setFilesToUpload([]);
      setFilePreviews([]);
    } catch (error) {
      if (request === requestRef.current)
        setSubmitError(
          error instanceof Error &&
            ![
              "TimeoutError",
              "TypeError",
              "AbortError",
              "SyntaxError",
            ].includes(error.name)
            ? error.message
            : "Хариу ирсэнгүй. Дахин илгээхээс өмнө хуудас шинэчилж даалгавраа шалгана уу.",
        );
    } finally {
      actionRef.current = false;
      setSubmitting(false);
    }
  }

  async function handleGradeSubmission() {
    if (!session || !lesson || !gradingSubmissionId || actionRef.current)
      return;
    if (
      !Number.isFinite(gradeScore) ||
      gradeScore < 0 ||
      gradeScore > 100 ||
      !Number.isFinite(gradeXP) ||
      gradeXP < 0 ||
      gradeXP > 500
    ) {
      setSubmitError("Оноо 0–100, XP 0–500 хооронд байна.");
      return;
    }
    actionRef.current = true;
    setGrading(true);
    setSubmitError(null);
    const request = requestRef.current;
    try {
      const response = await fetch(`/api/lessons/${lesson.id}/grade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: gradingSubmissionId,
          score: gradeScore,
          rewardXP: gradeXP,
          feedback: gradeFeedback,
        }),
        signal: AbortSignal.timeout(30000),
      });
      const json = await response.json();
      if (!response.ok || !json.success)
        throw new Error(json.error || "Үнэлгээг хадгалж чадсангүй.");
      if (request !== requestRef.current) return;
      applySubmission(json.submission);
      setRewardMessage("Сурагчийн үнэлгээг хадгаллаа.");
      setShowRewardPopup(true);
      setGradingSubmissionId(null);
      setGradeScore(100);
      setGradeXP(50);
      setGradeFeedback("");
    } catch (error) {
      if (request === requestRef.current)
        setSubmitError(
          error instanceof Error &&
            ![
              "TimeoutError",
              "TypeError",
              "AbortError",
              "SyntaxError",
            ].includes(error.name)
            ? error.message
            : "Хариу ирсэнгүй. Дахин хадгалахаас өмнө хуудас шинэчилж үнэлгээг шалгана уу.",
        );
    } finally {
      actionRef.current = false;
      setGrading(false);
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-8">
          <p role="status" className="text-slate-300">
            Хичээлийг ачаалж байна…
          </p>
        </div>
      </DashboardLayout>
    );
  }

  if (loadError || !lesson) {
    return (
      <DashboardLayout>
        <div className="mv-page space-y-5">
          <Link href="/lessons" className="mv-button-secondary">
            ← Хичээлүүд
          </Link>
          <section role="alert" className="mv-panel p-8">
            <h1 className="text-xl font-semibold text-white">
              Хичээлийг нээж чадсангүй
            </h1>
            <p className="mt-3 text-slate-300">
              {loadError || "Хичээлийн мэдээлэл олдсонгүй."}
            </p>
            <button
              type="button"
              className="mv-button-primary mt-5"
              onClick={() => void fetchLesson()}
            >
              Дахин оролдох
            </button>
          </section>
        </div>
      </DashboardLayout>
    );
  }

  const currentQ = lesson.questions[currentQuestion];
  const allAnswered = selectedAnswers.every((a) => a !== -1);
  const isTeacher = session?.role === "teacher";
  const isAuthor = session?.email === lesson.authorEmail;
  const isStudent = session?.role === "student";
  const mySubmission = lesson.submissions?.find(
    (s) => s.studentEmail === session?.email,
  );
  const canSubmit = isStudent; // Allow resubmission
  const lessonDescription = normalizeDescription(lesson.description);

  if (showResults) {
    const percentage = lesson.questions.length
      ? Math.round((score / lesson.questions.length) * 100)
      : 0;
    return (
      <DashboardLayout>
        <div className="mv-page !max-w-6xl space-y-6">
          <Link
            href="/lessons"
            className="text-sm text-violet-400 hover:text-violet-300"
          >
            ← Хичээлүүд
          </Link>

          <div className="grid items-start gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
            <div className="mv-panel px-6 py-7 text-center xl:sticky xl:top-6">
              <h1
                ref={resultHeadingRef}
                tabIndex={-1}
                className="mb-5 text-2xl font-semibold tracking-tight text-white"
              >
                Сорилын үр дүн
              </h1>
              <div className="text-6xl font-bold mb-4 bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                {percentage}%
              </div>
              <p className="text-lg mb-6">
                {score} / {lesson.questions.length} зөв хариулт
              </p>
              {quizSaving && (
                <p role="status" className="mb-4 text-sm text-violet-200">
                  Үр дүнг хадгалж байна…
                </p>
              )}
              {quizError && (
                <p
                  role="alert"
                  className="mb-4 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-200"
                >
                  {quizError}
                </p>
              )}
              {showRewardPopup && (
                <p
                  role="status"
                  className="mb-4 rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-200"
                >
                  {rewardMessage}
                </p>
              )}
              {!session && (
                <p className="mb-4 text-sm text-slate-300">
                  <Link href="/login" className="text-violet-300 underline">
                    Нэвтэрч
                  </Link>{" "}
                  үр дүнгээ бүртгүүлээрэй.
                </p>
              )}
              <div className="flex flex-wrap gap-3 justify-center">
                <button
                  onClick={resetQuiz}
                  disabled={quizSaving}
                  className="min-h-11 px-6 py-2 rounded-lg border border-violet-500 text-violet-400 hover:bg-violet-500/10 transition-colors"
                >
                  Дахин шалгах
                </button>
                <Link
                  href="/lessons"
                  className="min-h-11 px-6 py-2 rounded-lg bg-gradient-to-r from-violet-500 to-purple-500 text-white hover:shadow-lg transition-shadow"
                >
                  Бусад хичээл
                </Link>
              </div>
            </div>

            <div className="min-w-0 space-y-4">
              <h2 className="text-xl font-semibold tracking-tight">
                Дэлгэрэнгүй үр дүн
              </h2>
              {lesson.questions.map((q, idx) => {
                const isCorrect = selectedAnswers[idx] === q.correctAnswer;
                return (
                  <div
                    key={q.id}
                    className={`mv-panel px-5 py-5 sm:px-6 ${
                      isCorrect ? "border-green-500/25" : "border-red-500/25"
                    }`}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <span className="text-2xl">
                        {isCorrect ? "✅" : "❌"}
                      </span>
                      <div className="flex-1">
                        <p className="font-medium mb-2">{q.question}</p>
                        <p className="text-sm text-slate-400">
                          Таны хариулт:{" "}
                          <span
                            className={
                              isCorrect ? "text-green-400" : "text-red-400"
                            }
                          >
                            {q.options[selectedAnswers[idx]]}
                          </span>
                        </p>
                        {!isCorrect && (
                          <p className="text-sm text-slate-400">
                            Зөв хариулт:{" "}
                            <span className="text-green-400">
                              {q.options[q.correctAnswer]}
                            </span>
                          </p>
                        )}
                        {q.explanation && (
                          <p className="text-sm text-slate-400 mt-2 italic">
                            💡 {q.explanation}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mv-page space-y-6 xl:space-y-8">
        <Link
          href="/lessons"
          className="text-sm text-violet-400 hover:text-violet-300"
        >
          ← Хичээлүүд
        </Link>

        <header className="mv-panel p-5 sm:p-7 xl:p-8">
          <p className="mv-eyebrow">ХИЧЭЭЛ · ДАДЛАГА · СОРИЛ</p>
          <h1 className="mv-title mb-5 max-w-4xl break-words">
            {lesson.title}
          </h1>
          <div className="mb-6 max-w-[75ch]">
            <p className="whitespace-pre-line break-words text-base leading-8 text-slate-300">
              {lessonDescription}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/10 pt-5 text-sm text-slate-400">
            <span>👤 {lesson.authorName}</span>
            <span>📝 {lesson.questions.length} асуулт</span>
          </div>
        </header>
        {/* Submission and grading confirmation */}
        {showRewardPopup && (
          <div
            role="status"
            className="flex items-start justify-between gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm leading-6 text-emerald-200"
          >
            <p>{rewardMessage}</p>
            <button
              type="button"
              onClick={() => setShowRewardPopup(false)}
              aria-label="Мэдээлэл хаах"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-white/10"
            >
              ×
            </button>
          </div>
        )}

        <div
          className={`grid items-start gap-6 ${lesson.questions.length || lesson.files?.length || mySubmission ? "xl:grid-cols-[minmax(0,1fr)_300px] 2xl:grid-cols-[minmax(0,1fr)_340px]" : ""}`}
        >
          <div className="min-w-0 space-y-6">
            {currentQ ? (
              <section
                className="mv-panel p-5 sm:p-7 xl:p-8"
                aria-labelledby="lesson-question-title"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                  <span className="text-sm text-slate-400">
                    Асуулт {currentQuestion + 1} / {lesson.questions.length}
                  </span>
                  <span className="text-sm text-violet-300">
                    {selectedAnswers.filter((answer) => answer >= 0).length} /{" "}
                    {lesson.questions.length} хариулсан
                  </span>
                </div>

                <h2
                  ref={questionHeadingRef}
                  id="lesson-question-title"
                  tabIndex={-1}
                  className="mb-6 break-words text-xl font-semibold leading-8 tracking-tight text-white sm:text-2xl"
                >
                  {currentQ.question}
                </h2>

                <div
                  role="group"
                  aria-labelledby="lesson-question-title"
                  className="space-y-3 mb-6"
                >
                  {currentQ.options.map((option, idx) => (
                    <button
                      key={idx}
                      aria-pressed={selectedAnswers[currentQuestion] === idx}
                      onClick={() => handleAnswer(idx)}
                      className={`flex min-h-14 w-full items-start gap-3 rounded-xl border px-4 py-4 text-left transition-colors ${
                        selectedAnswers[currentQuestion] === idx
                          ? "border-violet-500 bg-violet-500/10"
                          : "border-white/10 hover:border-violet-500/30 hover:bg-white/[0.025]"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-sm font-medium ${selectedAnswers[currentQuestion] === idx ? "bg-violet-500 text-white" : "bg-white/5 text-slate-400"}`}
                      >
                        {idx + 1}
                      </span>
                      <span className="min-w-0 break-words text-base leading-7">
                        {option}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
                  <button
                    onClick={previousQuestion}
                    disabled={currentQuestion === 0}
                    className="min-h-11 px-4 py-2 rounded-lg border border-slate-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors"
                  >
                    ← Өмнөх
                  </button>

                  {currentQuestion === lesson.questions.length - 1 ? (
                    <button
                      onClick={submitQuiz}
                      disabled={
                        !allAnswered ||
                        quizSaving ||
                        submitting ||
                        uploadingSubmission
                      }
                      className="min-h-11 px-6 py-2 rounded-lg bg-gradient-to-r from-violet-500 to-purple-500 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-shadow"
                    >
                      Дуусгах
                    </button>
                  ) : (
                    <button
                      onClick={nextQuestion}
                      disabled={selectedAnswers[currentQuestion] === -1}
                      className="min-h-11 px-4 py-2 rounded-lg bg-violet-500 text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-violet-600 transition-colors"
                    >
                      Дараах →
                    </button>
                  )}
                </div>
              </section>
            ) : (
              <section className="mv-panel p-6">
                <h2 className="text-lg font-semibold text-white">
                  Бүтээлээрээ дадлагажаарай
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Энэ хичээлд сорилын асуулт оруулаагүй байна. Тайлбар болон
                  хавсаргасан материалаа ашиглаарай.
                </p>
              </section>
            )}

            {/* Student Submission Section */}
            {canSubmit && (
              <div className="mv-panel p-5 sm:p-7 xl:p-8">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <h2 className="text-xl font-semibold tracking-tight">
                    {mySubmission
                      ? "Даалгавраа дахин илгээх"
                      : "Даалгавраа илгээх"}
                  </h2>
                  {!showSubmitSection && (
                    <button
                      onClick={() => setShowSubmitSection(true)}
                      className="min-h-11 px-4 py-2 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-sm transition-colors"
                    >
                      {mySubmission ? "Дахин илгээх" : "Ажил илгээх"}
                    </button>
                  )}
                </div>
                {mySubmission && !showSubmitSection && (
                  <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <p className="text-sm text-blue-400">
                      Шинэ файл илгээвэл өмнөх файлуудыг орлуулж, багш дахин
                      үнэлнэ. Өмнө авсан XP хадгалагдана.
                    </p>
                  </div>
                )}

                {showSubmitSection && (
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="lesson-work-files" className="mv-label">
                        Даалгаврын файл (1–2 файл шаардлагатай)
                        {filesToUpload.length > 0 && (
                          <span className="ml-2 text-violet-400">
                            ({filesToUpload.length}/2)
                          </span>
                        )}
                      </label>
                      <label
                        htmlFor="lesson-work-files"
                        className={`relative inline-flex min-h-11 items-center gap-2 rounded-xl border border-violet-400/30 bg-violet-500/10 px-4 py-3 text-sm font-medium text-violet-200 transition-colors focus-within:ring-2 focus-within:ring-violet-400 focus-within:ring-offset-2 focus-within:ring-offset-slate-950 ${filesToUpload.length >= 2 || uploadingSubmission || submitting ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-violet-500/20"}`}
                      >
                        Файл сонгох
                        <input
                          type="file"
                          id="lesson-work-files"
                          aria-describedby="lesson-work-files-help"
                          multiple
                          onChange={handleFileUpload}
                          disabled={
                            filesToUpload.length >= 2 ||
                            uploadingSubmission ||
                            submitting
                          }
                          className="sr-only"
                        />
                      </label>
                      <p
                        id="lesson-work-files-help"
                        className="mt-2 text-sm leading-6 text-slate-400"
                      >
                        Илгээх файлаа сонгоод байршуулж дуустал хүлээнэ үү.
                        Асуултын хариуг дээрх шалгалтын хэсгээс тусад нь
                        илгээнэ.
                      </p>
                      {filesToUpload.length >= 2 && (
                        <p className="mt-2 text-sm text-yellow-400">
                          Та хамгийн ихдээ 2 файл оруулах боломжтой
                        </p>
                      )}
                      {uploadingSubmission && (
                        <p className="mt-2 text-sm text-slate-400">
                          Файл байршиж байна... (
                          {uploadingFileIndex !== null
                            ? uploadingFileIndex + 1
                            : ""}
                          )
                        </p>
                      )}
                    </div>

                    {/* Show uploaded files */}
                    {filePreviews.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm text-slate-400">Бэлэн файлууд:</p>
                        {filePreviews.map((url, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-2 bg-slate-950/60 rounded-lg border border-slate-700"
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="text-green-400">✓</span>
                              <span className="text-sm text-slate-300 truncate">
                                Файл {index + 1}
                              </span>
                              {url.startsWith("data:image/") && (
                                <span className="text-sm text-slate-400">
                                  (Зураг)
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => removeFile(index)}
                              className="min-h-11 px-2 py-1 rounded text-sm bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
                              disabled={uploadingSubmission || submitting}
                            >
                              Устгах
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {submitError && (
                      <p
                        role="alert"
                        className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-200"
                      >
                        {submitError}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={handleSubmitWork}
                        disabled={
                          submitting ||
                          uploadingSubmission ||
                          filesToUpload.length < 1
                        }
                        className="min-h-11 px-6 py-2 rounded-lg bg-gradient-to-r from-violet-500 to-purple-500 text-white text-sm font-medium shadow-[0_4px_16px_rgba(139,92,246,0.4)] hover:shadow-[0_6px_20px_rgba(139,92,246,0.6)] disabled:opacity-60 transition-all"
                      >
                        {submitting
                          ? "Илгээж байна..."
                          : uploadingSubmission
                            ? "Байршуулж байна..."
                            : "Илгээх"}
                      </button>
                      <button
                        disabled={submitting || uploadingSubmission}
                        onClick={() => {
                          setShowSubmitSection(false);
                          setFilePreviews([]);
                          setFilesToUpload([]);
                          setSubmitError(null);
                        }}
                        className="min-h-11 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm transition-colors"
                      >
                        Болих
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <aside
            className="min-w-0 space-y-5 xl:sticky xl:top-6"
            aria-label="Хичээлийн явц ба материал"
          >
            {lesson.questions.length > 0 && (
              <section
                className="mv-panel p-5 sm:p-6"
                aria-labelledby="lesson-progress-title"
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2
                    id="lesson-progress-title"
                    className="text-base font-semibold text-white"
                  >
                    Сорилын явц
                  </h2>
                  <span className="text-sm font-medium tabular-nums text-violet-300">
                    {selectedAnswers.filter((answer) => answer >= 0).length}/
                    {lesson.questions.length}
                  </span>
                </div>
                <progress
                  aria-label="Хариулсан асуултын тоо"
                  max={lesson.questions.length}
                  value={selectedAnswers.filter((answer) => answer >= 0).length}
                  className="block h-2 w-full overflow-hidden rounded-full accent-violet-500"
                />
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  Бүх асуултад хариулаад «Дуусгах» товчийг дарж үр дүнгээ
                  хараарай.
                </p>
              </section>
            )}
            {lesson.files && lesson.files.length > 0 && (
              <div className="mv-panel p-5 sm:p-6">
                <h2 className="mb-4 text-base font-semibold text-white">
                  Хичээлийн материал
                </h2>
                <div className="space-y-2">
                  {lesson.files.map((file) => {
                    const downloadHref = `/api/lessons/download?url=${encodeURIComponent(file.fileUrl)}&name=${encodeURIComponent(file.fileName)}`;
                    return (
                      <a
                        key={file.id}
                        href={downloadHref}
                        download={file.fileName}
                        className="flex items-center justify-between gap-2 bg-white/[0.025] border border-white/10 hover:border-violet-500/40 rounded-xl px-3 py-3 transition-colors group"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-300 truncate group-hover:text-violet-300 transition-colors">
                            {file.fileName}
                          </p>
                          <p className="text-sm text-slate-400">
                            {(file.fileSize / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        <span className="text-sm font-medium text-violet-300">
                          Татах
                        </span>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
            {/* My Submission Status */}
            {mySubmission && (
              <div className="mv-panel p-5 sm:p-6">
                <h2 className="mb-4 text-base font-semibold">Таны даалгавар</h2>
                <div className="space-y-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-slate-400">Илгээсэн:</span>
                    <span className="text-slate-200">
                      {new Date(mySubmission.submittedAt).toLocaleString(
                        "mn-MN",
                        {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                          hourCycle: "h23",
                        },
                      )}
                    </span>
                  </div>
                  {mySubmission.score !== null &&
                  mySubmission.score !== undefined ? (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-slate-400">Оноо:</span>
                        <span className="text-xl font-bold text-violet-400">
                          {mySubmission.score}/100
                        </span>
                      </div>
                      {mySubmission.rewardXP !== null &&
                        mySubmission.rewardXP !== undefined && (
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-slate-400">XP:</span>
                            <span className="text-xl font-bold text-yellow-400">
                              +{mySubmission.rewardXP} XP 🎉
                            </span>
                          </div>
                        )}
                      {mySubmission.feedback && (
                        <div className="mt-3 p-3 bg-slate-950/60 rounded-lg">
                          <p className="text-sm text-slate-400 mb-1">
                            Багшийн санал:
                          </p>
                          <p className="whitespace-pre-line break-words text-sm leading-7 text-slate-300">
                            {mySubmission.feedback}
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-yellow-400">
                      ⏳ Багш таны ажлыг шалгаж байна...
                    </p>
                  )}
                </div>
              </div>
            )}
          </aside>
        </div>
        {/* Teacher: View Submissions */}
        {isTeacher && lesson.submissions && lesson.submissions.length > 0 && (
          <div className="mv-panel p-5 sm:p-7">
            <h2 className="text-lg font-semibold mb-4">
              Сурагчдын даалгавар ({lesson.submissions.length})
              {!isAuthor && (
                <span className="text-sm text-slate-400 ml-2">
                  (Бусад багшийн хичээл)
                </span>
              )}
            </h2>
            <div className="grid items-start gap-5 2xl:grid-cols-2">
              {lesson.submissions.map((sub) => {
                return (
                  <div
                    key={sub.id}
                    className="bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-4 hover:border-slate-600 transition-colors"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center text-sm font-bold">
                          {sub.studentName[0]?.toUpperCase()}
                        </div>
                        <div>
                          <h3 className="break-words text-base font-semibold">
                            {sub.studentName}
                          </h3>
                          <p className="text-sm text-slate-400">
                            📅{" "}
                            {new Date(sub.submittedAt).toLocaleString("mn-MN", {
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                              hourCycle: "h23",
                            })}
                          </p>
                        </div>
                      </div>
                      {sub.score !== null && sub.score !== undefined ? (
                        <div className="text-right">
                          <div className="text-lg font-bold text-violet-400">
                            {sub.score}/100
                          </div>
                          <div className="text-sm text-yellow-400">
                            +{sub.rewardXP || 0} XP
                          </div>
                          <div className="text-sm text-green-400 mt-1">
                            ✓ Оноолсон
                          </div>
                          {isTeacher && (
                            <button
                              onClick={() => {
                                setSubmitError(null);
                                setGradingSubmissionId(sub.id);
                                setGradeScore(sub.score);
                                setGradeXP(sub.rewardXP ?? 50);
                                setGradeFeedback(sub.feedback || "");
                              }}
                              className="mt-2 px-3 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm transition-colors"
                            >
                              ✏️ Засах
                            </button>
                          )}
                        </div>
                      ) : isTeacher ? (
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => {
                              setGradingSubmissionId(sub.id);
                              setGradeScore(100);
                              setGradeXP(50);
                              setGradeFeedback("");
                              setSubmitError(null);
                            }}
                            className="min-h-11 px-4 py-2 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-sm font-medium transition-colors shadow-lg"
                          >
                            📝 Оноо өгөх
                          </button>
                          <span className="text-sm text-yellow-400 text-center">
                            Шалгах хэрэгтэй
                          </span>
                        </div>
                      ) : (
                        <div className="text-right">
                          <div className="text-sm text-slate-400">
                            Оноо хүлээгдэж байна
                          </div>
                        </div>
                      )}
                    </div>

                    {(sub.fileUrls && sub.fileUrls.length > 0) ||
                    sub.fileUrl ? (
                      <div className="mb-3 space-y-2">
                        {/* Support both old format (fileUrl) and new format (fileUrls array) */}
                        {(sub.fileUrls && sub.fileUrls.length > 0
                          ? sub.fileUrls
                          : [sub.fileUrl]
                        ).map((fileUrl: string, fileIndex: number) => (
                          <div key={fileIndex} className="mb-3">
                            {sub.fileUrls && sub.fileUrls.length > 1 && (
                              <p className="text-sm text-slate-400 mb-1">
                                Файл {fileIndex + 1}:
                              </p>
                            )}
                            {/* File Preview */}
                            {fileUrl.startsWith("data:image/") ||
                            (fileUrl.startsWith("http") &&
                              fileUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i)) ? (
                              <div className="border border-slate-700 rounded-lg overflow-hidden">
                                <img
                                  src={fileUrl}
                                  alt={`${sub.studentName}-ийн даалгаврын файл ${fileIndex + 1}`}
                                  loading="lazy"
                                  decoding="async"
                                  className="w-full max-h-96 object-contain bg-slate-950"
                                />
                              </div>
                            ) : fileUrl.startsWith("data:application/pdf") ||
                              (fileUrl.startsWith("http") &&
                                fileUrl.match(/\.pdf$/i)) ? (
                              <div className="p-4 bg-slate-950/60 border border-slate-700 rounded-lg text-center">
                                <span className="text-4xl">📄</span>
                                <p className="text-sm text-slate-400 mt-2">
                                  PDF файл
                                </p>
                              </div>
                            ) : (
                              <div className="p-4 bg-slate-950/60 border border-slate-700 rounded-lg text-center">
                                <span className="text-4xl">📎</span>
                                <p className="text-sm text-slate-400 mt-2">
                                  Файл хавсаргасан
                                </p>
                              </div>
                            )}
                            <a
                              href={fileUrl}
                              download={`submission-${sub.studentName}-${fileIndex + 1}.file`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 hover:text-blue-300 text-sm transition-colors mt-2"
                            >
                              ↓ Файл нээх / татах
                            </a>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {sub.feedback && (
                      <div className="whitespace-pre-line break-words p-3 bg-slate-900/60 rounded-lg text-sm leading-7 text-slate-300">
                        <span className="font-semibold">Санал: </span>
                        {sub.feedback}
                      </div>
                    )}

                    {/* Grading Form */}
                    {isTeacher && gradingSubmissionId === sub.id && (
                      <Modal
                        open={gradingSubmissionId === sub.id}
                        onClose={() => {
                          setGradingSubmissionId(null);
                          setSubmitError(null);
                        }}
                        title={`${sub.studentName} — үнэлгээ`}
                        busy={grading}
                      >
                        <div className="space-y-4">
                          <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg mb-2">
                            <span className="text-lg">ℹ️</span>
                            <div className="flex-1">
                              <p className="text-sm text-blue-300 font-medium mb-1">
                                Файлыг шалгаад оноо өгнө үү
                              </p>
                              <p className="text-sm text-blue-400/80">
                                Оноо болон XP-г та өөрөө шийднэ. Сурагч таны
                                өгсөн XP-г шууд авна.
                              </p>
                            </div>
                          </div>
                          <h4 className="text-sm font-semibold text-violet-300">
                            Оноо өгөх
                          </h4>
                          <div>
                            <label htmlFor="grade-score" className="mv-label">
                              Оноо (0-100)
                              <span className="text-slate-400 ml-1">
                                - Ажлын чанараар
                              </span>
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              id="grade-score"
                              disabled={grading}
                              value={gradeScore}
                              onChange={(e) =>
                                setGradeScore(Number(e.target.value))
                              }
                              className="mv-field"
                            />
                          </div>
                          <div>
                            <label htmlFor="grade-xp" className="mv-label">
                              Урамшууллын XP (0–500)
                              <span className="text-slate-400 ml-1">
                                - Та шийднэ
                              </span>
                            </label>
                            <div className="flex flex-wrap gap-2 mb-2">
                              <button
                                type="button"
                                disabled={grading}
                                aria-pressed={gradeXP === 20}
                                onClick={() => setGradeXP(20)}
                                className="min-h-11 px-2 py-1 rounded text-sm bg-slate-700 hover:bg-slate-600 text-slate-300"
                              >
                                20 XP
                              </button>
                              <button
                                type="button"
                                disabled={grading}
                                aria-pressed={gradeXP === 50}
                                onClick={() => setGradeXP(50)}
                                className="min-h-11 px-2 py-1 rounded text-sm bg-slate-700 hover:bg-slate-600 text-slate-300"
                              >
                                50 XP
                              </button>
                              <button
                                type="button"
                                disabled={grading}
                                aria-pressed={gradeXP === 100}
                                onClick={() => setGradeXP(100)}
                                className="min-h-11 px-2 py-1 rounded text-sm bg-slate-700 hover:bg-slate-600 text-slate-300"
                              >
                                100 XP
                              </button>
                              <button
                                type="button"
                                disabled={grading}
                                aria-pressed={gradeXP === 200}
                                onClick={() => setGradeXP(200)}
                                className="min-h-11 px-2 py-1 rounded text-sm bg-slate-700 hover:bg-slate-600 text-slate-300"
                              >
                                200 XP
                              </button>
                            </div>
                            <input
                              type="number"
                              min="0"
                              max="500"
                              id="grade-xp"
                              disabled={grading}
                              value={gradeXP}
                              onChange={(e) =>
                                setGradeXP(Number(e.target.value))
                              }
                              className="mv-field"
                            />
                          </div>
                          <div>
                            <label
                              htmlFor="grade-feedback"
                              className="mv-label"
                            >
                              Санал (заавал биш)
                            </label>
                            <textarea
                              id="grade-feedback"
                              disabled={grading}
                              value={gradeFeedback}
                              onChange={(e) => setGradeFeedback(e.target.value)}
                              rows={2}
                              className="mv-field"
                              placeholder="Сайн ажил! Үргэлжлүүлээрэй..."
                            />
                          </div>
                          {submitError && (
                            <p
                              role="alert"
                              className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-200"
                            >
                              {submitError}
                            </p>
                          )}
                          <div className="flex gap-2">
                            <button
                              onClick={handleGradeSubmission}
                              disabled={grading}
                              className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-violet-500 to-purple-500 text-white text-sm font-medium disabled:opacity-60 transition-all hover:shadow-lg"
                            >
                              {grading
                                ? "Хадгалж байна..."
                                : `✓ Оноо өгөх (+${gradeXP} XP)`}
                            </button>
                            <button
                              disabled={grading}
                              onClick={() => {
                                setGradingSubmissionId(null);
                                setGradeScore(100);
                                setGradeXP(50);
                                setGradeFeedback("");
                                setSubmitError(null);
                              }}
                              className="min-h-11 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm transition-colors"
                            >
                              Болих
                            </button>
                          </div>
                        </div>
                      </Modal>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
