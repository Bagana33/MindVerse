"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";

export type ClientSession = {
  email: string;
  name?: string;
  nickname?: string;
  role: "student" | "teacher";
  avatarUrl?: string;
  avatarColor?: string;
} | null;

type SessionContextType = {
  session: ClientSession;
  loading: boolean;
  refresh: () => Promise<ClientSession>;
  logout: () => Promise<void>;
};

const SessionContext = createContext<SessionContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = "mindverse_session_cache";

function getLocalCachedSession(): ClientSession {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.email && (parsed.role === "student" || parsed.role === "teacher")) {
      return parsed as ClientSession;
    }
  } catch {}
  return null;
}

function setLocalCachedSession(session: ClientSession) {
  if (typeof window === "undefined") return;
  try {
    if (session) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  } catch {}
}

// Global in-flight request deduplicator to prevent duplicate network calls across components
let inFlightSessionPromise: Promise<ClientSession> | null = null;
let cachedSession: ClientSession | null = null;
let hasLoadedOnce = false;

async function fetchSessionDeduplicated(): Promise<ClientSession> {
  if (inFlightSessionPromise) {
    return inFlightSessionPromise;
  }

  inFlightSessionPromise = (async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        cachedSession = json.session || null;
      } else {
        cachedSession = null;
      }
    } catch {
      // On network error keep cached session if available
    } finally {
      hasLoadedOnce = true;
      inFlightSessionPromise = null;
      setLocalCachedSession(cachedSession);
    }
    return cachedSession;
  })();

  return inFlightSessionPromise;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<ClientSession>(() => {
    if (cachedSession) return cachedSession;
    const local = getLocalCachedSession();
    if (local) {
      cachedSession = local;
      return local;
    }
    return null;
  });

  const [loading, setLoading] = useState<boolean>(() => {
    if (cachedSession || getLocalCachedSession()) return false;
    return !hasLoadedOnce;
  });

  const mountedRef = useRef(true);

  const refresh = useCallback(async (): Promise<ClientSession> => {
    const current = await fetchSessionDeduplicated();
    if (mountedRef.current) {
      setSession(current);
      setLoading(false);
    }
    return current;
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    cachedSession = null;
    hasLoadedOnce = true;
    setLocalCachedSession(null);
    if (mountedRef.current) {
      setSession(null);
    }
    window.location.href = "/login";
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    // Always validate session in background
    refresh();
    return () => {
      mountedRef.current = false;
    };
  }, [refresh]);

  return (
    <SessionContext.Provider value={{ session, loading, refresh, logout }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useGlobalSession(): SessionContextType {
  const context = useContext(SessionContext);
  if (!context) {
    const local = getLocalCachedSession();
    return {
      session: cachedSession || local,
      loading: !hasLoadedOnce && !local,
      refresh: fetchSessionDeduplicated,
      logout: async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        setLocalCachedSession(null);
        window.location.href = "/login";
      }
    };
  }
  return context;
}

