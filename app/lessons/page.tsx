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
  
  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetGrades, setTargetGrades] = useState<string[]>([]); // [] means all grades
  const [questions, setQuestions] = useState<QuestionInput[]>([
    { question: "", options: ["", "", "", ""], correctAnswer: 0, explanation: "" }
  ]);
  const [files, setFiles] = useState<FileInput[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLessons();
  }, []);

  async function fetchLessons() {
    try {
      const res = await fetch("/api/lessons");
      if (res.ok) {
        const json = await res.json();
        setLessons(json.lessons || []);
      }
    } catch (err) {
      console.error("Failed to fetch lessons:", err);
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

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) return;

    setError(null);

    Array.from(uploadedFiles).forEach(file => {
      // Max 20MB per file
      if (file.size > 20 * 1024 * 1024) {
        setError(`Файл хэт том байна: ${file.name} (максимум 20MB)`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        const newFile: FileInput = {
          id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          fileName: file.name,
          fileType: file.type,
          fileUrl: result,
          fileSize: file.size,
        };
        setFiles(prev => [...prev, newFile]);
      };
      reader.onerror = () => {
        setError(`Файл уншихад алдаа гарлаа: ${file.name}`);
      };
      reader.readAsDataURL(file);
    });
  }

  function removeFile(fileId: string) {
    setFiles(files.filter(f => f.id !== fileId));
  }

  async function handleCreateLesson(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);

    try {
      const res = await fetch("/api/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, targetGrades, questions, files }),
      });

      // Check if response has content
      const text = await res.text();
      if (!text) {
        setError("Сервэр хариу өгөөгүй байна");
        return;
      }

      let json;
      try {
        json = JSON.parse(text);
      } catch (parseErr) {
        console.error("JSON parse error:", text);
        setError("Сервэрийн хариу буруу форматтай байна");
        return;
      }

      if (!res.ok) {
        setError(json.error || "Алдаа гарлаа");
        return;
      }

      setLessons([json.lesson, ...lessons]);
      setTitle("");
      setDescription("");
      setTargetGrades([]);
      setQuestions([{ question: "", options: ["", "", "", ""], correctAnswer: 0, explanation: "" }]);
      setFiles([]);
      setShowCreateForm(false);
    } catch (err: any) {
      console.error("Create lesson error:", err);
      setError(err.message || "Сүлжээний алдаа гарлаа");
    } finally {
      setCreating(false);
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
            <h2 className="text-lg font-semibold mb-4">Шинэ хичээл үүсгэх</h2>
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
                  onClick={() => {
                    setShowCreateForm(false);
                    setTitle("");
                    setDescription("");
                    setQuestions([{ question: "", options: ["", "", "", ""], correctAnswer: 0, explanation: "" }]);
                    setFiles([]);
                    setError(null);
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-700 text-sm hover:bg-slate-800 transition-colors"
                >
                  Болих
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-6 py-2 rounded-lg bg-gradient-to-r from-violet-500 to-purple-500 text-white text-sm font-medium disabled:opacity-60"
                >
                  {creating ? "Үүсгэж байна..." : "Хичээл үүсгэх"}
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
            {lessons.map((lesson) => (
              <Link
                key={lesson.id}
                href={`/lessons/${lesson.id}`}
                className="block bg-slate-900/40 border border-slate-800 rounded-2xl px-6 py-5 hover:border-violet-500/50 hover:-translate-y-0.5 transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-slate-200 mb-2">{lesson.title}</h3>
                    <p className="text-sm text-slate-400 mb-3">{lesson.description}</p>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span>👤 {lesson.authorName}</span>
                      <span>📝 {lesson.questions.length} асуулт</span>
                      {lesson.files && lesson.files.length > 0 && (
                        <span>📎 {lesson.files.length} файл</span>
                      )}
                      <span>{new Date(lesson.createdAt).toLocaleDateString("mn-MN")}</span>
                    </div>
                  </div>
                  <div className="text-violet-400 text-sm">→</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </NeonLayout>
  );
}
