"use client";

import { Suspense } from "react";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { LeaderboardFull } from "../../components/leaderboard/LeaderboardTable";

export default function LeaderboardPage() {
  return (
    <DashboardLayout>
      <Suspense
        fallback={
          <div className="mv-page">
            <header className="mv-page-header">
              <div>
                <p className="mv-eyebrow">MINDVERSE · АХИЦ</p>
                <h1 className="mv-title">Сурагчдын чансаа</h1>
                <p className="mv-subtitle">
                  Бүтээл бүрээр ур чадвараа ахиулж, дараагийн түвшинд хүрээрэй.
                </p>
              </div>
            </header>
            <div role="status" className="mv-panel p-6 text-sm text-slate-300">
              Чансааг ачаалж байна…
            </div>
          </div>
        }
      >
        <LeaderboardFull />
      </Suspense>
    </DashboardLayout>
  );
}
