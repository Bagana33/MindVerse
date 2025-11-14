import { NeonLayout } from "../../components/layout/NeonLayout";
import { LeaderboardFull } from "../../components/leaderboard/LeaderboardTable";

export default function LeaderboardPage() {
  return (
    <NeonLayout>
      <div className="md:col-span-2">
        <LeaderboardFull />
      </div>
      <aside className="hidden md:block" />
    </NeonLayout>
  );
}
