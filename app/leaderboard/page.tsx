"use client";

import { Suspense } from "react";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { LeaderboardFull } from "../../components/leaderboard/LeaderboardTable";

export default function LeaderboardPage() {
  return (
    <Suspense fallback={
      <DashboardLayout>
        <div className="p-8 text-slate-400">Ачаалж байна...</div>
      </DashboardLayout>
    }>
      <DashboardLayout>
        <LeaderboardFull />
      </DashboardLayout>
    </Suspense>
  );
}
