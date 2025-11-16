"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { NeonLayout } from "../../../components/layout/NeonLayout";
import { useSession } from "../../../components/auth/useSession";
import Link from "next/link";

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
  fileUrl?: string;
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

export default function LessonDetailPage() {
  const { session } = useSession();
  const params = useParams();
  const router = useRouter();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);

  // Submission states
  const [showSubmitSection, setShowSubmitSection] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [fileToUpload, setFileToUpload] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showRewardPopup, setShowRewardPopup] = useState(false);
  const [rewardMessage, setRewardMessage] = useState("");

  // Grading states
  const [gradingSubmissionId, setGradingSubmissionId] = useState<string | null>(null);
  const [gradeScore, setGradeScore] = useState(100);
  const [gradeXP, setGradeXP] = useState(50);
  const [gradeFeedback, setGradeFeedback] = useState("");
  const [grading, setGrading] = useState(false);

  useEffect(() => {
    async function fetchLesson() {
      try {
        const res = await fetch(`/api/lessons/${params.id}`);
        if (res.ok) {
          const json = await res.json();
          setLesson(json.lesson);
          setSelectedAnswers(new Array(json.lesson.questions.length).fill(-1));
        } else {
          router.push("/lessons");
        }
      } catch (err) {
        console.error("Failed to fetch lesson:", err);
        router.push("/lessons");
      } finally {
        setLoading(false);
      }
    }
    fetchLesson();
  }, [params.id, router]);

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

  function submitQuiz() {
    if (!lesson) return;
    let correct = 0;
    lesson.questions.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.correctAnswer) {
        correct++;
      }
    });
    setScore(correct);
    setShowResults(true);
  }

  function resetQuiz() {
    setCurrentQuestion(0);
    setSelectedAnswers(new Array(lesson?.questions.length || 0).fill(-1));
    setShowResults(false);
    setScore(0);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setSubmitError(null);

    if (file.size > 10 * 1024 * 1024) {
      setSubmitError("Файлын хэмжээ 10MB-аас бага байх ёстой");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setFilePreview(result);
      setFileToUpload(result);
    };
    reader.onerror = () => {
      setSubmitError("Файл уншихад алдаа гарлаа");
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmitWork() {
    if (!session || !lesson) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch(`/api/lessons/${lesson.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileUrl: fileToUpload }),
      });

      if (!res.ok) {
        const json = await res.json();
        setSubmitError(json.error || "Алдаа гарлаа");
        return;
      }

      const json = await res.json();
      setRewardMessage("Амжилттай илгээлээ! Багш таны ажлыг шалгаад XP өгнө.");
      setShowRewardPopup(true);
      
      setTimeout(() => {
        setShowRewardPopup(false);
        setShowSubmitSection(false);
        setFilePreview(null);
        setFileToUpload(null);
        // Refresh lesson data
        fetch(`/api/lessons/${params.id}`)
          .then(r => r.json())
          .then(json => setLesson(json.lesson));
      }, 3000);

    } catch (err: any) {
      setSubmitError(err.message || "Сүлжээний алдаа гарлаа");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGradeSubmission() {
    if (!session || !lesson || !gradingSubmissionId) return;

    setGrading(true);
    setSubmitError(null);

    try {
      const res = await fetch(`/api/lessons/${lesson.id}/grade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: gradingSubmissionId,
          score: gradeScore,
          rewardXP: gradeXP,
          feedback: gradeFeedback,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        setSubmitError(json.error || "Алдаа гарлаа");
        return;
      }

      const json = await res.json();
      setRewardMessage(`Сурагчид ${gradeXP} XP өглөө! 🏆`);
      setShowRewardPopup(true);
      
      setTimeout(() => {
        setShowRewardPopup(false);
        setGradingSubmissionId(null);
        setGradeScore(100);
        setGradeXP(50);
        setGradeFeedback("");
        // Refresh lesson data
        fetch(`/api/lessons/${params.id}`)
          .then(r => r.json())
          .then(json => setLesson(json.lesson));
      }, 3000);

    } catch (err: any) {
      setSubmitError(err.message || "Сүлжээний алдаа гарлаа");
    } finally {
      setGrading(false);
    }
  }

  if (loading) {
    return (
      <NeonLayout>
        <div className="text-center py-8">
          <p className="text-slate-400">Loading...</p>
        </div>
      </NeonLayout>
    );
  }

  if (!lesson) {
    return null;
  }

  const currentQ = lesson.questions[currentQuestion];
  const allAnswered = selectedAnswers.every(a => a !== -1);
  const isTeacher = session?.role === "teacher";
  const isAuthor = session?.email === lesson.authorEmail;
  const isStudent = session?.role === "student";
  const mySubmission = lesson.submissions?.find(s => s.studentEmail === session?.email);
  const canSubmit = isStudent && !mySubmission;

  if (showResults) {
    const percentage = Math.round((score / lesson.questions.length) * 100);
    return (
      <NeonLayout>
        <div className="max-w-3xl mx-auto space-y-6">
          <Link href="/lessons" className="text-sm text-violet-400 hover:text-violet-300">
            ← Буцах
          </Link>

          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl px-8 py-8 text-center">
            <h2 className="text-2xl font-bold mb-4">Үр дүн</h2>
            <div className="text-6xl font-bold mb-4 bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
              {percentage}%
            </div>
            <p className="text-lg mb-6">
              {score} / {lesson.questions.length} зөв хариулт
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={resetQuiz}
                className="px-6 py-2 rounded-lg border border-violet-500 text-violet-400 hover:bg-violet-500/10 transition-colors"
              >
                Дахин шалгах
              </button>
              <Link
                href="/lessons"
                className="px-6 py-2 rounded-lg bg-gradient-to-r from-violet-500 to-purple-500 text-white hover:shadow-lg transition-shadow"
              >
                Бусад хичээл
              </Link>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Дэлгэрэнгүй үр дүн</h3>
            {lesson.questions.map((q, idx) => {
              const isCorrect = selectedAnswers[idx] === q.correctAnswer;
              return (
                <div
                  key={q.id}
                  className={`bg-slate-900/40 border rounded-2xl px-6 py-4 ${
                    isCorrect ? "border-green-500/50" : "border-red-500/50"
                  }`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-2xl">{isCorrect ? "✅" : "❌"}</span>
                    <div className="flex-1">
                      <p className="font-medium mb-2">{q.question}</p>
                      <p className="text-sm text-slate-400">
                        Таны хариулт: <span className={isCorrect ? "text-green-400" : "text-red-400"}>{q.options[selectedAnswers[idx]]}</span>
                      </p>
                      {!isCorrect && (
                        <p className="text-sm text-slate-400">
                          Зөв хариулт: <span className="text-green-400">{q.options[q.correctAnswer]}</span>
                        </p>
                      )}
                      {q.explanation && (
                        <p className="text-sm text-slate-500 mt-2 italic">💡 {q.explanation}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </NeonLayout>
    );
  }

  return (
    <NeonLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <Link href="/lessons" className="text-sm text-violet-400 hover:text-violet-300">
          ← Буцах
        </Link>

        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl px-6 py-5">
          <h1 className="text-2xl font-bold mb-2">{lesson.title}</h1>
          <p className="text-slate-400 mb-4">{lesson.description}</p>
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <span>👤 {lesson.authorName}</span>
            <span>📝 {lesson.questions.length} асуулт</span>
          </div>

          {lesson.files && lesson.files.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-700">
              <h3 className="text-sm font-medium text-slate-300 mb-2">📎 Хавсаргасан файлууд</h3>
              <div className="space-y-2">
                {lesson.files.map((file) => (
                  <a
                    key={file.id}
                    href={file.fileUrl}
                    download={file.fileName}
                    className="flex items-center justify-between gap-2 bg-slate-950/60 border border-slate-700 hover:border-violet-500 rounded-lg px-3 py-2 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-300 truncate group-hover:text-violet-300 transition-colors">{file.fileName}</p>
                      <p className="text-xs text-slate-500">{(file.fileSize / 1024).toFixed(1)} KB</p>
                    </div>
                    <span className="text-xs text-violet-400">Татах</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <span className="text-sm text-slate-400">
              Асуулт {currentQuestion + 1} / {lesson.questions.length}
            </span>
            <div className="flex gap-1">
              {lesson.questions.map((_, idx) => (
                <div
                  key={idx}
                  className={`w-2 h-2 rounded-full ${
                    selectedAnswers[idx] !== -1 ? "bg-violet-500" : "bg-slate-700"
                  }`}
                />
              ))}
            </div>
          </div>

          <h2 className="text-lg font-semibold mb-4">{currentQ.question}</h2>

          <div className="space-y-3 mb-6">
            {currentQ.options.map((option, idx) => (
              <button
                key={idx}
                onClick={() => handleAnswer(idx)}
                className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                  selectedAnswers[currentQuestion] === idx
                    ? "border-violet-500 bg-violet-500/10"
                    : "border-slate-700 hover:border-slate-600"
                }`}
              >
                <span className="text-sm">{option}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={previousQuestion}
              disabled={currentQuestion === 0}
              className="px-4 py-2 rounded-lg border border-slate-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors"
            >
              ← Өмнөх
            </button>

            {currentQuestion === lesson.questions.length - 1 ? (
              <button
                onClick={submitQuiz}
                disabled={!allAnswered}
                className="px-6 py-2 rounded-lg bg-gradient-to-r from-violet-500 to-purple-500 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-shadow"
              >
                Дуусгах
              </button>
            ) : (
              <button
                onClick={nextQuestion}
                disabled={selectedAnswers[currentQuestion] === -1}
                className="px-4 py-2 rounded-lg bg-violet-500 text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-violet-600 transition-colors"
              >
                Дараах →
              </button>
            )}
          </div>
        </div>

        {/* Reward Popup */}
        {showRewardPopup && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="bg-gradient-to-br from-violet-900/90 to-purple-900/90 border-2 border-violet-400 rounded-3xl px-8 py-10 max-w-md text-center shadow-[0_0_60px_rgba(139,92,246,0.6)] animate-pulse">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-2xl font-bold text-white mb-2">Баяр хүргэе!</h2>
              <p className="text-lg text-violet-200">{rewardMessage}</p>
              <div className="flex items-center justify-center gap-2 text-xl font-bold text-yellow-300 mt-4">
                <span>✨</span>
                <span>Амжилт хүсье!</span>
                <span>✨</span>
              </div>
            </div>
          </div>
        )}

        {/* Student Submission Section */}
        {canSubmit && (
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl px-6 py-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Даалгавраа илгээх</h2>
              {!showSubmitSection && (
                <button
                  onClick={() => setShowSubmitSection(true)}
                  className="px-4 py-2 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-sm transition-colors"
                >
                  Ажил илгээх
                </button>
              )}
            </div>
            
            {showSubmitSection && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Файл оруулах (заавал биш)</label>
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-violet-500/20 file:text-violet-300 hover:file:bg-violet-500/30 file:cursor-pointer"
                  />
                  {filePreview && (
                    <div className="mt-2 p-2 bg-slate-950/60 rounded-lg text-xs text-green-400">
                      ✓ Файл бэлэн байна
                    </div>
                  )}
                </div>
                {submitError && <p className="text-xs text-red-400">{submitError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={handleSubmitWork}
                    disabled={submitting}
                    className="px-6 py-2 rounded-lg bg-gradient-to-r from-violet-500 to-purple-500 text-white text-sm font-medium shadow-[0_4px_16px_rgba(139,92,246,0.4)] hover:shadow-[0_6px_20px_rgba(139,92,246,0.6)] disabled:opacity-60 transition-all"
                  >
                    {submitting ? "Илгээж байна..." : "Илгээх"}
                  </button>
                  <button
                    onClick={() => {
                      setShowSubmitSection(false);
                      setFilePreview(null);
                      setFileToUpload(null);
                      setSubmitError(null);
                    }}
                    className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm transition-colors"
                  >
                    Болих
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* My Submission Status */}
        {mySubmission && (
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl px-6 py-5">
            <h2 className="text-lg font-semibold mb-4">Таны submission</h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Илгээсэн:</span>
                <span className="text-slate-200">{new Date(mySubmission.submittedAt).toLocaleString("mn-MN")}</span>
              </div>
              {mySubmission.score !== null && mySubmission.score !== undefined ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Оноо:</span>
                    <span className="text-xl font-bold text-violet-400">{mySubmission.score}/100</span>
                  </div>
                  {(mySubmission.rewardXP !== null && mySubmission.rewardXP !== undefined) && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">XP:</span>
                      <span className="text-xl font-bold text-yellow-400">+{mySubmission.rewardXP} XP 🎉</span>
                    </div>
                  )}
                  {mySubmission.feedback && (
                    <div className="mt-3 p-3 bg-slate-950/60 rounded-lg">
                      <p className="text-xs text-slate-400 mb-1">Багшийн санал:</p>
                      <p className="text-sm text-slate-300">{mySubmission.feedback}</p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-yellow-400">⏳ Багш таны ажлыг шалгаж байна...</p>
              )}
            </div>
          </div>
        )}

        {/* Teacher: View Submissions */}
        {isTeacher && lesson.submissions && lesson.submissions.length > 0 && (
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl px-6 py-5">
            <h2 className="text-lg font-semibold mb-4">
              Сурагчдын submission ({lesson.submissions.length})
              {!isAuthor && <span className="text-xs text-slate-500 ml-2">(Бусад багшийн хичээл)</span>}
            </h2>
            {/* Debug info */}
            <div className="mb-4 p-3 bg-slate-950/60 border border-yellow-500/30 rounded-lg text-xs space-y-1">
              <p className="text-yellow-400">🔍 Debug мэдээлэл:</p>
              <p className="text-slate-300">Таны email: <span className="text-violet-400">{session?.email}</span></p>
              <p className="text-slate-300">Хичээлийн эзэн: <span className="text-violet-400">{lesson.authorEmail}</span></p>
              <p className="text-slate-300">Багш эсэх: <span className={isTeacher ? "text-green-400" : "text-red-400"}>{isTeacher ? "Тийм ✓" : "Үгүй ✗"}</span></p>
              <p className="text-slate-300">Эзэн эсэх: <span className={isAuthor ? "text-green-400" : "text-red-400"}>{isAuthor ? "Тийм ✓" : "Үгүй ✗"}</span></p>
            </div>
            <div className="space-y-4">
              {lesson.submissions.map((sub) => {
                // Debug log
                console.log('Submission data:', {
                  id: sub.id,
                  studentName: sub.studentName,
                  score: sub.score,
                  scoreType: typeof sub.score,
                  rewardXP: sub.rewardXP,
                  rewardXPType: typeof sub.rewardXP
                });
                
                return (
                <div key={sub.id} className="bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-4 hover:border-slate-600 transition-colors">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center text-sm font-bold">
                        {sub.studentName[0]?.toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold">{sub.studentName}</h3>
                        <p className="text-xs text-slate-500">
                          📅 {new Date(sub.submittedAt).toLocaleString("mn-MN")}
                        </p>
                      </div>
                    </div>
                    {sub.score !== null && sub.score !== undefined ? (
                      <div className="text-right">
                        <div className="text-lg font-bold text-violet-400">{sub.score}/100</div>
                        <div className="text-sm text-yellow-400">+{sub.rewardXP || 0} XP</div>
                        <div className="text-[10px] text-green-400 mt-1">✓ Оноолсон</div>
                        {isTeacher && (
                          <button
                            onClick={() => {
                              setGradingSubmissionId(sub.id);
                              setGradeScore(sub.score);
                              setGradeXP(sub.rewardXP || 50);
                              setGradeFeedback(sub.feedback || "");
                            }}
                            className="mt-2 px-3 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-[10px] transition-colors"
                          >
                            ✏️ Засах
                          </button>
                        )}
                      </div>
                    ) : isTeacher ? (
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => setGradingSubmissionId(sub.id)}
                          className="px-4 py-2 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-xs font-medium transition-colors shadow-lg"
                        >
                          📝 Оноо өгөх
                        </button>
                        <span className="text-[10px] text-yellow-400 text-center">Шалгах хэрэгтэй</span>
                      </div>
                    ) : (
                      <div className="text-right">
                        <div className="text-xs text-slate-500">Оноо хүлээгдэж байна</div>
                      </div>
                    )}
                  </div>

                  {sub.fileUrl && (
                    <div className="mb-3 space-y-2">
                      {/* File Preview */}
                      {sub.fileUrl.startsWith('data:image/') ? (
                        <div className="border border-slate-700 rounded-lg overflow-hidden">
                          <img 
                            src={sub.fileUrl} 
                            alt="Submission"
                            className="w-full max-h-96 object-contain bg-slate-950"
                          />
                        </div>
                      ) : sub.fileUrl.startsWith('data:application/pdf') ? (
                        <div className="p-4 bg-slate-950/60 border border-slate-700 rounded-lg text-center">
                          <span className="text-4xl">📄</span>
                          <p className="text-xs text-slate-400 mt-2">PDF файл</p>
                        </div>
                      ) : (
                        <div className="p-4 bg-slate-950/60 border border-slate-700 rounded-lg text-center">
                          <span className="text-4xl">📎</span>
                          <p className="text-xs text-slate-400 mt-2">Файл хавсаргасан</p>
                        </div>
                      )}
                      <a 
                        href={sub.fileUrl} 
                        download={`submission-${sub.studentName}.file`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 hover:text-blue-300 text-xs transition-colors"
                      >
                        � Татаж авах
                      </a>
                    </div>
                  )}

                  {sub.feedback && (
                    <div className="p-2 bg-slate-900/60 rounded-lg text-xs text-slate-400">
                      <span className="font-semibold">Санал: </span>{sub.feedback}
                    </div>
                  )}

                  {/* Grading Form */}
                  {isTeacher && gradingSubmissionId === sub.id && (
                    <div className="mt-4 p-4 bg-slate-900/80 border border-violet-500/30 rounded-lg space-y-3">
                      <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg mb-2">
                        <span className="text-lg">ℹ️</span>
                        <div className="flex-1">
                          <p className="text-xs text-blue-300 font-medium mb-1">Файлыг шалгаад оноо өгнө үү</p>
                          <p className="text-[10px] text-blue-400/80">
                            Оноо болон XP-г та өөрөө шийднэ. Сурагч таны өгсөн XP-г шууд авна.
                          </p>
                        </div>
                      </div>
                      <h4 className="text-sm font-semibold text-violet-300">Оноо өгөх</h4>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">
                          Оноо (0-100) 
                          <span className="text-slate-500 ml-1">- Ажлын чанараар</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={gradeScore}
                          onChange={(e) => setGradeScore(Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-700 text-sm focus:outline-none focus:border-violet-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">
                          Reward XP (0-500)
                          <span className="text-slate-500 ml-1">- Та шийднэ</span>
                        </label>
                        <div className="flex gap-2 mb-2">
                          <button
                            type="button"
                            onClick={() => setGradeXP(20)}
                            className="px-2 py-1 rounded text-[10px] bg-slate-700 hover:bg-slate-600 text-slate-300"
                          >
                            20 XP
                          </button>
                          <button
                            type="button"
                            onClick={() => setGradeXP(50)}
                            className="px-2 py-1 rounded text-[10px] bg-slate-700 hover:bg-slate-600 text-slate-300"
                          >
                            50 XP
                          </button>
                          <button
                            type="button"
                            onClick={() => setGradeXP(100)}
                            className="px-2 py-1 rounded text-[10px] bg-slate-700 hover:bg-slate-600 text-slate-300"
                          >
                            100 XP
                          </button>
                          <button
                            type="button"
                            onClick={() => setGradeXP(200)}
                            className="px-2 py-1 rounded text-[10px] bg-slate-700 hover:bg-slate-600 text-slate-300"
                          >
                            200 XP
                          </button>
                        </div>
                        <input
                          type="number"
                          min="0"
                          max="500"
                          value={gradeXP}
                          onChange={(e) => setGradeXP(Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-700 text-sm focus:outline-none focus:border-violet-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Санал (заавал биш)</label>
                        <textarea
                          value={gradeFeedback}
                          onChange={(e) => setGradeFeedback(e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-700 text-sm focus:outline-none focus:border-violet-500 resize-none"
                          placeholder="Сайн ажил! Үргэлжлүүлээрэй..."
                        />
                      </div>
                      {submitError && <p className="text-xs text-red-400">{submitError}</p>}
                      <div className="flex gap-2">
                        <button
                          onClick={handleGradeSubmission}
                          disabled={grading}
                          className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-violet-500 to-purple-500 text-white text-xs font-medium disabled:opacity-60 transition-all hover:shadow-lg"
                        >
                          {grading ? "Хадгалж байна..." : `✓ Оноо өгөх (+${gradeXP} XP)`}
                        </button>
                        <button
                          onClick={() => {
                            setGradingSubmissionId(null);
                            setGradeScore(100);
                            setGradeXP(50);
                            setGradeFeedback("");
                            setSubmitError(null);
                          }}
                          className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs transition-colors"
                        >
                          Болих
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
              })}
            </div>
          </div>
        )}
      </div>
    </NeonLayout>
  );
}
