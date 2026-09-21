import nodemailer from "nodemailer";

export type EmailResult = {
  success: boolean;
  error?: string;
  devMode?: boolean;
  configurationError?: boolean;
};

function emailConfiguration() {
  const host = process.env.SMTP_HOST?.trim();
  const user = host
    ? process.env.SMTP_USER?.trim()
    : process.env.GMAIL_USER?.trim();
  const password = host
    ? process.env.SMTP_PASS
    : process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");
  if (!user || !password) return null;
  const port = Number(process.env.SMTP_PORT || 587);
  if (host && (!Number.isInteger(port) || port < 1 || port > 65535))
    return null;
  return { host, user, password, port };
}

export function isEmailConfigured(): boolean {
  return emailConfiguration() !== null;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]!,
  );
}

export async function sendPasswordResetEmail(
  email: string,
  code: string,
  name?: string,
): Promise<EmailResult> {
  const configuration = emailConfiguration();
  if (!configuration) {
    // Local development can display the code in its own response; production never can.
    if (process.env.NODE_ENV !== "production")
      return { success: true, devMode: true };
    return {
      success: false,
      configurationError: true,
      error: "Нууц үг сэргээх имэйлийн үйлчилгээ түр боломжгүй байна.",
    };
  }

  const { host, user, password, port } = configuration;
  const transporter = nodemailer.createTransport({
    ...(host ? { host, port, secure: port === 465 } : { service: "gmail" }),
    auth: { user, pass: password },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  const displayName = name?.trim() || "Хэрэглэгч";
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM?.trim() || `Mind Verse <${user}>`,
      to: email,
      subject: "Mind Verse — Нууц үг сэргээх код",
      text: `${displayName}, сайн байна уу?\n\nТаны нууц үг сэргээх код: ${code}\nКод 10 минутын хугацаанд хүчинтэй. Кодоо бусдад бүү дамжуулаарай.\n\nТа энэ хүсэлтийг илгээгээгүй бол имэйлийг үл тоомсорлож болно.`,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#191626;max-width:520px;margin:auto;padding:24px"><h1 style="font-size:24px">Mind Verse</h1><p>${escapeHtml(displayName)}, сайн байна уу?</p><p>Нууц үг сэргээх кодоо оруулна уу.</p><p style="font-size:32px;font-weight:bold;letter-spacing:8px;background:#f0eaff;border-radius:12px;padding:20px;text-align:center">${escapeHtml(code)}</p><p>Код <strong>10 минутын</strong> хугацаанд хүчинтэй. Кодоо бусдад бүү дамжуулаарай.</p><p style="font-size:14px;color:#635b72">Та энэ хүсэлтийг илгээгээгүй бол имэйлийг үл тоомсорлож болно.</p></div>`,
    });
    return { success: true };
  } catch {
    // SMTP errors may contain credentials or message contents; do not return or log them.
    return {
      success: false,
      error: "Имэйл илгээж чадсангүй. Түр хүлээгээд дахин оролдоно уу.",
    };
  } finally {
    transporter.close();
  }
}
