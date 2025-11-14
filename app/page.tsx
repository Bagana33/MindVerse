import { NeonLayout } from "../components/layout/NeonLayout";
import { HomeFeed } from "../components/home/HomeFeed";
import { LeaderboardSidebar } from "../components/leaderboard/LeaderboardTable";

export default function HomePage() {
  return (
    <NeonLayout>
      <div>
        <HomeFeed />
      </div>
      <aside className="space-y-4">
        <LeaderboardSidebar compact />
      </aside>
    </NeonLayout>
  );
}
