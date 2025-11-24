"use client";

import { useState, useEffect } from "react";
import { useSession } from "../../components/auth/useSession";
import { NeonLayout } from "../../components/layout/NeonLayout";
import Link from "next/link";

type Lesson = {
  id: string;
  title: string;
  description: string;
  authorName: string;
  authorEmail: string;
  targetGrades?: string[];
  questions: any[];
  files?: any[];
  createdAt: string;
};

type QuestionInput = {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
};

type FileInput = {
  id: string;
  fileName: string;
  fileType: string;
  fileUrl: string;
  fileSize: number;
};

export default function LessonsPage() {
  const { session } = useSession();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  
  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetGrades, setTargetGrades] = useState<string[]>([]); // [] means all grades
  const [questions, setQuestions] = useState<QuestionInput[]>([
    { question: "", options: ["", "", "", ""], correctAnswer: 0, explanation: "" }
  ]);
  const [files, setFiles] = useState<FileInput[]>([]);
  const [creating, setCreating] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLessons();
  }, []);

  async function fetchLessons() {
    try {
      const res = await fetch("/api/lessons");
      if (res.ok) {
        const json = await res.json();
        // Defensive: always array, always targetGrades is array
        const lessonsArr = Array.isArray(json.lessons) ? json.lessons : [];
        setLessons(
          lessonsArr.map(l => ({
            ...l,
            targetGrades: Array.isArray(l.targetGrades) ? l.targetGrades : [],
            questions: Array.isArray(l.questions) ? l.questions : [],
            files: Array.isArray(l.files) ? l.files : [],
          }))
        );
      } else {
        setLessons([]);
      }
    } catch (err) {
      console.error("Failed to fetch lessons:", err);
      setLessons([]);
    } finally {
      setLoading(false);
    }
  }

  function addQuestion() {
    setQuestions([...questions, { question: "", options: ["", "", "", ""], correctAnswer: 0, explanation: "" }]);
  }

  function removeQuestion(index: number) {
    if (questions.length > 1) {
      setQuestions(questions.filter((_, i) => i !== index));
    }
  }

  function updateQuestion(index: number, field: keyof QuestionInput, value: any) {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };
    setQuestions(updated);
  }

  function updateOption(qIndex: number, optIndex: number, value: string) {
    const updated = [...questions];
    updated[qIndex].options[optIndex] = value;
    setQuestions(updated);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) return;

    setError(null);

    setUploadingFiles(true);
    const newFiles: FileInput[] = [];

    try {
      for (const file of Array.from(uploadedFiles)) {
        // Max 50MB per file to stay within DB + CDN limits
        if (file.size > 50 * 1024 * 1024) {
          const mb = (file.size / (1024 * 1024)).toFixed(1);
          setError(`Файл хэт том байна: ${file.name} (${mb}MB > 50MB)`);
          continue;
        }

        const baseInfo = {
          id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          fileName: file.name,
          fileType: file.type || "application/octet-stream",
          fileSize: file.size,
        };

        // Try Cloudinary (allows any file type and avoids huge payloads)
        try {
          const signRes = await fetch("/api/uploads/sign", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ folder: "neoncanvas/lessons" }),
          });

          if (signRes.ok) {
            const signJson = await signRes.json();
            if (signJson?.ok && signJson.cloudName && signJson.apiKey && signJson.signature) {
              const form = new FormData();
              form.append("file", file);
              form.append("api_key", signJson.apiKey);
              form.append("timestamp", String(signJson.timestamp));
              form.append("signature", signJson.signature);
              form.append("folder", signJson.folder || "neoncanvas/lessons");

              const uploadRes = await fetch(
                `https://api.cloudinary.com/v1_1/${signJson.cloudName}/auto/upload`,
                { method: "POST", body: form }
              );

              if (!uploadRes.ok) {
                throw new Error(`Upload failed with ${uploadRes.status}`);
              }

              const uploadJson = await uploadRes.json();
              if (!uploadJson?.secure_url) {
                throw new Error("No secure_url returned");
              }

              newFiles.push({
                ...baseInfo,
                fileType:
                  file.type ||
                  (uploadJson.resource_type && uploadJson.format
                    ? `${uploadJson.resource_type}/${uploadJson.format}`
                    : "application/octet-stream"),
                fileUrl: uploadJson.secure_url,
              });
              continue;
            }
          }

          throw new Error("Signing failed");
        } catch (cloudErr) {
          // Avoid pushing large base64 bodies to the API (causes 413). Require Cloudinary for >0 files.
          console.error("Cloudinary upload failed:", cloudErr);
          setError("Файл байршуулж чадсангүй. Cloudinary тохиргоогоо шалгана уу эсвэл файлаа багасгаарай.");
          continue;
        }
      }

      if (newFiles.length > 0) {
        setFiles((prev) => [...prev, ...newFiles]);
      }
    } finally {
      setUploadingFiles(false);
      // Allow uploading the same file again if needed
      e.target.value = "";
    }
  }

  function removeFile(fileId: string) {
    setFiles(files.filter(f => f.id !== fileId));
  }

  async function handleCreateLesson(e: React.FormEvent) {
    e.preventDefault();
    if (uploadingFiles) {
      setError("Файл байршиж байна, түр хүлээгээд дахин оролдоно уу.");
      return;
    }
    setError(null);
    setCreating(true);

    try {
      const endpoint = editingLessonId ? `/api/lessons/${editingLessonId}` : "/api/lessons";
      const method = editingLessonId ? "PUT" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, targetGrades, questions, files }),
      });

      const contentType = res.headers.get("content-type") || "";
      let json: any = null;
      if (contentType.includes("application/json")) {
        json = await res.json().catch(() => null);
      } else {
        const text = await res.text();
        if (res.status === 413) {
          setError("Илгээсэн өгөгдөл хэт том байна. Cloudinary тохиргоогоо шалгаад дахин оролдох эсвэл файлаа 50MB-аас багасгаарай.");
        } else {
          console.error("Non-JSON response from /api/lessons:", {
            status: res.status,
            preview: text?.slice(0, 200),
          });
          setError("Сервэрийн хариу буруу форматтай байна");
        }
        return;
      }

      if (!json) {
        setError("Сервэр хариу өгөөгүй байна");
        return;
      }

      if (!res.ok) {
        setError(json.error || "Алдаа гарлаа");
        return;
      }

      if (editingLessonId) {
        // Update existing lesson
        setLessons(lessons.map(l => l.id === editingLessonId ? json.lesson : l));
      } else {
        // Add new lesson
        setLessons([json.lesson, ...lessons]);
      }

      resetForm();
    } catch (err: any) {
      console.error("Create/update lesson error:", err);
      setError(err.message || "Сүлжээний алдаа гарлаа");
    } finally {
      setCreating(false);
    }
  }

  function resetForm() {
    setTitle("");
    setDescription("");
    setTargetGrades([]);
    setQuestions([{ question: "", options: ["", "", "", ""], correctAnswer: 0, explanation: "" }]);
    setFiles([]);
    setShowCreateForm(false);
    setEditingLessonId(null);
    setError(null);
  }

  function startEditLesson(lesson: Lesson) {
    setEditingLessonId(lesson.id);
    setTitle(lesson.title);
    setDescription(lesson.description);
    setTargetGrades((lesson as any).targetGrades || []);
    setQuestions(lesson.questions.map(q => ({
      question: q.question,
      options: [...q.options],
      correctAnswer: q.correctAnswer,
      explanation: q.explanation || ""
    })));
    setFiles(lesson.files || []);
    setShowCreateForm(true);
  }

  async function handleDeleteLesson(lessonId: string) {
    if (!confirm("Энэ хичээлийг устгах уу?")) return;

    try {
      const res = await fetch(`/api/lessons/${lessonId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const json = await res.json();
        alert(json.error || "Алдаа гарлаа");
        return;
      }

      setLessons(lessons.filter(l => l.id !== lessonId));
    } catch (err) {
      console.error("Delete lesson error:", err);
      alert("Сүлжээний алдаа гарлаа");
    }
  }

  return (
    <NeonLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Хичээлүүд</h1>
          {session && session.role === "teacher" && !showCreateForm && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-violet-500 to-purple-500 text-white text-sm font-medium shadow-[0_4px_16px_rgba(139,92,246,0.4)] hover:shadow-[0_6px_20px_rgba(139,92,246,0.6)] transition-all"
            >
              + Хичээл нэмэх
            </button>
          )}
        </div>

        {showCreateForm && session && session.role === "teacher" && (
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl px-6 py-5 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
            <h2 className="text-lg font-semibold mb-4">
              {editingLessonId ? "Хичээл засах" : "Шинэ хичээл үүсгэх"}
            </h2>
            <form onSubmit={handleCreateLesson} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Гарчиг</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg bg-slate-950/60 border border-slate-700 px-4 py-2 text-sm focus:outline-none focus:border-violet-500"
                  placeholder="Жишээ нь: React Basics"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Тайлбар</label>
                <textarea
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg bg-slate-950/60 border border-slate-700 px-4 py-2 text-sm focus:outline-none focus:border-violet-500 resize-none"
                  placeholder="Хичээлийн товч тайлбар"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">🎒 Зорилтот анги</label>
                <p className="text-xs text-slate-400 mb-3">Хэддүгээр ангийн сурагчдад зориулсан вэ? (Сонголтгүй бол бүх ангид харагдана)</p>
                <div className="flex flex-wrap gap-2">
                  {["10", "11", "12"].map((grade) => (
                    <button
                      key={grade}
                      type="button"
                      onClick={() => {
                        if (targetGrades.includes(grade)) {
                          setTargetGrades(targetGrades.filter(g => g !== grade));
                        } else {
                          setTargetGrades([...targetGrades, grade]);
                        }
                      }}
                      className={`px-4 py-2 rounded-lg border-2 text-sm font-semibold transition-all ${
                        targetGrades.includes(grade)
                          ? "border-violet-500 bg-violet-500/20 text-violet-200"
                          : "border-slate-700 text-slate-400 hover:border-slate-600"
                      }`}
                    >
                      {grade} анги
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setTargetGrades([])}
                    className={`px-4 py-2 rounded-lg border-2 text-sm font-semibold transition-all ${
                      targetGrades.length === 0
                        ? "border-green-500 bg-green-500/20 text-green-200"
                        : "border-slate-700 text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    ✨ Бүх анги
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Файлууд (PDF, зураг, video гэх мэт)</label>
                <div className="space-y-2">
                  <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 hover:border-violet-500 text-sm transition-colors">
                    📎 Файл нэмэх
                    <input
                      type="file"
                      multiple
                      onChange={handleFileUpload}
                      className="hidden"
                      accept="*/*"
                    />
                  </label>
                  {uploadingFiles && (
                    <p className="text-xs text-slate-400">Файл байршиж байна...</p>
                  )}
                  {files.length > 0 && (
                    <div className="space-y-2 mt-3">
                      {files.map((file) => (
                        <div key={file.id} className="flex items-center justify-between gap-2 bg-slate-950/60 border border-slate-700 rounded-lg px-3 py-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-300 truncate">{file.fileName}</p>
                            <p className="text-xs text-slate-500">{(file.fileSize / 1024).toFixed(1)} KB</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFile(file.id)}
                            className="text-red-400 hover:text-red-300 text-sm flex-shrink-0"
                          >
                            Устгах
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium">Асуултууд</label>
                  <button
                    type="button"
                    onClick={addQuestion}
                    className="px-3 py-1 rounded text-xs bg-slate-800 hover:bg-slate-700 transition-colors"
                  >
                    + Асуулт нэмэх
                  </button>
                </div>

                {questions.map((q, qIdx) => (
                  <div key={qIdx} className="border border-slate-700 rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <input
                          type="text"
                          required
                          value={q.question}
                          onChange={(e) => updateQuestion(qIdx, "question", e.target.value)}
                          className="w-full rounded bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                          placeholder={`Асуулт ${qIdx + 1}`}
                        />
                      </div>
                      {questions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeQuestion(qIdx)}
                          className="text-red-400 hover:text-red-300 text-sm"
                        >
                          Устгах
                        </button>
                      )}
                    </div>

                    <div className="space-y-2">
                      {q.options.map((opt, optIdx) => (
                        <div key={optIdx} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`correct-${qIdx}`}
                            checked={q.correctAnswer === optIdx}
                            onChange={() => updateQuestion(qIdx, "correctAnswer", optIdx)}
                            className="text-violet-500"
                          />
                          <input
                            type="text"
                            required
                            value={opt}
                            onChange={(e) => updateOption(qIdx, optIdx, e.target.value)}
                            className="flex-1 rounded bg-slate-950/60 border border-slate-700 px-3 py-1.5 text-sm focus:outline-none focus:border-violet-500"
                            placeholder={`Хариулт ${optIdx + 1}`}
                          />
                        </div>
                      ))}
                    </div>

                    <input
                      type="text"
                      value={q.explanation}
                      onChange={(e) => updateQuestion(qIdx, "explanation", e.target.value)}
                      className="w-full rounded bg-slate-950/60 border border-slate-700 px-3 py-1.5 text-sm focus:outline-none focus:border-violet-500"
                      placeholder="Тайлбар (заавал биш)"
                    />
                  </div>
                ))}
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 rounded-lg border border-slate-700 text-sm hover:bg-slate-800 transition-colors"
                >
                  Болих
                </button>
                <button
                  type="submit"
                  disabled={creating || uploadingFiles}
                  className="px-6 py-2 rounded-lg bg-gradient-to-r from-violet-500 to-purple-500 text-white text-sm font-medium disabled:opacity-60"
                >
                  {creating ? (editingLessonId ? "Хадгалж байна..." : "Үүсгэж байна...") : (editingLessonId ? "Хадгалах" : "Хичээл үүсгэх")}
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <p className="text-slate-400 text-sm">Loading...</p>
        ) : lessons.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl px-6 py-8 text-center">
            <p className="text-slate-400">Одоогоор хичээл байхгүй байна</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {lessons.map((lesson) => {
              const isAuthor = session?.email === lesson.authorEmail;
              
              return (
              <div key={lesson.id} className="bg-slate-900/40 border border-slate-800 rounded-2xl px-6 py-5 hover:border-violet-500/50 transition-all">
                <div className="flex items-start justify-between gap-4">
                  <Link href={`/lessons/${lesson.id}`} className="flex-1">
                    <h3 className="text-lg font-semibold text-slate-200 mb-2 hover:text-violet-300 transition-colors">{lesson.title}</h3>
                    <p className="text-sm text-slate-400 mb-3">{lesson.description}</p>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span>👤 {lesson.authorName}</span>
                      <span>📝 {lesson.questions.length} асуулт</span>
                      {lesson.files && lesson.files.length > 0 && (
                        <span>📎 {lesson.files.length} файл</span>
                      )}
                      <span>{new Date(lesson.createdAt).toLocaleDateString("mn-MN")}</span>
                    </div>
                  </Link>
                  <div className="flex flex-col gap-2">
                    <Link 
                      href={`/lessons/${lesson.id}`}
                      className="text-violet-400 text-sm hover:text-violet-300 transition-colors"
                    >
                      →
                    </Link>
                    {isAuthor && (
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            startEditLesson(lesson);
                          }}
                          className="px-3 py-1 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-xs transition-colors"
                          title="Засах"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            handleDeleteLesson(lesson.id);
                          }}
                          className="px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs transition-colors"
                          title="Устгах"
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
            })}
          </div>
        )}
      </div>
    </NeonLayout>
  );
}
