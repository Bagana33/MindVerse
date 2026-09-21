export default function Loading() {
  return <div role="status" aria-live="polite" className="mx-auto max-w-5xl space-y-5 p-6 sm:p-12">
    <span className="sr-only">Хуудсыг ачаалж байна…</span>
    <div className="h-10 w-2/3 animate-pulse rounded-xl bg-white/10" />
    <div className="h-5 w-1/2 animate-pulse rounded-lg bg-white/5" />
    <div className="grid gap-5 sm:grid-cols-2">{[0,1,2,3].map(i => <div key={i} className="h-52 animate-pulse rounded-2xl border border-white/10 bg-white/5" />)}</div>
  </div>;
}
