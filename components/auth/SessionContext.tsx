"use client";

import { clearCache } from "../../lib/fetchCache";

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
let sessionRevision = 0;
let sessionRequest: AbortController | null = null;

async function fetchSessionDeduplicated(): Promise<ClientSession> {
  if (inFlightSessionPromise) {
    return inFlightSessionPromise;
  }

  const revision = sessionRevision;
  const controller = new AbortController();
  sessionRequest = controller;
  inFlightSessionPromise = (async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
      if (revision !== sessionRevision) return cachedSession;
      if (res.ok) {
        const json = await res.json();
        if (revision !== sessionRevision) return cachedSession;
        if (cachedSession?.email !== json.session?.email) clearCache();
        cachedSession = json.session || null;
      } else {
        clearCache();
        cachedSession = null;
      }
    } catch {
      // On network error keep cached session if available
    } finally {
      if (revision === sessionRevision) {
        hasLoadedOnce = true;
        inFlightSessionPromise = null;
        sessionRequest = null;
        setLocalCachedSession(cachedSession);
      }
    }
    return cachedSession;
  })();

  return inFlightSessionPromise;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  // Match the server's first render; reading localStorage during hydration
  // changes account menus before React can attach to the existing markup.
  const [session, setSession] = useState<ClientSession>(null);
  const [loading, setLoading] = useState(true);

  const mountedRef = useRef(true);
  const logoutBusy = useRef(false);
  const [logoutError, setLogoutError] = useState("");

  const refresh = useCallback(async (): Promise<ClientSession> => {
    const current = await fetchSessionDeduplicated();
    if (mountedRef.current) {
      setSession(current);
      setLoading(false);
    }
    return current;
  }, []);

  const logout = useCallback(async () => {
    if (logoutBusy.current) return;
    logoutBusy.current = true;
    setLogoutError("");
    ++sessionRevision;
    sessionRequest?.abort();
    sessionRequest = null;
    inFlightSessionPromise = null;
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error("logout");
    } catch {
      if (mountedRef.current) setLogoutError("Бүртгэлээс гарч чадсангүй. Холболтоо шалгаад дахин оролдоно уу.");
      logoutBusy.current = false;
      return;
    }
    // A refresh may have begun while the logout request was pending.
    ++sessionRevision;
    sessionRequest?.abort();
    sessionRequest = null;
    inFlightSessionPromise = null;
    clearCache();
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
    if (!cachedSession) cachedSession = getLocalCachedSession();
    // Always validate session in background
    refresh();
    return () => {
      mountedRef.current = false;
    };
  }, [refresh]);

  return (
    <SessionContext.Provider value={{ session, loading, refresh, logout }}>
      {children}
      {logoutError && <div role="alert" className="fixed bottom-5 left-1/2 z-[100] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 rounded-2xl border border-rose-400/40 bg-slate-900 p-4 text-sm text-rose-200 shadow-xl"><p>{logoutError}</p><div className="mt-2 flex gap-3"><button className="min-h-11 font-semibold underline" onClick={() => void logout()}>Дахин гарах</button><button className="min-h-11 text-slate-300" onClick={() => setLogoutError("")}>Хаах</button></div></div>}
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
        clearCache();
        setLocalCachedSession(null);
        window.location.href = "/login";
      }
    };
  }
  return context;
}
