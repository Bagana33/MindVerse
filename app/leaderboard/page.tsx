"use client";

import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { LeaderboardFull } from "../../components/leaderboard/LeaderboardTable";

export default function LeaderboardPage() {
  return (
    <DashboardLayout>
      <LeaderboardFull />
    </DashboardLayout>
  );
}
