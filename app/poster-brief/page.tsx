import type { Metadata } from "next";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { PosterBriefGenerator } from "../../components/poster-brief/PosterBriefGenerator";

export const metadata: Metadata = {
  title: "Постерын санаа · Mind Verse",
  description: "Постер хийх санаа, зорилго, бичвэр, өнгөний санал болон алхмаа нэг товч дараад аваарай.",
};

export default function PosterBriefPage() {
  return <DashboardLayout><PosterBriefGenerator /></DashboardLayout>;
}
