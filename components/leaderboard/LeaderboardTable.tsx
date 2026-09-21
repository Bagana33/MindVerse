"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useSession } from "../auth/useSession";
import { cachedFetch, invalidateCache } from "../../lib/fetchCache";
import { getPersonalizedTitleShort } from "../../lib/rpgTitleGenerator";
import Medal3D from "./Medal3D";
import type { LeaderboardUser } from "./RealmMap";

const RealmMap = dynamic(
  () => import("./RealmMap").then((module) => module.RealmMap),
  {
    loading: () => (
      <div className="mv-panel min-h-64 p-6" role="status">
        Газрын зургийг бэлдэж байна…
      </div>
    ),
  },
);

const RANKS = [
  { value: "all", label: "Бүх түвшин" },
  { value: "beginner", label: "Эхлэгч · 0–99 XP" },
  { value: "intermediate", label: "Дунд · 100–499 XP" },
  { value: "advanced", label: "Ахисан · 500–999 XP" },
  { value: "expert", label: "Мэргэжилтэн · 1,000+ XP" },
];
const RANK_LABELS = {
  beginner: "Эхлэгч",
  intermediate: "Дунд",
  advanced: "Ахисан",
  expert: "Мэргэжилтэн",
};
const rankOf = (xp: number) =>
  xp >= 1000
    ? "expert"
    : xp >= 500
      ? "advanced"
      : xp >= 100
        ? "intermediate"
        : "beginner";
const displayName = (user: LeaderboardUser) =>
  user.nickname || user.name || user.email.split("@")[0];
const xpLabel = (xp: number) => Math.round(xp || 0).toLocaleString("en-US");

