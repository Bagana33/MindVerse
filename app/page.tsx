"use client";

import { Suspense } from "react";
import { DashboardLayout } from "../components/layout/DashboardLayout";
import { HomeDashboard } from "../components/home/HomeDashboard";

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-dark-950">
        <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      </div>
    }>
      <DashboardLayout>
        <HomeDashboard />
      </DashboardLayout>
    </Suspense>
  );
}

