"use client";

import { FormEvent, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Mode = "signin" | "signup";

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [grade, setGrade] = useState<string>("10"); // Default to grade 10
  const [rememberMe, setRememberMe] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Load saved email from localStorage
  useEffect(() => {
    const savedEmail = localStorage.getItem('mindverse_email');
    const savedRemember = localStorage.getItem('mindverse_remember') === 'true';
    if (savedEmail && savedRemember) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus(null);
    setError(null);
    setLoading(true);

    try {
      // Simple client-side validation
      if (mode === "signup") {
        if (!name || name.trim().length < 2) {
          setLoading(false);
          return setError("Нэрээ зөв оруулна уу (хамгийн багадаа 2 тэмдэгт)");
        }
        if (!password || password.length < 6) {
          setLoading(false);
          return setError("Нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой");
        }
      }
      // Save email if remember me is checked
      if (rememberMe) {
        localStorage.setItem('mindverse_email', email);
        localStorage.setItem('mindverse_remember', 'true');
      } else {
        localStorage.removeItem('mindverse_email');
        localStorage.removeItem('mindverse_remember');
      }

      // Call the /api/auth/login endpoint
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name, mode, role, grade: role === "student" ? grade : undefined }),
      });
      if (!res.ok) {
        const json = await res.json();
        setError(json.error ?? "Нэвтрэх амжилтгүй");
        return;
      }
      setStatus("Амжилттай нэвтэрлээ!");
      // Redirect to home after a short delay
      setTimeout(() => router.push("/"), 600);
    } catch (err: any) {
      setError(err.message ?? "Алдаа гарлаа.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      {/* Animated background orbs */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-500/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 right-1/3 w-96 h-96 bg-pink-500/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '4s' }} />
      </div>

      <div className="relative w-full max-w-5xl rounded-3xl overflow-hidden shadow-[0_40px_100px_rgba(139,92,246,0.4)] border border-slate-800/50">
        <div className="grid md:grid-cols-2">
          {/* Left side - Gradient hero */}
          <section className="relative bg-gradient-to-br from-violet-600 via-purple-600 to-pink-500 text-white px-10 py-12 flex flex-col justify-between overflow-hidden">
            {/* Decorative elements */}
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-xl border border-white/30 flex items-center justify-center font-extrabold text-xl shadow-[0_12px_30px_rgba(255,255,255,0.3)] neon-glow">
                  MV
                </div>
                <div>
                  <h3 className="text-xl font-bold">Mind Verse</h3>
                  <p className="text-xs text-white/90">
                    Graphic design lab · Creative learning
                  </p>
                </div>
              </div>
              
              <h1 className="text-3xl md:text-4xl font-extrabold leading-tight mb-4 neon-text">
                Welcome back!
              </h1>
              <p className="text-base text-white/90 leading-relaxed">
                Dive into graphic design challenges, share works-in-progress, and level up your visual thinking. New here? Create an account in seconds.
              </p>

              {/* Feature highlights */}
              <div className="mt-8 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    ✨
                  </div>
                  <span className="text-sm text-white/90">Gamified learning with XP rewards</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    🏆
                  </div>
                  <span className="text-sm text-white/90">Compete on the leaderboard</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    🎨
                  </div>
                  <span className="text-sm text-white/90">Share your creative work</span>
                </div>
              </div>
            </div>

            {/* Bottom decoration */}
            <div className="relative z-10 mt-8">
              <div className="flex items-center gap-2 text-xs text-white/70">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Бүх систем ажиллаж байна</span>
              </div>
            </div>
          </section>

          {/* Right side - Form */}
          <section className="glass-panel border-0 px-10 py-10">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                  {mode === "signin" ? "Нэвтрэх" : "Бүртгүүлэх"}
                </h2>
                <p className="text-sm text-slate-400 mt-2">
                  {mode === "signin"
                    ? "Өөрийн бүртгэлтэй имэйлээр нэвтэрнэ үү."
                    : "Шинээр бүртгүүлж Mind Verse-д нэгдээрэй."}
                </p>
              </div>

              <div className="space-y-2 text-sm">
                <label className="block font-semibold text-slate-200">📧 Имэйл</label>
                <input
                  type="email"
                  required
                  className="w-full rounded-xl glass-panel border-slate-700/50 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 transition-all"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {mode === "signup" && (
                <div className="space-y-2 text-sm">
                  <label className="block font-semibold text-slate-200">👤 Нэр (Display name)</label>
                  <input
                    className="w-full rounded-xl glass-panel border-slate-700/50 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 transition-all"
                    placeholder="Жишээ: Enkhtuya D."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-2 text-sm">
                <label className="block font-semibold text-slate-200">🔒 Нууц үг</label>
                <input
                  type="password"
                  required
                  className="w-full rounded-xl glass-panel border-slate-700/50 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 transition-all"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {mode === "signin" && (
                <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer hover:text-slate-200 transition-colors">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800/50 text-violet-500 focus:ring-violet-500/20 focus:ring-2 cursor-pointer"
                  />
                  <span>Имэйл хаягаа санах</span>
                </label>
              )}

              <div className="space-y-3 text-sm">
                <label className="block font-semibold text-slate-200">
                  👥 {mode === "signin" ? "Та хэн бэ?" : "Хэрэглэгчийн төрөл"}
                </label>
                <p className="text-xs text-slate-400 -mt-1">
                  {mode === "signin" 
                    ? "Та сурагч уу багш уу?"
                    : "Сурагчид XP цуглуулж, багш нар даалгавар үүсгэнэ"}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <label className={`flex flex-col items-center justify-center gap-2 cursor-pointer rounded-xl border-2 px-4 py-5 transition-all duration-300 ${
                    role === "student" 
                      ? "border-violet-500 bg-gradient-to-br from-violet-500/20 to-purple-500/20 text-white shadow-[0_8px_24px_rgba(139,92,246,0.5)] scale-105" 
                      : "border-slate-700/50 text-slate-400 hover:border-violet-500/30 hover:bg-slate-800/30 hover:text-slate-300"
                  }`}>
                    <input
                      type="radio"
                      name="role"
                      value="student"
                      checked={role === "student"}
                      onChange={() => setRole("student")}
                      className="hidden"
                    />
                    <span className="text-4xl">🎓</span>
                    <span className="font-bold text-base">Сурагч</span>
                    <span className="text-xs text-center opacity-80">XP цуглуулах, хичээл хийх</span>
                  </label>
                  <label className={`flex flex-col items-center justify-center gap-2 cursor-pointer rounded-xl border-2 px-4 py-5 transition-all duration-300 ${
                    role === "teacher" 
                      ? "border-violet-500 bg-gradient-to-br from-violet-500/20 to-purple-500/20 text-white shadow-[0_8px_24px_rgba(139,92,246,0.5)] scale-105" 
                      : "border-slate-700/50 text-slate-400 hover:border-violet-500/30 hover:bg-slate-800/30 hover:text-slate-300"
                  }`}>
                    <input
                      type="radio"
                      name="role"
                      value="teacher"
                      checked={role === "teacher"}
                      onChange={() => setRole("teacher")}
                      className="hidden"
                    />
                    <span className="text-4xl">👨‍🏫</span>
                    <span className="font-bold text-base">Багш</span>
                    <span className="text-xs text-center opacity-80">Даалгавар үүсгэх, үнэлэх</span>
                  </label>
                </div>
              </div>

              {mode === "signup" && role === "student" && (
                <div className="space-y-3 text-sm">
                  <label className="block font-semibold text-slate-200">
                    🎒 Анги
                  </label>
                  <p className="text-xs text-slate-400 -mt-1">
                    Та хэддүгээр анги вэ?
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    {["10", "11", "12"].map((gradeOption) => (
                      <label
                        key={gradeOption}
                        className={`flex items-center justify-center cursor-pointer rounded-xl border-2 px-4 py-4 transition-all duration-300 ${
                          grade === gradeOption
                            ? "border-violet-500 bg-gradient-to-br from-violet-500/20 to-purple-500/20 text-white shadow-[0_8px_24px_rgba(139,92,246,0.4)] scale-105"
                            : "border-slate-700/50 text-slate-400 hover:border-violet-500/30 hover:bg-slate-800/30 hover:text-slate-300"
                        }`}
                      >
                        <input
                          type="radio"
                          name="grade"
                          value={gradeOption}
                          checked={grade === gradeOption}
                          onChange={() => setGrade(gradeOption)}
                          className="hidden"
                        />
                        <span className="text-lg font-bold">{gradeOption} анги</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 text-white font-bold py-4 mt-6 shadow-[0_20px_40px_rgba(139,92,246,0.5)] hover:shadow-[0_24px_48px_rgba(139,92,246,0.7)] hover:scale-[1.02] disabled:opacity-60 disabled:shadow-none transition-all duration-300 text-base"
              >
                {loading
                  ? "⏳ Түр хүлээнэ үү..."
                  : mode === "signin"
                  ? "🚀 Нэвтрэх"
                  : "✨ Шинээр бүртгүүлэх"}
              </button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-700/50"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-3 bg-slate-950 text-slate-500">эсвэл</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
                className="w-full rounded-xl border-2 border-slate-700 hover:border-violet-500/50 bg-slate-900/50 hover:bg-slate-800/50 text-slate-200 font-semibold py-3.5 transition-all duration-300"
              >
                {mode === "signin" 
                  ? "📝 Шинээр бүртгүүлэх" 
                  : "🔑 Нэвтрэх хэсэг рүү шилжих"}
              </button>

              {status && (
                <div className="px-4 py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                  <p className="text-sm text-emerald-400 font-medium">✓ {status}</p>
                </div>
              )}
              {error && (
                <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <p className="text-sm text-red-400 font-medium">✕ {error}</p>
                </div>
              )}
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