function useLeaderboard() {
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    async function load() {
      try {
        const response = await cachedFetch("/api/leaderboard");
        const data = await response.json();
        if (!response.ok || !data.ok || !Array.isArray(data.leaderboard))
          throw new Error("invalid-leaderboard");
        if (active)
          setUsers(
            [...data.leaderboard].sort((a, b) => b.experience - a.experience),
          );
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [attempt]);
  return {
    users,
    loading,
    error,
    retry: () => {
      invalidateCache("/api/leaderboard");
      setAttempt((value) => value + 1);
    },
  };
}

function Avatar({
  user,
  size = "h-11 w-11",
}: {
  user: LeaderboardUser;
  size?: string;
}) {
  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-700 text-sm font-bold text-white ${size}`}
    >
      <span aria-hidden="true">{displayName(user)[0]?.toUpperCase()}</span>
      {user.avatarUrl && (
        <img
          src={user.avatarUrl}
          loading="lazy"
          decoding="async"
          alt=""
          width={48}
          height={48}
          className="absolute inset-0 h-full w-full object-cover"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      )}
    </span>
  );
}

function Rank({ position }: { position: number }) {
  return (
    <span
      className="inline-flex h-9 w-9 items-center justify-center text-sm font-semibold tabular-nums text-slate-300"
      aria-label={`${position}-р байр`}
    >
      {position <= 3 ? (
        <Medal3D
          variant={
            position === 1 ? "gold" : position === 2 ? "silver" : "bronze"
          }
          size={28}
        />
      ) : (
        position
      )}
    </span>
  );
}

export function LeaderboardSidebar({ compact = false }: { compact?: boolean }) {
  const { users, loading, error, retry } = useLeaderboard();
  const { session } = useSession();
  return (
    <section
      className="mv-panel p-4 sm:p-5"
      aria-labelledby="sidebar-leaderboard-title"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2
          id="sidebar-leaderboard-title"
          className="text-base font-bold text-white"
        >
          Тэргүүлэгчид
        </h2>
        <Link
          href="/leaderboard"
          className="rounded-lg py-2 text-sm font-medium text-violet-300 hover:text-violet-200"
        >
          Бүгд →
        </Link>
      </div>
      {loading ? (
        <p role="status" className="py-6 text-sm text-slate-400">
          Чансааг ачаалж байна…
        </p>
      ) : error ? (
        <div role="alert" className="space-y-3">
          <p className="text-sm text-slate-300">Чансааг ачаалж чадсангүй.</p>
          <button type="button" onClick={retry} className="mv-button-secondary">
            Дахин оролдох
          </button>
        </div>
      ) : users.length === 0 ? (
        <p className="py-6 text-sm text-slate-400">
          Одоогоор чансаанд сурагч алга.
        </p>
      ) : (
        <ol className="space-y-1">
          {users.slice(0, compact ? 5 : 10).map((user, index) => (
            <li key={user.email}>
              <Link
                href={`/profile?user=${encodeURIComponent(user.email)}`}
                className={`flex min-h-16 items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-white/5 ${session?.email === user.email ? "bg-violet-500/10" : ""}`}
              >
                <Rank position={index + 1} />
                <Avatar user={user} size="h-9 w-9" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-100">
                    {displayName(user)}
                    {session?.email === user.email ? " · Та" : ""}
                  </span>
                  <span className="text-xs text-slate-400">
                    {user.grade === "graduated"
                      ? "Төгсөгч"
                      : user.grade
                        ? `${user.grade}-р анги`
                        : "Сурагч"}
                  </span>
                </span>
                <span className="shrink-0 text-right text-sm font-semibold tabular-nums text-violet-200">
                  {xpLabel(user.experience)}
                  <span className="block text-[11px] font-normal text-slate-400">
                    XP
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function LeaderboardFull() {
  const { users, loading, error, retry } = useLeaderboard();
  const { session } = useSession();
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get("search") || "");
  const [grade, setGrade] = useState("all");
  const [rank, setRank] = useState("all");
  const [view, setView] = useState<"table" | "map">("table");
  useEffect(() => {
    setSearch(params.get("search") || "");
  }, [params]);
  const positions = useMemo(
    () => new Map(users.map((user, index) => [user.email, index + 1])),
    [users],
  );
  const visible = useMemo(
    () =>
      users.filter((user) => {
        const query = search.trim().toLocaleLowerCase();
        return (
          (!query ||
            `${user.nickname || ""} ${user.name || ""} ${user.email}`
              .toLocaleLowerCase()
              .includes(query)) &&
          (grade === "all" || user.grade === grade) &&
          (rank === "all" || rankOf(user.experience) === rank)
        );
      }),
    [users, search, grade, rank],
  );
  const currentUser = users.find((user) => user.email === session?.email);
  const hasFilters = !!search || grade !== "all" || rank !== "all";
  const clearFilters = () => {
    setSearch("");
    setGrade("all");
    setRank("all");
  };

  return (
    <div className="mv-page">
      <header className="mv-page-header">
        <div>
          <p className="mv-eyebrow">MINDVERSE · АХИЦ</p>
          <h1 className="mv-title">Сурагчдын чансаа</h1>
          <p className="mv-subtitle">
            Бүтээл бүрээр ур чадвараа ахиулж, дараагийн түвшинд хүрээрэй.
          </p>
        </div>
        {currentUser && (
          <Link
            href={`/profile?user=${encodeURIComponent(currentUser.email)}`}
            className="mv-panel flex shrink-0 items-center gap-4 !px-5 !py-4 transition-colors hover:border-violet-400/40"
          >
            <Avatar user={currentUser} />
            <span>
              <span className="block text-sm text-slate-400">Таны байр</span>
              <span className="mt-1 block text-xl font-bold tabular-nums text-white">
                #{positions.get(currentUser.email)}{" "}
                <span className="text-sm font-medium text-violet-300">
                  · {xpLabel(currentUser.experience)} XP
                </span>
              </span>
            </span>
          </Link>
        )}
      </header>

      <section
        className="mv-panel space-y-4 p-4 sm:p-5"
        aria-label="Чансаа шүүх"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_140px_210px] xl:grid-cols-[minmax(0,1fr)_160px_230px]">
          <div className="sm:col-span-2 lg:col-span-1">
            <label htmlFor="leaderboard-search" className="mv-label">
              Сурагч хайх
            </label>
            <input
              id="leaderboard-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="mv-field"
              placeholder="Нэр, хоч эсвэл имэйл"
              autoComplete="off"
            />
          </div>
          <div>
            <label htmlFor="leaderboard-grade" className="mv-label">
              Анги
            </label>
            <select
              id="leaderboard-grade"
              value={grade}
              onChange={(event) => setGrade(event.target.value)}
              className="mv-field"
            >
              <option value="all">Бүх анги</option>
              {["9", "10", "11", "12"].map((value) => (
                <option key={value} value={value}>
                  {value}-р анги
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="leaderboard-rank" className="mv-label">
              XP түвшин
            </label>
            <select
              id="leaderboard-rank"
              value={rank}
              onChange={(event) => setRank(event.target.value)}
              className="mv-field"
            >
              {RANKS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
          <div
            role="group"
            aria-label="Чансааны харагдац"
            className="flex flex-wrap gap-2"
          >
            <button
              type="button"
              aria-pressed={view === "table"}
              onClick={() => setView("table")}
              className={
                view === "table" ? "mv-button-primary" : "mv-button-secondary"
              }
            >
              Чансаа
            </button>
            <button
              type="button"
              aria-pressed={view === "map"}
              onClick={() => setView("map")}
              className={
                view === "map" ? "mv-button-primary" : "mv-button-secondary"
              }
            >
              Аяллын газрын зураг
            </button>
          </div>
          <div className="flex items-center gap-3">
            <p role="status" className="text-sm text-slate-400">
              {loading
                ? "Ачаалж байна…"
                : `${visible.length} / ${users.length} сурагч`}
            </p>
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="min-h-11 rounded-lg px-2 text-sm font-medium text-violet-300 hover:text-violet-200"
              >
                Цэвэрлэх
              </button>
            )}
          </div>
        </div>
      </section>

      {loading ? (
        <section
          className="mv-panel p-5"
          aria-busy="true"
          aria-label="Чансааг ачаалж байна"
        >
          <p role="status" className="mb-4 text-sm text-slate-300">
            Сурагчдын ахицыг ачаалж байна…
          </p>
          <div className="space-y-3" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((value) => (
              <div
                key={value}
                className="h-16 rounded-xl bg-slate-800/70 motion-safe:animate-pulse"
              />
            ))}
          </div>
        </section>
      ) : error ? (
        <section className="mv-panel p-6" role="alert">
          <h2 className="text-lg font-bold text-white">
            Чансааг ачаалж чадсангүй
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Холболтоо шалгаад дахин оролдоно уу.
          </p>
          <button
            type="button"
            onClick={retry}
            className="mv-button-primary mt-4"
          >
            Дахин оролдох
          </button>
        </section>
      ) : visible.length === 0 ? (
        <section className="mv-panel px-6 py-12 text-center">
          <span aria-hidden="true" className="text-3xl">
            {users.length ? "🔎" : "🏆"}
          </span>
          <h2 className="mt-4 text-lg font-bold text-white">
            {users.length
              ? "Тохирох сурагч олдсонгүй"
              : "Чансаа хараахан бүрдээгүй байна"}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
            {users.length
              ? "Нэр, анги эсвэл XP түвшнээ өөрчлөөд дахин хайгаарай."
              : "Сурагчдын XP болон ахиц энд харагдана."}
          </p>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="mv-button-secondary mt-5"
            >
              Шүүлтүүр цэвэрлэх
            </button>
          )}
        </section>
      ) : view === "map" ? (
        <RealmMap users={visible} />
      ) : (
        <section
          className="mv-panel overflow-hidden !p-0"
          aria-label="XP чансааны жагсаалт"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-4 sm:px-5">
            <h2 className="text-base font-bold text-white">XP чансаа</h2>
            <p className="text-sm leading-6 text-slate-400">
              Байрлал нь нийт чансааных. Шүүлтүүрээр өөрчлөгдөхгүй.
            </p>
          </div>
          <table className="w-full table-fixed text-left">
            <caption className="sr-only">
              Сурагчдын нийт чансааны байр, нэр, анги, түвшин болон XP
            </caption>
            <thead className="border-b border-white/10 bg-slate-950/35 text-xs font-semibold text-slate-400 sm:text-sm">
              <tr>
                <th scope="col" className="w-14 px-2 py-3 text-center sm:w-20">
                  Байр
                </th>
                <th scope="col" className="py-3 pr-2">
                  Сурагч
                </th>
                <th scope="col" className="hidden w-28 px-3 py-3 xl:table-cell">
                  Анги
                </th>
                <th
                  scope="col"
                  className="hidden w-[28%] px-3 py-3 lg:table-cell"
                >
                  Түвшин · Цол
                </th>
                <th
                  scope="col"
                  className="w-24 py-3 pl-2 pr-4 text-right sm:w-32 sm:pr-5"
                >
                  XP
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {visible.map((user) => {
                const position = positions.get(user.email) || 0;
                const isMe = session?.email === user.email;
                return (
                  <tr
                    key={user.email}
                    className={`transition-colors hover:bg-white/[0.035] ${isMe ? "bg-violet-500/10" : ""}`}
                  >
                    <td className="px-2 py-4 text-center">
                      <Rank position={position} />
                    </td>
                    <th scope="row" className="min-w-0 py-4 pr-2 font-normal">
                      <Link
                        href={`/profile?user=${encodeURIComponent(user.email)}`}
                        className="flex min-h-12 min-w-0 items-center gap-2 rounded-xl sm:gap-3"
                      >
                        <Avatar user={user} size="h-9 w-9 sm:h-11 sm:w-11" />
                        <span className="min-w-0">
                          <span className="block break-words text-sm font-semibold text-slate-100 sm:text-base">
                            {displayName(user)}
                            {isMe && (
                              <span className="ml-1.5 text-xs font-medium text-violet-300">
                                Та
                              </span>
                            )}
                          </span>
                          <span className="mt-1 block text-xs text-slate-400 sm:text-sm xl:hidden">
                            {user.grade === "graduated"
                              ? "Төгсөгч"
                              : user.grade
                                ? `${user.grade}-р анги`
                                : "Сурагч"}
                          </span>
                          <span className="mt-0.5 block break-words text-xs leading-5 text-violet-300 lg:hidden">
                            {getPersonalizedTitleShort(user)}
                          </span>
                        </span>
                      </Link>
                    </th>
                    <td className="hidden px-3 py-4 text-sm text-slate-300 xl:table-cell">
                      {user.grade === "graduated"
                        ? "Төгсөгч"
                        : user.grade
                          ? `${user.grade}-р анги`
                          : "—"}
                    </td>
                    <td className="hidden px-3 py-4 lg:table-cell">
                      <span className="block text-sm font-semibold text-slate-200">
                        {RANK_LABELS[rankOf(user.experience)]}
                      </span>
                      <span className="mt-1 block break-words text-sm leading-6 text-violet-300">
                        {getPersonalizedTitleShort(user)}
                      </span>
                    </td>
                    <td
                      className={`py-4 pl-2 pr-4 text-right text-sm font-bold tabular-nums sm:pr-5 sm:text-base ${position <= 3 ? "text-amber-200" : "text-slate-100"}`}
                    >
                      {xpLabel(user.experience)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
