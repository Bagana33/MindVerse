import type { Metadata } from "next";
import { LoginForm } from "../../components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Нэвтрэх · Mind Verse",
  description: "Mind Verse-д нэвтэрч, бүтээлээ хуваалцан хамтдаа суралцаарай.",
};

export default function LoginPage() {
  return <LoginForm />;
}
