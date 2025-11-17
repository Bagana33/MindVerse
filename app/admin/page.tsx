"use client";

import { useState, useEffect } from "react";
import { useSession } from "../../components/auth/useSession";
import { useRouter } from "next/navigation";

type Student = {
  email: string;
  name?: string;
  experience: number;
  role: string;
};

export default function AdminPage() {
  const { session, loading: sessionLoading } = useSession();
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<string>("");
  const [action, setAction] = useState<"set" | "add">("add");
  const [amount, setAmount] = useState<string>("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [deletingStudent, setDeletingStudent] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionLoading && (!session || session.role !== "teacher")) {
      router.push("/");
    }
  }, [session, sessionLoading, router]);

  useEffect(() => {
    async function fetchStudents() {
      try {
        const res = await fetch("/api/leaderboard");
        if (res.ok) {
          const json = await res.json();
          setStudents(json.leaderboard || []);
        }
      } catch (err) {
        console.error("Failed to fetch students:", err);
      } finally {
        setLoading(false);
      }
    }
    if (session?.role === "teacher") {
      fetchStudents();
    }
  }, [session]);

  async function handleManageXP(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (!selectedStudent) {
      setMessage({ type: "error", text: "Сурагч сонгоно уу" });
      return;
    }

    const xpAmount = parseInt(amount);
    if (isNaN(xpAmount)) {
      setMessage({ type: "error", text: "XP дүн тоон утга байх ёстой" });
      return;
    }

    setProcessing(true);

    try {
      const res = await fetch("/api/admin/manage-xp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentEmail: selectedStudent,
          action,
          amount: xpAmount,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", text: json.error || "Алдаа гарлаа" });
        return;
      }

      setMessage({ type: "success", text: json.message });
      setAmount("");
      
      // Refresh students list
      const refreshRes = await fetch("/api/leaderboard");
      if (refreshRes.ok) {
        const refreshJson = await refreshRes.json();
        setStudents(refreshJson.leaderboard || []);
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Сүлжээний алдаа гарлаа" });
    } finally {
      setProcessing(false);
    }
  }

  async function handleDeleteStudent(studentEmail: string, studentName?: string) {
    const displayName = studentName || studentEmail;
    if (!confirm(`"${displayName}" сурагчийг бүрмөсөн устгах уу?\n\nЭнэ үйлдлийг буцаах боломжгүй. Сурагчийн:\n- Бүх постууд\n- Сэтгэгдлүүд\n- Reactions\n- Notifications\n\nБүгд устах болно.`)) {
      return;
    }

    setDeletingStudent(studentEmail);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/delete-student", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentEmail }),
      });

      const json = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", text: json.error || "Устгахад алдаа гарлаа" });
        return;
      }

      setMessage({ type: "success", text: json.message || "Сурагч амжилттай устлаа" });
      
      // Remove from local state
      setStudents(students.filter(s => s.email !== studentEmail));
      
      // Clear selection if deleted student was selected
      if (selectedStudent === studentEmail) {
        setSelectedStudent("");
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Сүлжээний алдаа гарлаа" });
    } finally {
      setDeletingStudent(null);
    }
  }

  if (sessionLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-violet-500 border-r-transparent"></div>
          <p className="mt-4 text-sm text-slate-400">Ачааллаж байна...</p>
        </div>
      </div>
    );
  }

  if (!session || session.role !== "teacher") {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div className="rounded-3xl border border-slate-700/50 bg-slate-900/50 px-6 py-8 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-200 via-purple-200 to-pink-200 bg-clip-text text-transparent">
                Багшийн удирдлага
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                Сурагчдын XP удирдаж, тэдний ахиц дэвшлийг хянаарай
              </p>
            </div>
            <button
              onClick={() => router.push("/")}
              className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-violet-500/40 hover:bg-slate-800"
            >
              ← Буцах
            </button>
          </div>
        </div>

        {/* XP Management Form */}
        <div className="rounded-3xl border border-slate-700/50 bg-slate-900/50 px-6 py-6 shadow-xl">
          <h2 className="text-xl font-bold text-white">XP удирдлага</h2>
          <p className="mt-1 text-sm text-slate-400">Сурагчдад XP нэмэх эсвэл тогтоох</p>

          <form onSubmit={handleManageXP} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Сурагч сонгох
              </label>
              <select
                value={selectedStudent}
                onChange={(e) => setSelectedStudent(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-200 focus:border-violet-500/40 focus:outline-none"
                required
              >
                <option value="">-- Сурагч сонгох --</option>
                {students.map((student) => (
                  <option key={student.email} value={student.email}>
                    {student.name || student.email} (Одоогийн XP: {student.experience})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Үйлдэл
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAction("add")}
                    className={`flex-1 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                      action === "add"
                        ? "bg-violet-500 text-white shadow-lg"
                        : "border border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    + Нэмэх
                  </button>
                  <button
                    type="button"
                    onClick={() => setAction("set")}
                    className={`flex-1 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                      action === "set"
                        ? "bg-violet-500 text-white shadow-lg"
                        : "border border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    = Тогтоох
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  XP дүн
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Жишээ: 100"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-200 placeholder:text-slate-500 focus:border-violet-500/40 focus:outline-none"
                  required
                />
              </div>
            </div>

            {message && (
              <div
                className={`rounded-xl px-4 py-3 text-sm ${
                  message.type === "success"
                    ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
                    : "bg-red-500/10 border border-red-500/30 text-red-300"
                }`}
              >
                {message.text}
              </div>
            )}

            <button
              type="submit"
              disabled={processing}
              className="w-full rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {processing ? "Боловсруулж байна..." : action === "add" ? "XP нэмэх" : "XP тогтоох"}
            </button>
          </form>
        </div>

        {/* Students List */}
        <div className="rounded-3xl border border-slate-700/50 bg-slate-900/50 px-6 py-6 shadow-xl">
          <h2 className="text-xl font-bold text-white">Сурагчдын жагсаалт</h2>
          <p className="mt-1 text-sm text-slate-400 mb-4">
            Нийт {students.length} сурагч
          </p>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Нэр
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    XP
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Үйлдэл
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {students.map((student, index) => (
                  <tr
                    key={student.email}
                    className="hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {index + 1}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-200">
                      {student.name || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {student.email}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/10 border border-violet-500/30 px-3 py-1 text-xs font-semibold text-violet-300">
                        {student.experience} XP
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedStudent(student.email)}
                          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:border-violet-500/40 hover:text-violet-300 transition-colors"
                          title="XP засах"
                        >
                          ✏️ Засах
                        </button>
                        <button
                          onClick={() => handleDeleteStudent(student.email, student.name)}
                          disabled={deletingStudent === student.email}
                          className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/20 hover:border-red-500/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Сурагч устгах"
                        >
                          {deletingStudent === student.email ? "⏳" : "🗑️"} Устгах
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
