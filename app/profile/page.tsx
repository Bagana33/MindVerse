import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { ProfileView } from "../../components/profile/ProfileView";

export const metadata: Metadata = {
  title: "Профайл · Mind Verse",
  description: "Бүтээлчийн танилцуулга, бүтээлүүд болон суралцах ахиц.",
};

export default function ProfilePage() {
  return (
    <DashboardLayout>
      <Suspense
        fallback={
          <div className="mv-panel p-6 text-sm text-slate-400" role="status">
            Профайл ачаалж байна…
          </div>
        }
      >
        <ProfileView />
      </Suspense>
    </DashboardLayout>
  );
}
