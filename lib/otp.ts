import crypto from "node:crypto";
import { getSigningKey } from "./signingKey";

export type ResetTokenPayload = {
  v: 2;
  email: string;
  codeHash: string;
  passwordVersion: string;
  salt: string;
  issuedAt: number;
  expiresAt: number;
};
const MAX_LIFETIME_MS = 10 * 60 * 1000;

function codeDigest(code: string, salt: string, email: string): string {
  // The token is public to the requester. A keyed digest prevents offline enumeration of six-digit codes.
  return crypto
    .createHmac("sha256", getSigningKey("password-reset-code"))
    .update(JSON.stringify([code, salt, email]))
    .digest("hex");
}

function passwordVersion(passwordHash: string): string {
  return crypto
    .createHmac("sha256", getSigningKey("password-reset-version"))
    .update(passwordHash)
    .digest("hex");
}

export function generatePasswordResetToken(
  email: string,
  passwordHash: string,
  expiresInMinutes = 10,
): { code: string; token: string; expiresAt: number } {
  const normalizedEmail = email.trim().toLowerCase();
  if (
    !normalizedEmail ||
    normalizedEmail.length > 320 ||
    typeof passwordHash !== "string" ||
    !passwordHash ||
    !Number.isFinite(expiresInMinutes) ||
    expiresInMinutes <= 0 ||
    expiresInMinutes > 10
  )
    throw new Error("Invalid password-reset request.");
  const code = crypto.randomInt(100000, 1000000).toString();
  const salt = crypto.randomBytes(16).toString("hex");
  const issuedAt = Date.now();
  const expiresAt = issuedAt + Math.floor(expiresInMinutes * 60 * 1000);
  const payload: ResetTokenPayload = {
    v: 2,
    email: normalizedEmail,
    codeHash: codeDigest(code, salt, normalizedEmail),
    passwordVersion: passwordVersion(passwordHash),
    salt,
    issuedAt,
    expiresAt,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", getSigningKey("password-reset-token"))
    .update(encoded)
    .digest("base64url");
  return { code, token: `${encoded}.${signature}`, expiresAt };
}

export function verifyPasswordResetToken(
  email: string,
  code: string,
  token: string,
  passwordHash: string,
): { valid: boolean; error?: string } {
  const invalid = {
    valid: false,
    error: "Баталгаажуулах код эсвэл токен хүчингүй байна. Дахин код авна уу.",
  };
  if (
    typeof email !== "string" ||
    typeof code !== "string" ||
    typeof token !== "string" ||
    typeof passwordHash !== "string" ||
    !passwordHash ||
    token.length > 4096
  )
    return invalid;
  const normalizedEmail = email.trim().toLowerCase();
  const cleanCode = code.trim();
  if (
    !normalizedEmail ||
    normalizedEmail.length > 320 ||
    !/^\d{6}$/.test(cleanCode)
  )
    return invalid;
  const parts = token.split(".");
  if (
    parts.length !== 2 ||
    !/^[A-Za-z0-9_-]+$/.test(parts[0]) ||
    !/^[A-Za-z0-9_-]{43}$/.test(parts[1])
  )
    return invalid;
  const [encoded, signature] = parts;
  const actual = Buffer.from(signature, "base64url");
  const expected = crypto
    .createHmac("sha256", getSigningKey("password-reset-token"))
    .update(encoded)
    .digest();
  if (
    actual.length !== expected.length ||
    !crypto.timingSafeEqual(actual, expected)
  )
    return invalid;
  let payload: ResetTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return invalid;
  }
  const now = Date.now();
  if (
    !payload ||
    payload.v !== 2 ||
    payload.email !== normalizedEmail ||
    typeof payload.salt !== "string" ||
    !/^[a-f0-9]{32}$/.test(payload.salt) ||
    typeof payload.passwordVersion !== "string" ||
    !/^[a-f0-9]{64}$/.test(payload.passwordVersion) ||
    typeof payload.codeHash !== "string" ||
    !/^[a-f0-9]{64}$/.test(payload.codeHash) ||
    !Number.isSafeInteger(payload.issuedAt) ||
    !Number.isSafeInteger(payload.expiresAt) ||
    payload.issuedAt > now + 60000 ||
    payload.expiresAt <= now ||
    payload.expiresAt <= payload.issuedAt ||
    payload.expiresAt - payload.issuedAt > MAX_LIFETIME_MS
  )
    return invalid;
  // A successful password change changes the bcrypt hash, invalidating every older reset token.
  if (
    !crypto.timingSafeEqual(
      Buffer.from(payload.passwordVersion, "hex"),
      Buffer.from(passwordVersion(passwordHash), "hex"),
    )
  )
    return invalid;
  const actualCode = Buffer.from(payload.codeHash, "hex");
  const expectedCode = Buffer.from(
    codeDigest(cleanCode, payload.salt, normalizedEmail),
    "hex",
  );
  return crypto.timingSafeEqual(actualCode, expectedCode)
    ? { valid: true }
    : { valid: false, error: "Баталгаажуулах 6 оронтой код буруу байна." };
}
