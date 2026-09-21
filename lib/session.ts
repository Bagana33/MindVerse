import { cookies } from "next/headers";
import crypto from "node:crypto";
import { getSigningKey, SigningConfigurationError } from "./signingKey";

export type Role = "student" | "teacher";
export type Session = {
  email: string;
  name?: string;
  nickname?: string;
  role: Role;
  avatarUrl?: string;
  avatarColor?: string;
};

export const COOKIE_NAME = "nc_session";
const SESSION_LIFETIME_SECONDS = 60 * 60 * 24 * 30;
const TOKEN_VERSION = 2;
const MAX_TOKEN_LENGTH = 4096;

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: SESSION_LIFETIME_SECONDS,
};

function sessionFields(data: unknown): Session | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const value = data as Record<string, unknown>;
  if (
    typeof value.email !== "string" ||
    !value.email.trim() ||
    value.email.length > 320 ||
    (value.role !== "student" && value.role !== "teacher")
  )
    return null;
  const text = (field: unknown, maximum: number) =>
    typeof field === "string" && field.length <= maximum ? field : undefined;
  const avatar = text(value.avatarUrl, 500);
  return {
    email: value.email.trim().toLowerCase(),
    role: value.role,
    name: text(value.name, 200),
    nickname: text(value.nickname, 200),
    avatarUrl: avatar && !avatar.startsWith("data:") ? avatar : undefined,
    avatarColor: text(value.avatarColor, 64),
  };
}

export function encodeSession(session: Session): string {
  const safeSession = sessionFields(session);
  if (!safeSession) throw new Error("Invalid session payload.");
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      ...safeSession,
      v: TOKEN_VERSION,
      iat: issuedAt,
      exp: issuedAt + SESSION_LIFETIME_SECONDS,
    }),
  ).toString("base64url");
  const signature = crypto
    .createHmac("sha256", getSigningKey("session"))
    .update(payload)
    .digest("base64url");
  const token = `${payload}.${signature}`;
  if (token.length > MAX_TOKEN_LENGTH)
    throw new Error("Session payload is too large.");
  return token;
}

export function decodeSession(
  token: string | undefined | null,
): Session | null {
  if (!token || typeof token !== "string" || token.length > MAX_TOKEN_LENGTH)
    return null;
  const key = getSigningKey("session");
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  if (
    !/^[A-Za-z0-9_-]+$/.test(payload) ||
    !/^[A-Za-z0-9_-]{43}$/.test(signature)
  )
    return null;
  const actual = Buffer.from(signature, "base64url");
  const expected = crypto.createHmac("sha256", key).update(payload).digest();
  if (
    actual.length !== expected.length ||
    !crypto.timingSafeEqual(actual, expected)
  )
    return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const now = Math.floor(Date.now() / 1000);
    // Legacy tokens have no enforceable expiry. Require one fresh sign-in during migration.
    if (
      data?.v !== TOKEN_VERSION ||
      !Number.isSafeInteger(data.iat) ||
      !Number.isSafeInteger(data.exp) ||
      data.iat > now + 60 ||
      data.exp <= now ||
      data.exp <= data.iat ||
      data.exp - data.iat > SESSION_LIFETIME_SECONDS
    )
      return null;
    return sessionFields(data);
  } catch {
    return null;
  }
}

export async function getSessionFromCookies(): Promise<Session | null> {
  try {
    const cookieStore = await cookies();
    return decodeSession(cookieStore.get(COOKIE_NAME)?.value);
  } catch (error) {
    if (error instanceof SigningConfigurationError) throw error;
    return null;
  }
}

export async function setSessionCookie(session: Session): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, encodeSession(session), SESSION_COOKIE_OPTIONS);
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
