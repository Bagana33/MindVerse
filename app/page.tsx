"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "../components/layout/DashboardLayout";
import { HomeDashboard } from "../components/home/HomeDashboard";
import { useSession } from "../components/auth/useSession";

export default function HomePage() {
  const { session, loading } = useSession();
  const router = useRouter();

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!loading && !session) {
      router.push("/login");
    }
  }, [session, loading, router]);

  // Show loading state while checking session
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-950">
        <div className="text-slate-400">Уншиж байна...</div>
      </div>
    );
  }

  // Don't render home if not logged in
  if (!session) {
    return null;
  }

  return (
    <DashboardLayout>
      <HomeDashboard />
    </DashboardLayout>
  );
}
