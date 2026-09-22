"use client";

import { useEffect, useRef, useState } from "react";
import {
  BRIEF_CATEGORIES, BRIEF_FORMATS, BRIEF_LEVELS, POSTER_TEMPLATE_COUNT,
  formatBriefText, generatePosterBrief, isPosterBrief,
  type BriefOptions, type PosterBrief,
} from "../../lib/posterBriefs";

const SAVED_KEY = "mindverse:poster-brief:saved:v1";
const CURRENT_KEY = "mindverse:poster-brief:current:v1";
const MAX_SAVED = 8;
const categoryMarks: Record<string, string> = {
  school: "✎", culture: "◈", environment: "↟", sport: "↗", music: "♫", technology: "⌘",
};

function Icon({ name, className = "" }: { name: "spark" | "copy" | "save" | "check" | "download" | "arrow"; className?: string }) {
  return <svg className={`h-5 w-5 shrink-0 ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === "spark" && <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z" /><path d="M20 2v4m-2-2h4" /></>}
    {name === "copy" && <><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>}
    {name === "save" && <path d="M6 4h12v17l-6-4-6 4Z" />}
    {name === "check" && <path d="m5 12 4 4L19 6" />}
    {name === "download" && <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></>}
    {name === "arrow" && <path d="M4 12h16m-6-6 6 6-6 6" />}
  </svg>;
}

export function PosterBriefGenerator() {
  const [options, setOptions] = useState<BriefOptions>({ category: "all", level: "beginner", format: "a3" });
  const [brief, setBrief] = useState<PosterBrief | null>(null);
  const [saved, setSaved] = useState<PosterBrief[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [notice, setNotice] = useState("");
  const [storageError, setStorageError] = useState("");
  const [copyFallback, setCopyFallback] = useState(false);
  const [checked, setChecked] = useState<number[]>([]);
  const [generation, setGeneration] = useState(0);
  const [copying, setCopying] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shouldFocus = useRef(false);
  const copyGeneration = useRef(0);
  const fallbackRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      const rawSaved = window.localStorage.getItem(SAVED_KEY);
      if (rawSaved) {
        const items: unknown = JSON.parse(rawSaved);
        if (Array.isArray(items)) {
          const unique = new Map<string, PosterBrief>();
          items.filter(isPosterBrief).forEach(item => unique.set(item.id, item));
          setSaved([...unique.values()].slice(0, MAX_SAVED));
        }
      }
    } catch { setStorageError("Хадгалсан санаануудыг уншиж чадсангүй. Шинэ санаа гаргаж, TXT файлаар татаж болно."); }
    try {
      const rawCurrent = window.localStorage.getItem(CURRENT_KEY);
      if (rawCurrent) {
        const current: unknown = JSON.parse(rawCurrent);
        if (isPosterBrief(current)) {
          setBrief(current);
          setOptions({ category: current.category.id, level: current.level.id, format: current.format.id });
        }
      }
    } catch { /* A malformed or inaccessible draft does not block generation. */ }
    setStorageReady(true);
    return () => { copyGeneration.current += 1; };
  }, []);

  useEffect(() => {
    if (!shouldFocus.current || !brief) return;
    shouldFocus.current = false;
    headingRef.current?.focus({ preventScroll: true });
    headingRef.current?.scrollIntoView({ behavior: "instant", block: "start" });
  }, [brief, generation]);

  useEffect(() => {
    if (copyFallback) { fallbackRef.current?.focus(); fallbackRef.current?.select(); }
  }, [copyFallback]);

  function showBrief(next: PosterBrief) {
    copyGeneration.current += 1;
    setCopying(false);
    setBrief(next);
    setChecked([]);
    setCopyFallback(false);
    shouldFocus.current = true;
    setGeneration(value => value + 1);
    try { window.localStorage.setItem(CURRENT_KEY, JSON.stringify(next)); }
    catch { setStorageError("Энэ браузерт санааг хадгалж чадсангүй. TXT файлаар татаж аваарай."); }
  }

  function generate() {
    const next = generatePosterBrief(options, brief?.templateId);
    showBrief(next);
    setNotice(`Шинэ санаа бэлэн: ${next.title}`);
  }

  function saveBrief() {
    if (!brief || saved.some(item => item.id === brief.id)) return;
    if (saved.length >= MAX_SAVED) {
      setNotice("8 санаа хадгалсан байна. Нэгийг нь жагсаалтаас хасаад дахин хадгалаарай.");
      return;
    }
    const next = [brief, ...saved];
    try {
      window.localStorage.setItem(SAVED_KEY, JSON.stringify(next));
      setSaved(next);
      setStorageError("");
      setNotice("Санааг энэ төхөөрөмжид хадгаллаа.");
    } catch { setStorageError("Хадгалж чадсангүй. Браузерын хадгалах зайг шалгах эсвэл TXT файлаар татаж аваарай."); }
  }

  function removeSaved(id: string) {
    const next = saved.filter(item => item.id !== id);
    try {
      window.localStorage.setItem(SAVED_KEY, JSON.stringify(next));
      setSaved(next);
      setStorageError("");
      setNotice("Санааг хадгалсан жагсаалтаас хаслаа.");
    } catch { setStorageError("Жагсаалтыг шинэчилж чадсангүй. Дахин оролдоно уу."); }
  }

  async function copyBrief() {
    if (!brief || copying) return;
    const request = ++copyGeneration.current;
    setCopying(true);
    setCopyFallback(false);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        navigator.clipboard.writeText(formatBriefText(brief)),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error("clipboard-timeout")), 3000);
        }),
      ]);
      if (request === copyGeneration.current) setNotice("Даалгаврын бичвэрийг хууллаа.");
    } catch {
      if (request === copyGeneration.current) {
        setCopyFallback(true);
        setNotice("Автоматаар хуулж чадсангүй. Доорх сонгосон бичвэрийг Ctrl+C эсвэл ⌘C дарж хуулна уу.");
      }
    } finally {
      clearTimeout(timeout);
      if (request === copyGeneration.current) setCopying(false);
    }
  }

  function downloadBrief() {
    if (!brief) return;
    const url = URL.createObjectURL(new Blob(["\uFEFF", formatBriefText(brief)], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `mindverse-poster-${brief.templateId}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("TXT файлын таталтыг эхлүүллээ.");
  }

  const isSaved = !!brief && saved.some(item => item.id === brief.id);
  const selectedLevel = BRIEF_LEVELS.find(item => item.id === options.level)!;

  return <div className="mv-page">
    <header className="mv-page-header">
      <div><p className="mv-eyebrow">Бүтээлч эхлэл · Poster Brief Generator</p><h1 className="mv-title">Постерын санаа</h1><p className="mv-subtitle">Юу хийхээ мэдэхгүй байна уу? Нэг санаа аваад, өөрийнхөөрөө бүтээ.</p></div>
      <div className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/10 px-4 py-2 text-sm text-violet-200"><span className="h-2 w-2 rounded-full bg-lime-300" aria-hidden="true" />{POSTER_TEMPLATE_COUNT} сэдэв · хязгааргүй оролдлого</div>
    </header>

    <div role="status" aria-live="polite" className={notice ? "rounded-xl border border-violet-400/20 bg-violet-500/10 px-4 py-3 text-sm text-violet-100" : "sr-only"}>{notice}</div>
    {storageError && <p role="alert" className="rounded-xl border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm leading-relaxed text-amber-100">{storageError}</p>}

    <div className="grid items-start gap-6 xl:grid-cols-[290px_minmax(0,1fr)] xl:grid-rows-[auto_1fr] 2xl:grid-cols-[320px_minmax(0,1fr)]">
      <section aria-labelledby="brief-settings" className="mv-panel order-1 min-w-0 xl:col-start-1 xl:row-start-1">
        <div className="mb-6 flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 text-violet-200"><Icon name="spark" /></span><h2 id="brief-settings" className="text-lg font-semibold text-white">Санаагаа чиглүүл</h2></div>
        <fieldset><legend className="mv-label">01 / Сэдэв</legend><div className="grid grid-cols-2 gap-2">
          {[{ id: "all", label: "Надад сонгоод өг" }, ...BRIEF_CATEGORIES].map(category => <button key={category.id} type="button" aria-pressed={options.category === category.id} onClick={() => setOptions(value => ({ ...value, category: category.id }))}
            className={`${category.id === "all" ? "col-span-2" : ""} flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${options.category === category.id ? "border-violet-400/60 bg-violet-500/15 text-violet-100" : "border-white/10 text-slate-300 hover:border-white/25 hover:bg-white/5"}`}><span className="text-base text-violet-300" aria-hidden="true">{categoryMarks[category.id] || "✦"}</span>{category.label}</button>)}
        </div></fieldset>
        <div className="mt-6"><label htmlFor="brief-level" className="mv-label">02 / Сорилтын түвшин</label><select id="brief-level" className="mv-field" value={options.level} onChange={event => setOptions(value => ({ ...value, level: event.target.value }))}>{BRIEF_LEVELS.map(level => <option key={level.id} value={level.id}>{level.label} · {level.minutes} мин</option>)}</select><p className="mt-2 text-xs leading-5 text-slate-400">{selectedLevel.description}</p></div>
        <div className="mt-5"><label htmlFor="brief-format" className="mv-label">03 / Постерын хэмжээ</label><select id="brief-format" className="mv-field" value={options.format} onChange={event => setOptions(value => ({ ...value, format: event.target.value }))}>{BRIEF_FORMATS.map(format => <option key={format.id} value={format.id}>{format.label} · {format.dimensions}</option>)}</select></div>
        <button type="button" onClick={generate} disabled={!storageReady} className="mv-button-primary mt-6 w-full py-3.5"><Icon name="spark" />{brief ? "Өөр санаа гаргах" : "Санаа гаргах"}<Icon name="arrow" className="ml-auto" /></button>
        <p className="mt-3 text-center text-xs leading-5 text-slate-400">Санаа таалагдахгүй бол дахин дарж болно.</p>
      </section>

      <section aria-label="Постерын даалгавар" className="order-2 min-w-0 xl:col-start-2 xl:row-span-2 xl:row-start-1">
        {brief ? <article className="overflow-hidden rounded-2xl border border-white/10 bg-[#f4f1e9] text-[#232334]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#262139]/10 px-6 py-4 text-xs font-semibold sm:px-8"><span className="tracking-[.14em]">MIND VERSE / БҮТЭЭЛИЙН ДААЛГАВАР</span><span className="rounded-full bg-[#262139]/5 px-3 py-1.5">{brief.category.label} · {brief.level.minutes} мин</span></div>
          <div className="p-6 sm:p-8 lg:p-9">
            <div className="mb-5 flex flex-wrap gap-2 text-xs font-medium"><span className="rounded-md border border-[#262139]/15 px-2.5 py-1">{brief.level.label}</span><span className="rounded-md border border-[#262139]/15 px-2.5 py-1">{brief.format.label} · {brief.format.dimensions}</span></div>
            <h2 ref={headingRef} tabIndex={-1} className="scroll-mt-20 text-3xl font-bold leading-tight tracking-tight text-[#252039] outline-violet-600 sm:text-4xl lg:scroll-mt-6">{brief.title}</h2>
            <p className="mt-4 max-w-3xl text-base leading-7 text-[#54505f]">{brief.goal}</p>
            <dl className="mt-6 grid gap-5 border-y border-[#262139]/10 py-5 sm:grid-cols-2"><div><dt className="text-xs font-semibold uppercase tracking-wider text-[#6d637b]">Хэнд зориулж?</dt><dd className="mt-1.5 text-sm font-medium leading-6">{brief.audience}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-wider text-[#6d637b]">Захиалагчийн дүр</dt><dd className="mt-1.5 text-sm font-medium leading-6">{brief.client}</dd></div></dl>

            <section aria-labelledby="poster-copy-heading" className="relative mt-7 overflow-hidden rounded-xl bg-[#242037] p-5 text-white sm:p-6"><div className="absolute right-0 top-0 h-20 w-20 rounded-bl-[100%] bg-[#d9fa86]/10" aria-hidden="true" /><h3 id="poster-copy-heading" className="relative text-xs font-medium uppercase tracking-[.15em] text-[#d9fa86]">Постерт оруулах бичвэр</h3><p className="relative mt-4 text-2xl font-bold leading-snug sm:text-3xl">{brief.headline}</p><p className="mt-3 text-sm leading-6 text-slate-200">{brief.body}</p><p className="mt-5 inline-flex rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-[#d9fa86]">{brief.callToAction} <span className="ml-3" aria-hidden="true">↗</span></p></section>

            <div className="mt-7 grid gap-7 2xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <section><h3 className="text-base font-bold">Заавал оруулах зүйлс</h3><ul className="mt-3 space-y-3">{brief.requirements.map((requirement, index) => <li key={requirement} className="flex gap-3 text-sm leading-6"><span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#262139]/[0.07] text-xs font-bold text-[#6d3fcc]">{index + 1}</span><span>{requirement}</span></li>)}</ul></section>
              <section><h3 className="text-base font-bold">Эхлэх нэг санаа</h3><p className="mt-3 text-sm leading-6 text-[#54505f]">{brief.conceptStarter}</p><div className="mt-4 border-l-2 border-[#9872e8] pl-4"><p className="text-xs font-bold uppercase tracking-wider text-[#7447b6]">Нэмэлт сорилт</p><p className="mt-1.5 text-sm leading-6">{brief.challenge}</p></div></section>
            </div>

            <section className="mt-7 border-t border-[#262139]/10 pt-6"><div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-base font-bold">Өнгөний эхлэл</h3><p className="text-xs text-[#65606d]">Өөрийн палитраар сольж болно</p></div><div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">{brief.palette.map(color => <div key={color.hex} className="min-w-0"><div className="h-14 rounded-lg border border-black/10 sm:h-16" style={{ backgroundColor: color.hex }} aria-hidden="true" /><p className="mt-2 break-words text-xs font-medium leading-5">{color.name}</p><p className="font-mono text-xs text-[#65606d]">{color.hex}</p></div>)}</div></section>

            <section className="mt-7 border-t border-[#262139]/10 pt-6"><h3 className="text-base font-bold">Одоо хийж эхэл</h3><ol className="mt-4 space-y-4">{brief.steps.map((step, index) => <li key={step.title} className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-start gap-3"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#e5deed] text-xs font-bold">{index + 1}</span><div><p className="text-sm font-semibold leading-6">{step.title}</p><p className="mt-0.5 text-sm leading-6 text-[#65606d]">{step.description}</p></div><span className="rounded-md bg-[#262139]/5 px-2 py-1 text-xs font-semibold tabular-nums">{step.minutes} мин</span></li>)}</ol></section>

            <section className="mt-7 rounded-xl border border-[#262139]/10 bg-white/[0.45] p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><h3 className="text-base font-bold">Дуусгахаасаа өмнө</h3><span className="text-xs font-semibold text-[#6d637b]">{checked.length}/{brief.checklist.length}</span></div><div className="mt-3 space-y-1">{brief.checklist.map((item, index) => <label key={`${brief.id}-${index}`} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg py-2 text-sm leading-6"><input type="checkbox" checked={checked.includes(index)} onChange={() => setChecked(value => value.includes(index) ? value.filter(i => i !== index) : [...value, index])} className="mt-1 h-4 w-4 shrink-0 accent-violet-600" /><span>{item}</span></label>)}</div></section>
            <div className="mt-6 flex gap-3 rounded-lg border-l-2 border-[#9ca776] bg-[#e8eddb] p-4 text-sm leading-6"><Icon name="download" className="mt-0.5 text-[#5a6642]" /><div><span className="font-semibold">Гаргах файл: </span>{brief.format.delivery}</div></div>
            <p className="mt-5 text-xs leading-5 text-[#6d637b]">Энэ бол дадлагын зохиомол захиалга. Санааг эхлэл болгон ашиглаад, дүрслэлээ өөрөө бүтээгээрэй.</p>
          </div>
          <footer className="flex flex-wrap gap-2 border-t border-white/10 bg-[#171522] p-4 sm:px-8 sm:py-5"><button type="button" className="mv-button-primary" onClick={saveBrief} disabled={isSaved || !storageReady}><Icon name={isSaved ? "check" : "save"} />{isSaved ? "Хадгалсан" : "Санаагаа хадгалах"}</button><button type="button" onClick={copyBrief} disabled={copying} className="mv-button-secondary"><Icon name="copy" />{copying ? "Хуулж байна…" : "Хуулах"}</button><button type="button" onClick={downloadBrief} className="mv-button-secondary"><Icon name="download" />TXT татах</button>{notice && <p aria-hidden="true" className="mt-1 w-full text-xs leading-5 text-violet-200">{notice}</p>}</footer>
        </article> : <div className="flex min-h-[540px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#131323] sm:min-h-[640px]">
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 text-xs text-slate-400"><span>САНААНЫ ЛАБОРАТОРИ</span><span aria-hidden="true">✦ &nbsp; ↗</span></div>
          <div className="relative flex flex-1 flex-col justify-center overflow-hidden p-7 sm:p-12"><div className="pointer-events-none absolute -right-16 top-10 h-64 w-64 rounded-full border-[40px] border-violet-500/10 sm:h-80 sm:w-80" aria-hidden="true" /><p className="relative mb-5 text-xs font-semibold uppercase tracking-[.2em] text-[#d9fa86]">Хоосон хуудас бол эхлэл.</p><h2 className="relative max-w-lg text-4xl font-bold leading-[1.15] tracking-tight text-white sm:text-5xl">Дараагийн<br />постер чинь<br /><span className="text-violet-300">ямар байх вэ?</span></h2><p className="relative mt-6 max-w-md text-sm leading-7 text-slate-400 sm:text-base">Сэдэв, түвшин, хэмжээгээ сонго. Эсвэл шууд товч дараад шинэ санаагаар өөрийгөө сориорой.</p><button type="button" onClick={generate} disabled={!storageReady} className="mv-button-primary relative mt-7 w-fit"><Icon name="spark" />Эхний санаагаа авах<Icon name="arrow" /></button></div>
          <div className="grid grid-cols-3 border-t border-white/10 bg-white/[.02] text-center text-xs text-slate-400"><p className="px-2 py-5"><span className="mb-1 block font-semibold text-slate-100">01</span>Санаагаа ав</p><p className="border-x border-white/10 px-2 py-5"><span className="mb-1 block font-semibold text-slate-100">02</span>Нооргоо гарга</p><p className="px-2 py-5"><span className="mb-1 block font-semibold text-slate-100">03</span>Өөрийнхөөрөө бүтээ</p></div>
        </div>}
        {copyFallback && brief && <div className="mv-panel mt-4"><label htmlFor="brief-copy-text" className="mv-label">Даалгаврын бичвэр — сонгоод хуулна уу</label><textarea id="brief-copy-text" ref={fallbackRef} readOnly rows={12} className="mv-field text-sm" value={formatBriefText(brief)} /><button type="button" onClick={() => { fallbackRef.current?.focus(); fallbackRef.current?.select(); }} className="mv-button-secondary mt-3">Бүгдийг сонгох</button></div>}
      </section>

      <section aria-labelledby="saved-briefs-heading" className="mv-panel order-3 min-w-0 xl:col-start-1 xl:row-start-2"><div className="flex items-center justify-between gap-2"><h2 id="saved-briefs-heading" className="text-base font-semibold text-white">Миний санаанууд</h2><span className="text-xs tabular-nums text-slate-400">{saved.length}/{MAX_SAVED}</span></div><p className="mt-2 text-xs leading-5 text-slate-400">Зөвхөн энэ төхөөрөмжийн браузерт хадгална.</p>
        {saved.length ? <ul className="mt-4 divide-y divide-white/10">{saved.map(item => <li key={item.id} className="flex items-start gap-1 py-3"><button type="button" onClick={() => { setOptions({ category: item.category.id, level: item.level.id, format: item.format.id }); showBrief(item); setNotice(`Хадгалсан санааг нээлээ: ${item.title}`); }} className="min-h-11 min-w-0 flex-1 rounded-lg p-1 text-left hover:bg-white/5"><span className="block text-sm font-medium leading-6 text-slate-100">{item.title}</span><span className="mt-1 block text-xs leading-5 text-slate-400">{item.level.label} · {item.format.label}</span></button><button type="button" aria-label={`${item.title} санааг хадгалсан жагсаалтаас хасах`} onClick={() => removeSaved(item.id)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-xl text-slate-400 hover:bg-rose-400/10 hover:text-rose-200">×</button></li>)}</ul> : <div className="mt-4 rounded-xl border border-dashed border-white/15 px-4 py-6 text-center"><Icon name="save" className="mx-auto mb-3 text-violet-300" /><p className="text-sm leading-6 text-slate-400">Таалагдсан санаагаа хадгалаад<br />дараа нь үргэлжлүүлээрэй.</p></div>}
      </section>
    </div>
  </div>;
}
