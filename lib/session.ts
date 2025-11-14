import { cookies, headers } from "next/headers";
import crypto from "crypto";

export type Role = "student" | "teacher";
export type Session = {
  email: string;
  name?: string;
  role: Role;
};

const COOKIE_NAME = "nc_session";
const DEFAULT_SECRET = "dev-secret-change-me"; // for demo only

function getSecret(): string {
  // Prefer env var if provided
  const h = headers();
  const secret = process.env.NC_SESSION_SECRET || DEFAULT_SECRET;
  return secret;
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

export function encodeSession(session: Session): string {
  const secret = getSecret();
  const json = JSON.stringify(session);
  const b64 = base64url(json);
  const sig = sign(b64, secret);
  return `${b64}.${sig}`;
}

export function decodeSession(token: string | undefined | null): Session | null {
  if (!token) return null;
  const secret = getSecret();
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [b64, sig] = parts;
  const expected = sign(b64, secret);
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return null;
  }
  try {
    const json = Buffer.from(b64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const data = JSON.parse(json) as Session;
    if (!data || !data.email || (data.role !== "student" && data.role !== "teacher")) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export async function getSessionFromCookies(): Promise<Session | null> {
  const c = await cookies();
  const token = c.get(COOKIE_NAME)?.value;
  return decodeSession(token);
}

export async function setSessionCookie(session: Session): Promise<void> {
  const c = await cookies();
  const token = encodeSession(session);
  c.set(COOKIE_NAME, token, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export async function clearSessionCookie(): Promise<void> {
  const c = await cookies();
  c.delete(COOKIE_NAME);
}
