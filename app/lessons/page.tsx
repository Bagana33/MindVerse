"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSession } from "../../components/auth/useSession";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import Link from "next/link";
import Modal from "../../components/ui/Modal";
import { useSearchParams } from "next/navigation";
import { cachedFetch, invalidateCache } from "../../lib/fetchCache";

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

function normalizeDescription(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function LessonsContent() {
  const { session } = useSession();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(
    searchParams?.get("search") || "",
  );
  const searchQuery = searchInput.trim().toLowerCase();
  useEffect(() => {
    setSearchInput(searchParams?.get("search") || "");
  }, [searchParams]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadRequestRef = useRef(0);
  const mutationRef = useRef(false);
  const uploadRef = useRef(false);
  const [deleteTarget, setDeleteTarget] = useState<Lesson | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [notice, setNotice] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);

  const filteredLessons = searchQuery
    ? lessons.filter(
        (l) =>
          l.title.toLowerCase().includes(searchQuery) ||
          l.description.toLowerCase().includes(searchQuery) ||
          l.authorName.toLowerCase().includes(searchQuery) ||
          l.authorEmail.toLowerCase().includes(searchQuery),
      )
    : lessons;

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetGrades, setTargetGrades] = useState<string[]>([]); // [] means all grades
  const [questions, setQuestions] = useState<QuestionInput[]>([
    {
      question: "",
      options: ["", "", "", ""],
      correctAnswer: 0,
      explanation: "",
    },
  ]);
  const [files, setFiles] = useState<FileInput[]>([]);
  const [creating, setCreating] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLessons = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    setLoading(true);
    setLoadError(null);
    try {
      // The shared GET cache bounds the request at 15 seconds.
      const res = await cachedFetch("/api/lessons");
      if (!res.ok) throw new Error("lessons-unavailable");
      const json = await res.json();
      if (!json.ok || !Array.isArray(json.lessons))
        throw new Error("invalid-lessons-response");
      if (loadRequestRef.current === requestId) {
        // Defensive: always array, always targetGrades is array
        setLessons(
          json.lessons.map((l: any) => ({
            ...l,
            targetGrades: Array.isArray(l.targetGrades) ? l.targetGrades : [],
            questions: Array.isArray(l.questions) ? l.questions : [],
            files: Array.isArray(l.files) ? l.files : [],
          })),
        );
      }
    } catch {
      if (loadRequestRef.current === requestId)
        setLoadError(
          "Хичээлүүдийг ачаалж чадсангүй. Холболтоо шалгаад дахин оролдоно уу.",
        );
    } finally {
      if (loadRequestRef.current === requestId) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchLessons();
    return () => {
      loadRequestRef.current += 1;
    };
  }, [fetchLessons]);

  function addQuestion() {
    setQuestions([
      ...questions,
      {
        question: "",
        options: ["", "", "", ""],
        correctAnswer: 0,
        explanation: "",
      },
    ]);
  }

  function removeQuestion(index: number) {
    if (questions.length > 1) {
      setQuestions(questions.filter((_, i) => i !== index));
    }
  }

  function updateQuestion(
    index: number,
    field: keyof QuestionInput,
    value: any,
  ) {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };
    setQuestions(updated);
  }

  function updateOption(qIndex: number, optIndex: number, value: string) {
    setQuestions((current) =>
      current.map((question, index) =>
        index === qIndex
          ? {
              ...question,
              options: question.options.map((option, optionIndex) =>
                optionIndex === optIndex ? value : option,
              ),
            }
          : question,
      ),
    );
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const uploadedFiles = e.target.files;
    if (
      !uploadedFiles ||
      uploadedFiles.length === 0 ||
      uploadRef.current ||
      mutationRef.current
    )
      return;
    uploadRef.current = true;

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
            signal: AbortSignal.timeout(15000),
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ folder: "neoncanvas/lessons" }),
          });

          if (signRes.ok) {
            const signJson = await signRes.json();
            if (
              signJson?.ok &&
              signJson.cloudName &&
              signJson.apiKey &&
              signJson.signature
            ) {
              const form = new FormData();
              form.append("file", file);
              form.append("api_key", signJson.apiKey);
              form.append("timestamp", String(signJson.timestamp));
              form.append("signature", signJson.signature);
              form.append("folder", signJson.folder || "neoncanvas/lessons");

              // Use raw upload endpoint to avoid image-size caps on PSD/ZIP/etc.
              const uploadRes = await fetch(
                `https://api.cloudinary.com/v1_1/${signJson.cloudName}/raw/upload`,
                {
                  method: "POST",
                  body: form,
                  signal: AbortSignal.timeout(90000),
                },
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
          setError(
            "Файл байршуулж чадсангүй. Холболтоо шалгах эсвэл файлын хэмжээг багасгаад дахин оролдоорой.",
          );
          continue;
        }
      }

      if (newFiles.length > 0) {
        setFiles((prev) => [...prev, ...newFiles]);
      }
    } finally {
      uploadRef.current = false;
      setUploadingFiles(false);
      // Allow uploading the same file again if needed
      e.target.value = "";
    }
  }

  function removeFile(fileId: string) {
    setFiles(files.filter((f) => f.id !== fileId));
  }

  async function handleCreateLesson(e: React.FormEvent) {
    e.preventDefault();
    if (mutationRef.current) return;
    if (uploadingFiles) {
      setError("Файл байршиж байна, түр хүлээгээд дахин оролдоно уу.");
      return;
    }
    mutationRef.current = true;
    setError(null);
    setCreating(true);

    try {
      const endpoint = editingLessonId
        ? `/api/lessons/${editingLessonId}`
        : "/api/lessons";
      const method = editingLessonId ? "PUT" : "POST";

      const res = await fetch(endpoint, {
        method,
        signal: AbortSignal.timeout(30000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          targetGrades,
          questions,
          files,
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      let json: any = null;
      if (contentType.includes("application/json")) {
        json = await res.json().catch(() => null);
      } else {
        const text = await res.text();
        if (res.status === 413) {
          setError(
            "Илгээсэн өгөгдөл хэт том байна. Cloudinary тохиргоогоо шалгаад дахин оролдох эсвэл файлаа 50MB-аас багасгаарай.",
          );
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

      if (!res.ok || !json.ok || !json.lesson) {
        setError(json.error || "Алдаа гарлаа");
        return;
      }

      if (editingLessonId) {
        // Update existing lesson
        setLessons((current) =>
          current.map((l) => (l.id === editingLessonId ? json.lesson : l)),
        );
      } else {
        // Add new lesson
        setLessons((current) => [json.lesson, ...current]);
      }

      loadRequestRef.current += 1;
      setLoading(false);
      setLoadError(null);
      invalidateCache("/api/lessons");
      setNotice(
        editingLessonId
          ? "Хичээлийн өөрчлөлтийг хадгаллаа."
          : "Шинэ хичээл нэмэгдлээ.",
      );
      resetForm();
    } catch (err: any) {
      console.error("Create/update lesson error:", err);
      setError(
        ["TimeoutError", "TypeError", "AbortError", "SyntaxError"].includes(
          err?.name,
        )
          ? "Хариу ирсэнгүй. Дахин илгээхээс өмнө хичээлийн жагсаалтаа шинэчилж шалгана уу."
          : err.message || "Сүлжээний алдаа гарлаа",
      );
    } finally {
      mutationRef.current = false;
      setCreating(false);
    }
  }

  function resetForm() {
    setTitle("");
    setDescription("");
    setTargetGrades([]);
    setQuestions([
      {
        question: "",
        options: ["", "", "", ""],
        correctAnswer: 0,
        explanation: "",
      },
    ]);
    setFiles([]);
    setShowCreateForm(false);
    setEditingLessonId(null);
    setError(null);
  }

  function startEditLesson(lesson: Lesson) {
    setError(null);
    setEditingLessonId(lesson.id);
    setTitle(lesson.title);
    setDescription(lesson.description);
    setTargetGrades((lesson as any).targetGrades || []);
    setQuestions(
      lesson.questions.map((q) => ({
        question: q.question,
        options: [...q.options],
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || "",
      })),
    );
    setFiles(lesson.files || []);
    setShowCreateForm(true);
  }

  async function handleDeleteLesson() {
    if (!deleteTarget || mutationRef.current) return;
    mutationRef.current = true;
    setDeleting(true);
    setDeleteError("");
    try {
      const response = await fetch(`/api/lessons/${deleteTarget.id}`, {
        method: "DELETE",
        signal: AbortSignal.timeout(30000),
      });
      const json = await response.json();
      if (!response.ok || !json.ok)
        throw new Error(json.error || "Хичээлийг устгаж чадсангүй.");
      loadRequestRef.current += 1;
      setLoading(false);
      setLoadError(null);
      invalidateCache("/api/lessons");
      setLessons((current) =>
        current.filter((lesson) => lesson.id !== deleteTarget.id),
      );
      setDeleteTarget(null);
      setNotice("Хичээлийг устгалаа.");
    } catch {
      setDeleteError(
        "Устгалын хариу ирсэнгүй. Жагсаалтаа шинэчилж шалгана уу.",
      );
    } finally {
      mutationRef.current = false;
      setDeleting(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="mv-page space-y-6 xl:space-y-8">
        <header className="mv-page-header">
          <div>
            <p className="mv-eyebrow">СУРАЛЦАХ ОРОН ЗАЙ</p>
            <h1 className="mv-title">Хичээлүүд</h1>
            <p className="mv-subtitle">
              Сэдвээ ойлгож, мэдлэгээ сорьж, өөрийн бүтээл дээр туршаарай.
            </p>
          </div>
          {session && session.role === "teacher" && !showCreateForm && (
            <button
              onClick={() => {
                resetForm();
                setShowCreateForm(true);
              }}
              className="mv-button-primary"
            >
              + Хичээл нэмэх
            </button>
          )}
        </header>
        {notice && (
          <p
            role="status"
            className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-200"
          >
            {notice}
          </p>
        )}
        <div className="mv-panel flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="w-full min-w-0 lg:max-w-xl">
            <label htmlFor="lesson-search" className="mv-label">
              Хичээл хайх
            </label>
            <input
              id="lesson-search"
              type="search"
              className="mv-field min-w-0"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Хичээлийн нэр, сэдэв, багш…"
            />
          </div>
          <p
            className="shrink-0 text-sm leading-6 text-slate-400 lg:pb-3"
            aria-live="polite"
          >
            {loading ? (
              "Хичээлүүдийг ачаалж байна…"
            ) : (
              <>
                <span className="font-semibold text-slate-100">
                  {filteredLessons.length}
                </span>{" "}
                хичээл {searchQuery ? "олдлоо" : "үзэх боломжтой"}
              </>
            )}
          </p>
        </div>

        <Modal
          open={showCreateForm && session?.role === "teacher"}
          onClose={resetForm}
          title={editingLessonId ? "Хичээл засах" : "Шинэ хичээл"}
          wide
          busy={creating || uploadingFiles}
        >
          <form onSubmit={handleCreateLesson} className="space-y-5">
            <fieldset disabled={creating} className="space-y-5">
              <div>
                <label htmlFor="lesson-title" className="mv-label">
                  Гарчиг *
                </label>
                <input
                  type="text"
                  required
                  id="lesson-title"
                  maxLength={200}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mv-field min-w-0"
                  placeholder="Жишээ нь: Өнгөний зохицол"
                />
              </div>

              <div>
                <label htmlFor="lesson-description" className="mv-label">
                  Тайлбар *
                </label>
                <textarea
                  required
                  id="lesson-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="mv-field min-w-0"
                  placeholder="Хичээлээр юу сурч, ямар бүтээл хийхийг тайлбарлаарай…"
                />
              </div>

              <div>
                <h3 className="mv-label">Хамрагдах анги</h3>
                <p className="text-sm leading-6 text-slate-400 mb-3">
                  Хэддүгээр ангийн сурагчдад зориулсан вэ? (Сонголтгүй бол бүх
                  ангид харагдана)
                </p>
                <div className="flex flex-wrap gap-2">
                  {["9", "10", "11", "12"].map((grade) => (
                    <button
                      key={grade}
                      aria-pressed={targetGrades.includes(grade)}
                      type="button"
                      onClick={() => {
                        if (targetGrades.includes(grade)) {
                          setTargetGrades(
                            targetGrades.filter((g) => g !== grade),
                          );
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
                    aria-pressed={targetGrades.length === 0}
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
                <h3 className="mv-label">Хавсралт материал</h3>
                <p className="mb-3 text-sm text-slate-400">
                  PDF, зураг, видео болон бусад файл. Файл тус бүр 50 MB хүртэл.
                </p>
                <div className="space-y-2">
                  <label className="cursor-pointer focus-within:ring-2 focus-within:ring-violet-400 inline-flex min-h-11 items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 hover:border-violet-500 text-sm transition-colors">
                    Файл сонгох
                    <input
                      type="file"
                      multiple
                      onChange={handleFileUpload}
                      className="sr-only"
                      disabled={uploadingFiles || creating}
                      accept="*/*"
                    />
                  </label>
                  {uploadingFiles && (
                    <p role="status" className="text-xs text-slate-400">
                      Файл байршиж байна...
                    </p>
                  )}
                  {files.length > 0 && (
                    <div className="space-y-2 mt-3">
                      {files.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center justify-between gap-2 bg-slate-950/60 border border-slate-700 rounded-lg px-3 py-2"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-300 truncate">
                              {file.fileName}
                            </p>
                            <p className="text-sm text-slate-400">
                              {(file.fileSize / 1024).toFixed(1)} KB
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFile(file.id)}
                            className="min-h-11 rounded-lg px-3 text-red-400 hover:text-red-300 text-sm flex-shrink-0"
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
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-base font-semibold text-white">
                    Асуултууд
                  </h3>
                  <button
                    type="button"
                    onClick={addQuestion}
                    className="min-h-11 px-3 py-2 rounded-lg text-sm bg-slate-800 hover:bg-slate-700 transition-colors"
                  >
                    + Асуулт нэмэх
                  </button>
                </div>

                {questions.map((q, qIdx) => (
                  <div
                    key={qIdx}
                    className="border border-slate-700 rounded-lg p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <label
                          htmlFor={`lesson-question-${qIdx}`}
                          className="mv-label"
                        >
                          Асуулт {qIdx + 1} *
                        </label>
                        <input
                          id={`lesson-question-${qIdx}`}
                          type="text"
                          required
                          aria-label={`Асуулт ${qIdx + 1}`}
                          value={q.question}
                          onChange={(e) =>
                            updateQuestion(qIdx, "question", e.target.value)
                          }
                          className="mv-field min-w-0"
                          placeholder={`Асуулт ${qIdx + 1}`}
                        />
                      </div>
                      {questions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeQuestion(qIdx)}
                          className="min-h-11 shrink-0 rounded-lg px-3 text-red-400 hover:text-red-300 text-sm"
                        >
                          Устгах
                        </button>
                      )}
                    </div>

                    <p className="text-sm text-slate-400">
                      Зөв хариултын зүүн талын сонголтыг тэмдэглэнэ үү.
                    </p>
                    <div className="space-y-2">
                      {q.options.map((opt, optIdx) => (
                        <div key={optIdx} className="flex items-center gap-2">
                          <input
                            type="radio"
                            aria-label={`Асуулт ${qIdx + 1}: ${optIdx + 1}-р хариултыг зөвөөр тэмдэглэх`}
                            name={`correct-${qIdx}`}
                            checked={q.correctAnswer === optIdx}
                            onChange={() =>
                              updateQuestion(qIdx, "correctAnswer", optIdx)
                            }
                            className="h-5 w-5 shrink-0 accent-violet-500"
                          />
                          <input
                            type="text"
                            required
                            aria-label={`Асуулт ${qIdx + 1}, хариулт ${optIdx + 1}`}
                            value={opt}
                            onChange={(e) =>
                              updateOption(qIdx, optIdx, e.target.value)
                            }
                            className="mv-field min-w-0"
                            placeholder={`Хариулт ${optIdx + 1}`}
                          />
                        </div>
                      ))}
                    </div>

                    <input
                      type="text"
                      aria-label={`Асуулт ${qIdx + 1}-ийн тайлбар`}
                      value={q.explanation}
                      onChange={(e) =>
                        updateQuestion(qIdx, "explanation", e.target.value)
                      }
                      className="mv-field min-w-0"
                      placeholder="Тайлбар (заавал биш)"
                    />
                  </div>
                ))}
              </div>
            </fieldset>
            {error && (
              <p
                role="alert"
                className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-200"
              >
                {error}
              </p>
            )}

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={resetForm}
                disabled={creating || uploadingFiles}
                className="mv-button-secondary"
              >
                Болих
              </button>
              <button
                type="submit"
                disabled={creating || uploadingFiles}
                className="mv-button-primary"
              >
                {creating
                  ? editingLessonId
                    ? "Хадгалж байна..."
                    : "Үүсгэж байна..."
                  : editingLessonId
                    ? "Хадгалах"
                    : "Хичээл үүсгэх"}
              </button>
            </div>
          </form>
        </Modal>

        {loading ? (
          <p role="status" className="text-slate-400 text-sm">
            Хичээлүүдийг ачаалж байна…
          </p>
        ) : loadError ? (
          <div
            role="alert"
            className="rounded-2xl border border-rose-500/25 bg-rose-500/5 px-6 py-8 text-center"
          >
            <p className="text-sm leading-relaxed text-slate-300">
              {loadError}
            </p>
            <button
              type="button"
              onClick={() => {
                invalidateCache("/api/lessons");
                void fetchLessons();
              }}
              className="mt-4 min-h-11 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-500"
            >
              Дахин оролдох
            </button>
          </div>
        ) : filteredLessons.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl px-6 py-8 text-center">
            <p className="text-slate-400">
              {searchQuery
                ? `"${searchQuery}" хайлтаар хичээл олдсонгүй`
                : "Одоогоор хичээл байхгүй байна"}
            </p>
            {searchQuery && (
              <button
                type="button"
                className="mv-button-secondary mt-4"
                onClick={() => setSearchInput("")}
              >
                Хайлт цэвэрлэх
              </button>
            )}
          </div>
        ) : (
          <div className="grid items-stretch gap-5 xl:grid-cols-2 2xl:grid-cols-3">
            {filteredLessons.map((lesson) => {
              const isAuthor = session?.email === lesson.authorEmail;

              return (
                <article
                  key={lesson.id}
                  className="mv-panel flex min-w-0 flex-col p-5 transition-colors hover:border-violet-500/40 sm:p-6"
                >
                  <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
                    <span className="rounded-lg bg-violet-500/10 px-2.5 py-1 font-medium text-violet-200">
                      {lesson.questions.length} асуулт
                    </span>
                    {!!lesson.files?.length && (
                      <span className="text-slate-400">
                        {lesson.files.length} материал
                      </span>
                    )}
                  </div>
                  <Link
                    href={`/lessons/${lesson.id}`}
                    className="min-w-0 flex-1"
                  >
                    <h2 className="break-words text-xl font-semibold leading-7 tracking-tight text-white transition-colors hover:text-violet-300">
                      {lesson.title}
                    </h2>
                    <p className="mt-3 line-clamp-3 whitespace-pre-line break-words text-sm leading-7 text-slate-300">
                      {normalizeDescription(lesson.description)}
                    </p>
                  </Link>
                  <dl className="mt-6 grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-t border-white/10 pt-4 text-sm">
                    <div className="min-w-0">
                      <dt className="text-slate-400">Багш</dt>
                      <dd className="mt-1 break-words font-medium text-slate-200">
                        {lesson.authorName}
                      </dd>
                    </div>
                    <div className="text-right">
                      <dt className="text-slate-400">Нэмсэн</dt>
                      <dd className="mt-1 tabular-nums text-slate-300">
                        {new Date(lesson.createdAt).toLocaleDateString(
                          "mn-MN",
                          { year: "numeric", month: "2-digit", day: "2-digit" },
                        )}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
                    <Link
                      href={`/lessons/${lesson.id}`}
                      aria-label={`${lesson.title} хичээлийг нээх`}
                      className="mv-button-secondary"
                    >
                      Хичээл үзэх <span aria-hidden="true">→</span>
                    </Link>
                    {isAuthor && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => startEditLesson(lesson)}
                          className="min-h-11 rounded-lg px-3 text-sm text-sky-300 transition-colors hover:bg-sky-500/10"
                          aria-label={`${lesson.title} хичээлийг засах`}
                        >
                          Засах
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteTarget(lesson);
                            setDeleteError("");
                          }}
                          className="min-h-11 rounded-lg px-3 text-sm text-rose-300 transition-colors hover:bg-rose-500/10"
                          aria-label={`${lesson.title} хичээлийг устгах`}
                        >
                          Устгах
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Хичээл устгах"
        busy={deleting}
      >
        <p className="break-words text-slate-300">
          “{deleteTarget?.title}” хичээлийг устгах уу? Энэ үйлдлийг буцаах
          боломжгүй.
        </p>
        {deleteError && (
          <p role="alert" className="mt-3 text-sm text-rose-200">
            {deleteError}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            disabled={deleting}
            className="mv-button-secondary"
            onClick={() => setDeleteTarget(null)}
          >
            Болих
          </button>
          <button
            type="button"
            disabled={deleting}
            className="mv-button-primary !bg-rose-600"
            onClick={() => void handleDeleteLesson()}
          >
            {deleting ? "Устгаж байна…" : "Устгах"}
          </button>
        </div>
      </Modal>
    </DashboardLayout>
  );
}

export default function LessonsPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout>
          <div className="p-8 text-slate-400">Ачаалж байна...</div>
        </DashboardLayout>
      }
    >
      <LessonsContent />
    </Suspense>
  );
}
