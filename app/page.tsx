"use client";

import { DashboardLayout } from "../components/layout/DashboardLayout";
import { HomeDashboard } from "../components/home/HomeDashboard";
import { useSession } from "../components/auth/useSession";

export default function HomePage() {
  const { session, loading } = useSession();

  // Show loading state only briefly while checking session
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-950" suppressHydrationWarning>
        <div className="text-slate-400">Уншиж байна...</div>
      </div>
    );
  }

  // Allow viewing without login (бүтээл харах зорилгоор) — no redirect
  return (
    <DashboardLayout>
      <HomeDashboard />
    </DashboardLayout>
  );
}
