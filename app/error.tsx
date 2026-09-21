"use client";
import Link from "next/link";
import { DashboardLayout } from "../components/layout/DashboardLayout";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <DashboardLayout><section className="mv-page py-12"><div role="alert" className="mv-status mx-auto max-w-xl">
    <p className="mv-eyebrow">Түр алдаа</p><h1 className="mv-title">Хуудсыг нээж чадсангүй.</h1>
    <p className="mv-subtitle mx-auto">Холболтоо шалгаад дахин оролдоно уу.</p>
    <div className="mt-7 flex flex-wrap justify-center gap-3"><button className="mv-button-primary" onClick={reset}>Дахин оролдох</button><Link href="/" className="mv-button-secondary">Нүүр хуудас</Link></div>
  </div></section></DashboardLayout>;
}
