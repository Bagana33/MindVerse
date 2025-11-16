"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { NeonLayout } from "../components/layout/NeonLayout";
import { HomeFeed } from "../components/home/HomeFeed";
import { LeaderboardSidebar } from "../components/leaderboard/LeaderboardTable";
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-400">Уншиж байна...</div>
      </div>
    );
  }

  // Don't render home if not logged in
  if (!session) {
    return null;
  }

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
