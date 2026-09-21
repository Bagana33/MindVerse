import Link from "next/link";
import { DashboardLayout } from "../components/layout/DashboardLayout";

export default function NotFound() {
  return <DashboardLayout><section className="mv-page py-12"><div className="mv-status mx-auto max-w-xl">
    <p className="mv-eyebrow">404 · Хуудас олдсонгүй</p>
    <h1 className="mv-title">Энэ холбоос өөрчлөгдсөн бололтой.</h1>
    <p className="mv-subtitle mx-auto">Холбоосоо шалгаарай. Эсвэл нүүр хуудас руу очоод хэрэгтэй бүтээл, хичээлээ олоорой.</p>
    <div className="mt-7 flex flex-wrap justify-center gap-3"><Link href="/" className="mv-button-primary">Нүүр хуудас</Link><Link href="/lessons" className="mv-button-secondary">Хичээлүүд</Link></div>
  </div></section></DashboardLayout>;
}
