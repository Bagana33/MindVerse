"use client";

import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { ProfileView } from "../../components/profile/ProfileView";

export default function ProfilePage() {
  return (
    <DashboardLayout>
      <ProfileView />
    </DashboardLayout>
  );
}
