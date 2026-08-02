"use client";

import { useEffect, useState } from "react";

export type ClientSession = {
  email: string;
  name?: string;
  nickname?: string;
  role: "student" | "teacher";
  avatarUrl?: string;
  avatarColor?: string;
} | null;

export function useSession() {
  const [session, setSession] = useState<ClientSession>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setSession(json.session);
      } else {
        setSession(null);
      }
    } catch {
      setSession(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    await refresh();
    // Redirect to login page after logout
    window.location.href = "/login";
  }

  return { session, loading, refresh, logout } as const;
}
