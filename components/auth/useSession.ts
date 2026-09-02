"use client";

import { useGlobalSession, ClientSession, SessionProvider } from "./SessionContext";

export type { ClientSession };
export { SessionProvider };

export function useSession() {
  return useGlobalSession();
}

