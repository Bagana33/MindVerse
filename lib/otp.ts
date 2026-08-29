import crypto from "crypto";

const DEFAULT_SECRET = "mindverse_dev_secret_key_change_in_prod";

function getSecret(): string {
  return process.env.NC_SESSION_SECRET || DEFAULT_SECRET;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function sign(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

export type ResetTokenPayload = {
  email: string;
  codeHash: string;
  salt: string;
  expiresAt: number; // Unix timestamp ms
};

/**
 * Generates a 6-digit numeric OTP and a tamper-proof signed reset token.
 */
export function generatePasswordResetToken(email: string, expiresInMinutes = 10): {
  code: string;
  token: string;
  expiresAt: number;
} {
  const normalizedEmail = email.trim().toLowerCase();
  // Generate random 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const salt = crypto.randomBytes(16).toString("hex");
  const codeHash = crypto
    .createHash("sha256")
    .update(`${code}:${salt}:${normalizedEmail}`)
    .digest("hex");

  const expiresAt = Date.now() + expiresInMinutes * 60 * 1000;

  const payload: ResetTokenPayload = {
    email: normalizedEmail,
    codeHash,
    salt,
    expiresAt,
  };

  const secret = getSecret();
  const json = JSON.stringify(payload);
  const b64 = base64url(json);
  const sig = sign(b64, secret);
  const token = `${b64}.${sig}`;

  return { code, token, expiresAt };
}

/**
 * Verifies if the supplied code and signed token match the given email and have not expired.
 */
export function verifyPasswordResetToken(
  email: string,
  code: string,
  token: string
): { valid: boolean; error?: string } {
  if (!token || !code || !email) {
    return { valid: false, error: "Баталгаажуулах код дутуу байна" };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const cleanCode = code.trim();

  const parts = token.split(".");
  if (parts.length !== 2) {
    return { valid: false, error: "Хүчингүй баталгаажуулах токен" };
  }

  const [b64, sig] = parts;
  const secret = getSecret();
  const expectedSig = sign(b64, secret);

  // Timing safe equal check for signature
  try {
    const isSigValid = crypto.timingSafeEqual(
      Buffer.from(sig),
      Buffer.from(expectedSig)
    );
    if (!isSigValid) {
      return { valid: false, error: "Токен баталгаажсангүй эсвэл өөрчлөгдсөн байна" };
    }
  } catch {
    return { valid: false, error: "Хүчингүй токен" };
  }

  let payload: ResetTokenPayload;
  try {
    const json = Buffer.from(
      b64.replace(/-/g, "+").replace(/_/g, "/"),
      "base64"
    ).toString("utf8");
    payload = JSON.parse(json);
  } catch {
    return { valid: false, error: "Токен тайлахад алдаа гарлаа" };
  }

  if (payload.email !== normalizedEmail) {
    return { valid: false, error: "Имэйл хаяг тохирохгүй байна" };
  }

  if (Date.now() > payload.expiresAt) {
    return { valid: false, error: "Баталгаажуулах кодын хугацаа дууссан байна. Дахин код авна уу." };
  }

  // Check code hash
  const expectedHash = crypto
    .createHash("sha256")
    .update(`${cleanCode}:${payload.salt}:${normalizedEmail}`)
    .digest("hex");

  if (expectedHash !== payload.codeHash) {
    return { valid: false, error: "Баталгаажуулах 6 оронтой код буруу байна" };
  }

  return { valid: true };
}
