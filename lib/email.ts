import nodemailer from "nodemailer";

export type EmailResult = {
  success: boolean;
  messageId?: string;
  error?: string;
  devMode?: boolean;
};

/**
 * Creates nodemailer transport based on environment variables.
 * Supports:
 * 1. Gmail SMTP (GMAIL_USER, GMAIL_APP_PASSWORD)
 * 2. Generic SMTP (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE)
 * 3. Resend API (RESEND_API_KEY)
 */
function getTransporter(): nodemailer.Transporter | null {
  const gmailUser = process.env.GMAIL_USER || process.env.SMTP_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS;
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || "587", 10);

  if (smtpHost && gmailUser && gmailPass) {
    return nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: gmailUser,
        pass: gmailPass,
      },
    });
  }

  if (gmailUser && gmailPass) {
    // Default to Gmail service if host not specified
    return nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailUser,
        pass: gmailPass,
      },
    });
  }

  return null;
}

/**
 * Sends a password reset email with the 6-digit OTP code.
 */
export async function sendPasswordResetEmail(
  toEmail: string,
  code: string,
  userName?: string
): Promise<EmailResult> {
  const normalizedEmail = toEmail.trim().toLowerCase();
  const displayName = userName || "Хэрэглэгч";

  // Check for Resend API Key first
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const fromEmail = process.env.RESEND_FROM_EMAIL || "Mind Verse <onboarding@resend.dev>";
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [normalizedEmail],
          subject: `🔐 [Mind Verse] Нууц үг сэргээх баталгаажуулах код: ${code}`,
          html: generateEmailHtml(displayName, code),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        return { success: true, messageId: data.id };
      }
      console.error("Resend API error:", data);
      const isResendRestriction = data?.message?.includes("testing emails to your own email") || data?.message?.includes("only send testing emails");
      return {
        success: false,
        error: isResendRestriction
          ? `Resend үнэгүй горимд зөвхөн өөрийн бүртгүүлсэн имэйл рүү илгээх боломжтой: ${data.message}`
          : (data?.message || "Имэйл илгээхэд алдаа гарлаа"),
      };
    } catch (err: any) {
      console.error("Failed to send email via Resend:", err);
      return { success: false, error: err.message || "Имэйл сервертэй холбогдож чадсангүй" };
    }
  }

  // Check Nodemailer SMTP
  const transporter = getTransporter();
  if (transporter) {
    try {
      const sender = process.env.SMTP_FROM || process.env.GMAIL_USER || "Mind Verse <no-reply@mindverse.mn>";
      const info = await transporter.sendMail({
        from: sender,
        to: normalizedEmail,
        subject: `🔐 [Mind Verse] Нууц үг сэргээх баталгаажуулах код: ${code}`,
        html: generateEmailHtml(displayName, code),
        text: `Сайн байна уу, ${displayName}!\n\nТаны Mind Verse нууц үг сэргээх 6 оронтой баталгаажуулах код: ${code}\n\nЭнэ код нь 10 минутын хугацаанд хүчинтэй.\nХэрэв та энэ хүсэлтийг явуулаагүй бол энэ имэйлийг тоохгүй орхино уу.`,
      });

      return { success: true, messageId: info.messageId };
    } catch (err: any) {
      console.error("SMTP send error:", err);
      return { success: false, error: err.message || "Имэйл илгээхэд алдаа гарлаа" };
    }
  }

  // Fallback if no SMTP is configured (e.g., local dev or initial deployment)
  console.log(`\n======================================================`);
  console.log(`📧 [MIND VERSE PASSWORD RESET OTP EMAIL]`);
  console.log(`To: ${normalizedEmail} (${displayName})`);
  console.log(`🔐 Verification Code: ${code}`);
  console.log(`Expires in: 10 minutes`);
  console.log(`💡 Note: To send real emails, configure GMAIL_USER/GMAIL_APP_PASSWORD, SMTP_*, or RESEND_API_KEY.`);
  console.log(`======================================================\n`);

  return {
    success: true,
    devMode: true,
  };
}

function generateEmailHtml(name: string, code: string): string {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mind Verse - Нууц үг сэргээх</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0b0f19; padding: 40px 20px;">
      <tr>
        <td align="center">
          <table width="100%" max-width="560" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; background: linear-gradient(135deg, rgba(30, 27, 75, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 24px; padding: 36px 32px; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);">
            <!-- Header -->
            <tr>
              <td align="center" style="padding-bottom: 24px;">
                <div style="display: inline-block; padding: 12px 20px; background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%); border-radius: 16px; color: #ffffff; font-weight: 800; font-size: 20px; letter-spacing: 0.5px; box-shadow: 0 8px 20px rgba(139, 92, 246, 0.4);">
                  ⚡ Mind Verse
                </div>
              </td>
            </tr>

            <!-- Title -->
            <tr>
              <td align="center" style="padding-bottom: 12px;">
                <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                  Нууц үг сэргээх хүсэлт
                </h1>
              </td>
            </tr>

            <!-- Subtitle -->
            <tr>
              <td align="center" style="padding-bottom: 28px;">
                <p style="margin: 0; font-size: 15px; color: #94a3b8; line-height: 1.6;">
                  Сайн байна уу, <strong style="color: #e2e8f0;">${name}</strong>!<br/>
                  Таны бүртгэлтэй имэйл хаягаар нууц үг солих хүсэлт ирлээ.
                </p>
              </td>
            </tr>

            <!-- OTP Code Box -->
            <tr>
              <td align="center" style="padding-bottom: 28px;">
                <div style="background: rgba(139, 92, 246, 0.12); border: 2px dashed #8b5cf6; border-radius: 18px; padding: 20px 30px; display: inline-block;">
                  <span style="font-size: 13px; font-weight: 600; color: #c084fc; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 8px;">Таны баталгаажуулах код:</span>
                  <span style="font-size: 38px; font-weight: 900; letter-spacing: 8px; color: #38bdf8; font-family: monospace; text-shadow: 0 0 16px rgba(56, 189, 248, 0.6);">${code}</span>
                </div>
              </td>
            </tr>

            <!-- Warning -->
            <tr>
              <td style="padding-bottom: 24px;">
                <div style="background: rgba(239, 68, 68, 0.1); border-left: 4px solid #ef4444; border-radius: 8px; padding: 12px 16px;">
                  <p style="margin: 0; font-size: 13px; color: #fca5a5; line-height: 1.5;">
                    ⚠️ <strong>Анхааруулга:</strong> Энэ код нь <strong>10 минутын</strong> турш хүчинтэй. Кодоо хэнд ч бүү дамжуулаарай.
                  </p>
                </div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td align="center" style="border-top: 1px solid rgba(148, 163, 184, 0.15); padding-top: 20px;">
                <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.5;">
                  Хэрэв та нууц үг сэргээх хүсэлт явуулаагүй бол энэ имэйлийг тоохгүй орхиж болно. Таны бүртгэл аюулгүй хэвээр үлдэнэ.<br/><br/>
                  © ${new Date().getFullYear()} Mind Verse - Graphic Design Lab
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;
}
