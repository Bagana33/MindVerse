"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BrandLogo } from "../layout/BrandLogo";

type Mode = "signin" | "signup" | "forgot";

export function LoginForm() {
  const [mode, setMode] = useState<Mode>("signin");
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [grade, setGrade] = useState("10");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resendUntil, setResendUntil] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const navigatingRef = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem("mindverse_remember") === "true") {
        setEmail(localStorage.getItem("mindverse_email") || "");
        setRememberMe(true);
      }
    } catch {
      /* Remembering an email is optional when browser storage is blocked. */
    }
    return () => {
      requestRef.current?.abort("unmounted");
    };
  }, []);

  useEffect(() => {
    if (!resendUntil) {
      setResendCooldown(0);
      return;
    }
    const update = () =>
      setResendCooldown(
        Math.max(0, Math.ceil((resendUntil - Date.now()) / 1000)),
      );
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [resendUntil]);

  function switchMode(next: Mode) {
    if (requestRef.current || navigatingRef.current) return;
    setMode(next);
    setForgotStep(1);
    setResendUntil(0);
    setOtpCode("");
    setResetToken("");
    setNewPassword("");
    setConfirmPassword("");
    setPassword("");
    setShowPassword(false);
    setError(null);
    setStatus(null);
    headingRef.current?.focus();
  }

  async function submitRequest(
    url: string,
    body: Record<string, unknown>,
    onSuccess: (json: any) => void,
  ) {
    if (requestRef.current || navigatingRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort("timeout"), 25000);
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok)
        throw new Error(
          json?.error || "Хүсэлтийг гүйцэтгэж чадсангүй. Дахин оролдоно уу.",
        );
      if (!controller.signal.aborted) onSuccess(json);
    } catch (cause) {
      if (controller.signal.reason !== "unmounted") {
        setError(
          controller.signal.aborted
            ? "Хариу удаж байна. Холболтоо шалгаад дахин оролдоно уу."
            : cause instanceof Error
              ? cause.message
              : "Сүлжээний алдаа гарлаа.",
        );
      }
    } finally {
      window.clearTimeout(timeout);
      if (controller.signal.reason !== "unmounted" && !navigatingRef.current)
        setLoading(false);
      if (requestRef.current === controller) requestRef.current = null;
    }
  }

  async function sendResetCode() {
    if (resendCooldown > 0 || requestRef.current) return;
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("Зөв имэйл хаяг оруулна уу.");
      return;
    }
    await submitRequest(
      "/api/auth/send-reset-code",
      { email: cleanEmail },
      (json) => {
        setEmail(cleanEmail);
        setResetToken(json.resetToken || "");
        setForgotStep(2);
        setResendUntil(Date.now() + 60000);
        setOtpCode(json.devCode || "");
        setStatus(
          json.message ||
            "Баталгаажуулах код илгээгдлээ. Ирсэн имэйл болон спам хавтсаа шалгана уу.",
        );
      },
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (requestRef.current || navigatingRef.current) return;
    setError(null);
    if (mode === "forgot") {
      if (forgotStep === 1) {
        await sendResetCode();
        return;
      }
      if (!/^\d{6}$/.test(otpCode)) {
        setError("6 оронтой баталгаажуулах код оруулна уу.");
        return;
      }
      if (newPassword.length < 6) {
        setError("Нууц үг хамгийн багадаа 6 тэмдэгт байна.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setError("Шинэ нууц үгүүд хоорондоо таарахгүй байна.");
        return;
      }
      await submitRequest(
        "/api/auth/reset-password",
        {
          email: email.trim().toLowerCase(),
          code: otpCode,
          resetToken,
          newPassword,
          confirmPassword,
        },
        () => {
          setMode("signin");
          setForgotStep(1);
          setOtpCode("");
          setResetToken("");
          setNewPassword("");
          setConfirmPassword("");
          setPassword("");
          setStatus("Нууц үг шинэчлэгдлээ. Шинэ нууц үгээрээ нэвтэрнэ үү.");
          headingRef.current?.focus();
        },
      );
      return;
    }
    if (mode === "signup" && name.trim().length < 2) {
      setError("Нэр хамгийн багадаа 2 тэмдэгт байна.");
      return;
    }
    if (mode === "signup" && password.length < 6) {
      setError("Нууц үг хамгийн багадаа 6 тэмдэгт байна.");
      return;
    }
    const cleanEmail = email.trim().toLowerCase();
    await submitRequest(
      "/api/auth/login",
      {
        email: cleanEmail,
        password,
        name: name.trim(),
        mode,
        role: "student",
        grade,
      },
      () => {
        try {
          if (rememberMe) {
            localStorage.setItem("mindverse_email", cleanEmail);
            localStorage.setItem("mindverse_remember", "true");
          } else {
            localStorage.removeItem("mindverse_email");
            localStorage.removeItem("mindverse_remember");
          }
        } catch {}
        setStatus("Амжилттай нэвтэрлээ. Нүүр хуудсыг нээж байна…");
        // A fresh document ensures a previous account's in-flight session cannot
        // overwrite the session cookie just established by this login.
        navigatingRef.current = true;
        window.location.replace("/");
      },
    );
  }

  const heading =
    mode === "signin"
      ? "Эргээд тавтай морил."
      : mode === "signup"
        ? "Бүтээлч аяллаа эхлүүлье."
        : forgotStep === 1
          ? "Нууц үгээ сэргээх"
          : "Шинэ нууц үг тохируулах";
  const passwordType = showPassword ? "text" : "password";
  return (
    <main className="flex min-h-dvh flex-col bg-slate-950 px-4 py-5 sm:px-8 sm:py-7 lg:px-10">
      <div className="mx-auto mb-6 flex w-full max-w-[1120px] items-center justify-between gap-4 lg:mb-8">
        <Link
          href="/"
          aria-label="Mind Verse нүүр хуудас"
          className="flex items-center gap-3 text-lg font-bold text-white"
        >
          <BrandLogo size="sm" /> Mind Verse
        </Link>
        <Link
          href="/"
          className="min-h-11 inline-flex items-center text-sm text-slate-300 hover:text-white"
        >
          Зочноор үзэх →
        </Link>
      </div>
      <div className="mx-auto mb-auto grid w-full max-w-[1120px] overflow-hidden rounded-3xl border border-white/10 bg-[#101320] shadow-2xl shadow-black/15 lg:mt-auto lg:grid-cols-[0.95fr_1.05fr]">
        <aside className="relative hidden flex-col justify-center overflow-hidden border-r border-white/10 bg-gradient-to-br from-violet-950/80 via-[#151329] to-[#101320] p-8 lg:flex xl:p-12">
          <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full border-[36px] border-violet-400/[0.07]" />
          <div>
            <p className="mv-eyebrow">Дизайн лаборатори</p>
            <h2 className="mt-4 text-4xl font-bold leading-[1.15] tracking-tight text-white xl:text-5xl">
              Санаагаа
              <br />
              бүтээл болго.
            </h2>
            <p className="mt-5 max-w-[32ch] text-base leading-7 text-slate-300">
              Хичээлээ судалж, бүтээлээ хуваалцаж, бусдаас суралцах таны орон
              зай.
            </p>
          </div>
          <ul className="mt-9 space-y-5 border-t border-white/10 pt-7 text-sm leading-6 text-slate-300">
            <li className="flex items-start gap-3"><span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-violet-300/15 bg-violet-400/10 text-xl">🎨</span><span><strong className="block font-semibold text-white">Өөрийн бүтээлийн орон зай</strong>Хийсэн ажлаа нэг дор цуглуулж, хуваалцаарай.</span></li>
            <li className="flex items-start gap-3"><span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-violet-300/15 bg-violet-400/10 text-xl">💬</span><span><strong className="block font-semibold text-white">Хамтдаа суралцах</strong>Сэтгэгдэл, зөвлөгөөгөөр дараагийн бүтээлээ сайжруулаарай.</span></li>
            <li className="flex items-start gap-3"><span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-violet-300/15 bg-violet-400/10 text-xl">🏆</span><span><strong className="block font-semibold text-white">Ахиц бүрээ харах</strong>Хичээл, сорилтод оролцож XP цуглуулаарай.</span></li>
          </ul>
        </aside>
        <section
          className="mx-auto w-full min-w-0 max-w-[544px] p-5 sm:p-8 xl:px-12 xl:py-10"
          aria-labelledby="auth-heading"
        >
          {mode !== "forgot" && (
            <div
              className="mb-6 flex rounded-xl border border-white/5 bg-slate-950/70 p-1"
              role="group"
              aria-label="Нэвтрэх эсвэл бүртгүүлэх"
            >
              {(["signin", "signup"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  disabled={loading}
                  aria-pressed={mode === value}
                  onClick={() => switchMode(value)}
                  className={`min-h-11 flex-1 rounded-lg px-3 text-sm font-semibold transition-colors ${mode === value ? "bg-violet-600 text-white" : "text-slate-400 hover:text-white"}`}
                >
                  {value === "signin" ? "Нэвтрэх" : "Бүртгүүлэх"}
                </button>
              ))}
            </div>
          )}
          <h1
            id="auth-heading"
            ref={headingRef}
            tabIndex={-1}
            className="text-2xl font-bold leading-tight tracking-tight text-white outline-none sm:text-3xl"
          >
            {heading}
          </h1>
          <p className="mb-6 mt-3 text-sm leading-6 text-slate-400">
            {mode === "signin"
              ? "Өөрийн бүртгэлээр үргэлжлүүлээрэй."
              : mode === "signup"
                ? "Мэдээллээ оруулаад хамтдаа суралцаж эхлээрэй."
                : forgotStep === 1
                  ? "Бүртгэлтэй имэйлд тань баталгаажуулах код илгээнэ."
                  : "Имэйлээр ирсэн кодоо оруулаад шинэ нууц үгээ сонгоорой."}
          </p>
          <form
            onSubmit={handleSubmit}
            className="space-y-5"
            aria-busy={loading}
          >
            <fieldset disabled={loading} className="min-w-0 space-y-4">
              {(mode !== "forgot" || forgotStep === 1) && (
                <div>
                  <label htmlFor="auth-email" className="mv-label">
                    Имэйл хаяг
                  </label>
                  <input
                    id="auth-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                    maxLength={254}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    className="mv-field"
                  />
                </div>
              )}
              {mode === "signup" && (
                <div>
                  <label htmlFor="auth-name" className="mv-label">
                    Таны нэр
                  </label>
                  <input
                    id="auth-name"
                    name="name"
                    autoComplete="name"
                    required
                    minLength={2}
                    maxLength={80}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="mv-field"
                  />
                </div>
              )}
              {mode === "forgot" && forgotStep === 2 && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-violet-500/25 bg-violet-500/10 px-3 py-2 text-sm">
                    <span className="min-w-0 break-all text-violet-200">
                      {email}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotStep(1);
                        setResetToken("");
                        setOtpCode("");
                        setResendUntil(0);
                        setError(null);
                        setStatus(null);
                      }}
                      className="min-h-11 font-semibold text-violet-300"
                    >
                      Имэйл солих
                    </button>
                  </div>
                  <div>
                    <label htmlFor="auth-otp" className="mv-label">
                      6 оронтой баталгаажуулах код
                    </label>
                    <input
                      id="auth-otp"
                      name="code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      required
                      value={otpCode}
                      onChange={(event) =>
                        setOtpCode(event.target.value.replace(/\D/g, ""))
                      }
                      className="mv-field text-center font-mono text-xl tracking-[0.3em]"
                      placeholder="000000"
                    />
                    <button
                      type="button"
                      disabled={resendCooldown > 0 || loading}
                      onClick={() => void sendResetCode()}
                      className="mt-1 min-h-11 text-sm font-semibold text-violet-300 disabled:text-slate-500"
                    >
                      {resendCooldown > 0
                        ? `Код дахин авах · ${resendCooldown} сек`
                        : "Код дахин авах"}
                    </button>
                  </div>
                </>
              )}
              {mode !== "forgot" ? (
                <div>
                  <label htmlFor="auth-password" className="mv-label">
                    Нууц үг
                  </label>
                  <div className="relative">
                    <input
                      id="auth-password"
                      name="password"
                      type={passwordType}
                      autoComplete={
                        mode === "signup" ? "new-password" : "current-password"
                      }
                      required
                      minLength={mode === "signup" ? 6 : undefined}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="mv-field pr-20"
                    />
                    <button
                      type="button"
                      aria-pressed={showPassword}
                      aria-label={
                        showPassword ? "Нууц үгийг нуух" : "Нууц үгийг харуулах"
                      }
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute inset-y-0 right-2 min-h-11 min-w-14 rounded-lg text-sm font-semibold text-slate-300 hover:text-white"
                    >
                      {showPassword ? "Нуух" : "Харах"}
                    </button>
                  </div>
                  {mode === "signup" && (
                    <p className="mt-2 text-sm text-slate-400">
                      Хамгийн багадаа 6 тэмдэгт.
                    </p>
                  )}
                </div>
              ) : (
                forgotStep === 2 && (
                  <>
                    <div>
                      <label htmlFor="auth-new-password" className="mv-label">
                        Шинэ нууц үг
                      </label>
                      <input
                        id="auth-new-password"
                        name="newPassword"
                        type={passwordType}
                        autoComplete="new-password"
                        required
                        minLength={6}
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        className="mv-field"
                      />
                      <p className="mt-2 text-sm text-slate-400">
                        Хамгийн багадаа 6 тэмдэгт.
                      </p>
                    </div>
                    <div>
                      <label
                        htmlFor="auth-confirm-password"
                        className="mv-label"
                      >
                        Шинэ нууц үгээ давтах
                      </label>
                      <input
                        id="auth-confirm-password"
                        name="confirmPassword"
                        type={passwordType}
                        autoComplete="new-password"
                        required
                        minLength={6}
                        value={confirmPassword}
                        onChange={(event) =>
                          setConfirmPassword(event.target.value)
                        }
                        className="mv-field"
                      />
                    </div>
                    <label className="flex min-h-11 items-center gap-3 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        checked={showPassword}
                        onChange={(event) =>
                          setShowPassword(event.target.checked)
                        }
                        className="h-4 w-4 accent-violet-500"
                      />
                      Нууц үгээ харах
                    </label>
                  </>
                )
              )}
              {mode === "signin" && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <label className="flex min-h-11 items-center gap-2 text-slate-300">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(event) => setRememberMe(event.target.checked)}
                      className="h-4 w-4 accent-violet-500"
                    />
                    Имэйлээ санах
                  </label>
                  <button
                    type="button"
                    onClick={() => switchMode("forgot")}
                    className="min-h-11 font-semibold text-violet-300 hover:text-violet-200"
                  >
                    Нууц үг мартсан уу?
                  </button>
                </div>
              )}
              {mode === "signup" && (
                <div>
                  <label htmlFor="auth-grade" className="mv-label">
                    Анги
                  </label>
                  <select
                    id="auth-grade"
                    name="grade"
                    value={grade}
                    onChange={(event) => setGrade(event.target.value)}
                    className="mv-field"
                  >
                    {["9", "10", "11", "12"].map((value) => (
                      <option key={value} value={value}>
                        {value}-р анги
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Сурагчийн бүртгэл үүснэ. Багш нар одоо байгаа бүртгэлээрээ
                    нэвтэрнэ үү.
                  </p>
                </div>
              )}
            </fieldset>
            {error && (
              <p
                role="alert"
                className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-3 text-sm leading-6 text-rose-200"
              >
                {error}
              </p>
            )}
            {status && (
              <p
                role="status"
                className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm leading-6 text-emerald-200"
              >
                {status}
              </p>
            )}
            <button
              type="submit"
              disabled={
                loading ||
                (mode === "forgot" && forgotStep === 1 && resendCooldown > 0)
              }
              className="mv-button-primary w-full"
            >
              {loading
                ? "Түр хүлээнэ үү…"
                : mode === "signin"
                  ? "Нэвтрэх"
                  : mode === "signup"
                    ? "Бүртгэл үүсгэх"
                    : forgotStep === 1
                      ? "Баталгаажуулах код авах"
                      : "Нууц үг шинэчлэх"}
            </button>
            {mode === "forgot" && (
              <button
                type="button"
                disabled={loading}
                onClick={() => switchMode("signin")}
                className="mv-button-secondary w-full"
              >
                ← Нэвтрэх хэсэгт буцах
              </button>
            )}
          </form>
        </section>
      </div>
    </main>
  );
}
