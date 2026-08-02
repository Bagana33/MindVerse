"use client";

import { Suspense } from "react";
import { DashboardLayout } from "../components/layout/DashboardLayout";
import { HomeDashboard } from "../components/home/HomeDashboard";
import { useSession } from "../components/auth/useSession";

function HomeContent() {
  const { session, loading } = useSession();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-950" suppressHydrationWarning>
        <div className="text-slate-400">Уншиж байна...</div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <HomeDashboard />
    </DashboardLayout>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-dark-950">
        <div className="text-slate-400">Уншиж байна...</div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
