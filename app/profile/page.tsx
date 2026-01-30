"use client";

import { Suspense } from "react";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { ProfileView } from "../../components/profile/ProfileView";

export default function ProfilePage() {
  return (
    <DashboardLayout>
      <Suspense fallback={<div className="flex min-h-[200px] items-center justify-center text-slate-500">Уншиж байна...</div>}>
        <ProfileView />
      </Suspense>
    </DashboardLayout>
  );
}
