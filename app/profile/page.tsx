import { NeonLayout } from "../../components/layout/NeonLayout";
import { ProfileView } from "../../components/profile/ProfileView";
import { LeaderboardSidebar } from "../../components/leaderboard/LeaderboardTable";

export default function ProfilePage() {
  return (
    <NeonLayout>
      <ProfileView />
      <aside>
        <LeaderboardSidebar compact />
      </aside>
    </NeonLayout>
  );
}
