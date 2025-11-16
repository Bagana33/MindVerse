import type { ReactNode } from "react";
import { Topbar } from "./Topbar";
import StudentAssistant from "../assistant/StudentAssistant";

export function NeonLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Animated background elements */}
      <div className="fixed inset-0 -z-10" aria-hidden="true">
        {/* Gradient orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 right-1/3 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '4s' }} />
        
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.03)_1px,transparent_1px)] bg-[size:72px_72px]" />
      </div>
      
      <Topbar />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 pb-10 pt-6 grid gap-6 md:grid-cols-[1.8fr,0.9fr]">
        {children}
      </main>

  <StudentAssistant />
  <footer className="w-full max-w-6xl mx-auto px-4 pb-8 pt-2 text-center text-xs text-slate-500 border-t border-slate-800/50">
        <div className="flex items-center justify-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Mind Verse · Graphic Design & Learning · {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
