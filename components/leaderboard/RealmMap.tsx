"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "../auth/useSession";
import Modal from "../ui/Modal";
import {
  generatePersonalizedTitle,
  getPersonalizedTitleShort,
} from "../../lib/rpgTitleGenerator";

export type LeaderboardUser = {
  email: string;
  name?: string;
  nickname?: string;
  avatarUrl?: string;
  avatarColor?: string;
  role: "student" | "teacher";
  grade?: string;
  experience: number;
};

export type RealmInfo = {
  id: string;
  nameMn: string;
  nameEn: string;
  icon: string;
  x: number; // percentage from left
  y: number; // percentage from top
  minXp: number;
  maxXp: number;
  titles: string[];
  skills: string[];
  description: string;
  themeColor: string;
  accentBorder: string;
  badgeBg: string;
};

export const REALMS: RealmInfo[] = [
  {
    id: "draft_desert",
    nameMn: "Нооргийн Цөл ба Шугамын Арлууд",
    nameEn: "The Draft Desert",
    icon: "🏜️",
    x: 18,
    y: 62,
    minXp: 0,
    maxXp: 199,
    titles: ["Pixel Wanderer", "Sketch Nomad"],
    skills: ["Дизайны суурь", "Скетч зураг", "Typography"],
    description:
      "Бүх шинэхэн сурагчдын аялал эндээс эхэлнэ. Энэ бол цагаан цаастай нүүр тулж, хамгийн их алдаа гаргаж, ноорог зурдаг хатуу ширүүн боловч суурь тавигддаг нутаг юм.",
    themeColor: "from-amber-500 via-orange-500 to-yellow-600",
    accentBorder: "border-amber-500/70",
    badgeBg: "bg-amber-500/20 text-amber-300",
  },
  {
    id: "forest_users",
    nameMn: "Хэрэглэгчийн Ой ба Өнгөний Боомт",
    nameEn: "Forest of Users",
    icon: "🌲",
    x: 20,
    y: 24,
    minXp: 200,
    maxXp: 449,
    titles: ["Layout Ranger", "Color Alchemist"],
    skills: ["UI/UX дизайн", "Өнгөний зохицол", "Wireframing"],
    description:
      "Хэрэглэгчийн сэтгэл зүйг ойлгож, зөв бүтэц гаргах нууцлаг ойн жимээр аялна. Даалгавраа сайн хийсэн сурагчид Өнгөний Боомтоор дамжин дараагийн том хотууд руу аялна.",
    themeColor: "from-emerald-500 via-teal-500 to-green-600",
    accentBorder: "border-emerald-500/70",
    badgeBg: "bg-emerald-500/20 text-emerald-300",
  },
  {
    id: "render_hell",
    nameMn: "Рендерийн Там буюу Галт Уулын бүс",
    nameEn: "Render Hell",
    icon: "🌋",
    x: 82,
    y: 65,
    minXp: 450,
    maxXp: 749,
    titles: ["Keyframe Knight", "Motion Ninja"],
    skills: ["Motion Graphics", "VFX (After Effects)", "2D Animation"],
    description:
      "Хамгийн их тэвчээр шаардах газар. Компьютерын хүчин чадал шалгасан хүнд эффектүүд, гацсан төслүүдтэй тулалдах хатуу ширүүн боловч маш хүчирхэг, сонирхолтой бүс.",
    themeColor: "from-red-600 via-rose-600 to-orange-600",
    accentBorder: "border-rose-500/70",
    badgeBg: "bg-rose-500/20 text-rose-300",
  },
  {
    id: "peak_polygons",
    nameMn: "Полигоны Оргил буюу Мөсөн уулын бүс",
    nameEn: "Peak of Polygons",
    icon: "🏔️",
    x: 50,
    y: 15,
    minXp: 750,
    maxXp: 999,
    titles: ["3D Warlord", "Polygon Sensei"],
    skills: ["3D Modeling", "3D Camera Tracking", "Compositing"],
    description:
      "Маш нарийн чимхлүүр, орон зайн баримжаа шаардсан 3D ертөнц. Зөвхөн цөөн тооны тууштай сурагчид л энэхүү мөсөн оргилд хүрч, хүнд объектуудыг амжилттай байршуулна.",
    themeColor: "from-sky-400 via-indigo-500 to-cyan-500",
    accentBorder: "border-sky-400/70",
    badgeBg: "bg-sky-500/20 text-sky-300",
  },
  {
    id: "ai_cloud",
    nameMn: "AI Үүлэн Хот",
    nameEn: "The AI Cloud City",
    icon: "☁️",
    x: 84,
    y: 22,
    minXp: 1000,
    maxXp: 1499,
    titles: ["Prompt Wizard", "AI Architect"],
    skills: ["Advanced AI Prompting", "Concept Art", "Generative Design"],
    description:
      "Хиймэл оюун ухааны хүчийг ашиглан нүд ирмэхийн зуур гайхамшгийг бүтээдэг, уламжлалт дүрмээс гадуур орших хөвөгч хот.",
    themeColor: "from-cyan-400 via-blue-500 to-purple-600",
    accentBorder: "border-cyan-400/70",
    badgeBg: "bg-cyan-500/20 text-cyan-300",
  },
  {
    id: "central_hub",
    nameMn: "Mindverse Креатив Төв",
    nameEn: "The Central Hub",
    icon: "👑",
    x: 50,
    y: 50,
    minXp: 1500,
    maxXp: Number.POSITIVE_INFINITY,
    titles: ["Mindverse Champion", "Art Director"],
    skills: ["Бүх ур чадварын нэгдэл", "Портфолио", "Агентлагийн төслүүд"],
    description:
      "Сурагчдын эцсийн зогсоол буюу хамгийн шилдэг бүтээлүүдээ танилцуулдаг, сар бүрийн том уралдаан (Weekly Brief Arena) зохиогддог төв континент.",
    themeColor: "from-amber-400 via-purple-500 to-pink-500",
    accentBorder: "border-purple-500/70",
    badgeBg: "bg-purple-500/20 text-purple-200",
  },
];

/** Classify user into primary Realm by XP */
export function getUserRealm(xp: number): RealmInfo {
  if (xp >= 1500)
    return REALMS.find((r) => r.id === "central_hub") || REALMS[5];
  if (xp >= 1000) return REALMS.find((r) => r.id === "ai_cloud") || REALMS[5];
  if (xp >= 750)
    return REALMS.find((r) => r.id === "peak_polygons") || REALMS[3];
  if (xp >= 450) return REALMS.find((r) => r.id === "render_hell") || REALMS[2];
  if (xp >= 200)
    return REALMS.find((r) => r.id === "forest_users") || REALMS[1];
  return REALMS.find((r) => r.id === "draft_desert") || REALMS[0];
}

/** Compute User RPG Title by XP — legacy fallback, use getPersonalizedTitleShort instead */
export function getUserRpgTitle(xp: number): string {
  if (xp >= 1500) return "👑 Legend Warlord";
  if (xp >= 1000) return "🧙‍♂️ Prompt Wizard";
  if (xp >= 750) return "⚔️ Polygon Sensei";
  if (xp >= 450) return "🔥 Keyframe Knight";
  if (xp >= 200) return "🏹 Layout Ranger";
  return "🎨 Pixel Wanderer";
}

const realmRange = (realm: RealmInfo) =>
  Number.isFinite(realm.maxXp)
    ? `${realm.minXp.toLocaleString("en-US")}–${realm.maxXp.toLocaleString("en-US")} XP`
    : `${realm.minXp.toLocaleString("en-US")}+ XP`;
const userName = (user: LeaderboardUser) =>
  user.nickname || user.name || user.email.split("@")[0];

function HeroAvatar({
  user,
  large = false,
}: {
  user: LeaderboardUser;
  large?: boolean;
}) {
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-700 font-semibold text-slate-100 ${large ? "h-20 w-20 text-2xl" : "h-10 w-10 text-sm"}`}
    >
      <span aria-hidden="true">{userName(user)[0]?.toUpperCase()}</span>
      {user.avatarUrl && (
        <img
          src={user.avatarUrl}
          alt=""
          loading="lazy"
          decoding="async"
          width={80}
          height={80}
          className="absolute inset-0 h-full w-full object-cover"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      )}
    </span>
  );
}

export function RealmMap({ users }: { users: LeaderboardUser[] }) {
  const { session } = useSession();
  const [selectedRealm, setSelectedRealm] = useState<RealmInfo | null>(null);
  const [selectedUser, setSelectedUser] = useState<LeaderboardUser | null>(
    null,
  );
  const usersByRealm = useMemo(() => {
    const grouped: Record<string, LeaderboardUser[]> = Object.fromEntries(
      REALMS.map((realm) => [realm.id, []]),
    );
    for (const user of users)
      grouped[getUserRealm(user.experience || 0).id].push(user);
    return grouped;
  }, [users]);
  const currentUser = users.find((user) => user.email === session?.email);
  const currentRealm = currentUser
    ? getUserRealm(currentUser.experience)
    : null;
  const heroTitle = selectedUser
    ? generatePersonalizedTitle(selectedUser)
    : null;

  return (
    <section className="space-y-5" aria-labelledby="realm-title">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2
            id="realm-title"
            className="text-xl font-bold text-white sm:text-2xl"
          >
            Дизайны хаант улс
          </h2>
          <p
            id="realm-map-description"
            className="mt-2 max-w-2xl text-sm leading-6 text-slate-400"
          >
            XP ахих тусам шинэ бүс нээгдэнэ. Газрын зураг эсвэл бүсийн
            жагсаалтаас сонгож, сурагчид болон эзэмших ур чадварыг хараарай.
          </p>
        </div>
        {currentRealm && (
          <button
            type="button"
            onClick={() => setSelectedRealm(currentRealm)}
            className="mv-button-secondary shrink-0"
          >
            <span aria-hidden="true">{currentRealm.icon}</span> Таны бүсийг
            харах
          </button>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px] 2xl:grid-cols-[minmax(0,1fr)_320px] 2xl:gap-5">
        <div
          className="mv-panel relative isolate aspect-[4/3] overflow-hidden !p-0 sm:aspect-[16/10] xl:aspect-auto xl:min-h-[480px]"
          aria-describedby="realm-map-description"
        >
          <img
            src="/mindverse-map.jpg"
            alt=""
            width={1600}
            height={1000}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/10 to-slate-950/35"
            aria-hidden="true"
          />
          {REALMS.map((realm) => {
            const count = usersByRealm[realm.id].length;
            const isMe = currentRealm?.id === realm.id;
            return (
              <button
                key={realm.id}
                type="button"
                onClick={() => setSelectedRealm(realm)}
                aria-label={`${realm.nameMn}, ${realmRange(realm)}, ${count} сурагч${isMe ? ", таны бүс" : ""}`}
                aria-haspopup="dialog"
                className={`absolute z-10 flex min-h-12 min-w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-2 rounded-2xl border-2 bg-slate-950/90 px-2 py-2 text-white shadow-lg transition-colors hover:border-white focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white sm:px-3 ${isMe ? "border-amber-300" : realm.accentBorder}`}
                style={{ left: `${realm.x}%`, top: `${realm.y}%` }}
              >
                <span aria-hidden="true" className="text-2xl sm:text-3xl">
                  {realm.icon}
                </span>
                <span className="hidden max-w-[150px] text-left 2xl:block">
                  <span className="block text-sm font-semibold leading-5">
                    {realm.nameMn}
                  </span>
                  <span className="mt-1 block text-xs text-slate-300">
                    {count} сурагч
                  </span>
                </span>
                {isMe && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-300 px-2 py-0.5 text-xs font-bold text-slate-950"
                  >
                    Та
                  </span>
                )}
              </button>
            );
          })}
          <p className="absolute bottom-3 left-3 right-3 text-center text-xs text-slate-200 sm:bottom-4 sm:text-sm">
            6 бүс · Бүтээл бүр аяллын нэг алхам
          </p>
        </div>

        <div
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 xl:gap-2"
          aria-label="Бүсүүдийн жагсаалт"
        >
          {REALMS.map((realm) => (
            <button
              key={realm.id}
              type="button"
              aria-haspopup="dialog"
              onClick={() => setSelectedRealm(realm)}
              className={`mv-panel flex h-full items-start gap-3 !p-4 text-left transition-colors hover:border-violet-400/40 hover:bg-white/5 xl:!p-3.5 ${currentRealm?.id === realm.id ? "!border-amber-400/60" : ""}`}
            >
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-2xl"
              >
                {realm.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold leading-6 text-white">
                  {realm.nameMn}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs leading-5">
                  <span className="text-violet-300">{realmRange(realm)}</span>
                  <span className="text-slate-400">
                    {usersByRealm[realm.id].length} сурагч
                  </span>
                </span>
                {currentRealm?.id === realm.id && (
                  <span className="mt-1 block text-xs font-medium text-amber-200">
                    Таны бүс
                  </span>
                )}
              </span>
              <span aria-hidden="true" className="pt-1 text-slate-500">
                ↗
              </span>
            </button>
          ))}
        </div>
      </div>

      <Modal
        open={!!selectedRealm}
        onClose={() => setSelectedRealm(null)}
        title={
          selectedRealm
            ? `${selectedRealm.icon} ${selectedRealm.nameMn}`
            : "Бүсийн мэдээлэл"
        }
        wide
      >
        {selectedRealm && (
          <div className="space-y-6">
            <div>
              <span className="inline-flex rounded-full bg-violet-500/15 px-3 py-1 text-sm font-semibold text-violet-200">
                {realmRange(selectedRealm)}
              </span>
              <p className="mt-4 text-sm leading-7 text-slate-300 sm:text-base sm:leading-8">
                {selectedRealm.description}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <section className="rounded-2xl border border-white/10 p-4">
                <h3 className="mb-3 text-sm font-semibold text-white">
                  Эзэмших ур чадвар
                </h3>
                <ul className="space-y-2 text-sm leading-5 text-slate-300">
                  {selectedRealm.skills.map((skill) => (
                    <li key={skill}>• {skill}</li>
                  ))}
                </ul>
              </section>
              <section className="rounded-2xl border border-white/10 p-4">
                <h3 className="mb-3 text-sm font-semibold text-white">
                  Авах цол
                </h3>
                <ul className="space-y-2 text-sm leading-5 text-amber-200">
                  {selectedRealm.titles.map((title) => (
                    <li key={title}>{title}</li>
                  ))}
                </ul>
              </section>
            </div>
            <section>
              <h3 className="mb-3 text-base font-semibold text-white">
                Энэ бүсийн сурагчид{" "}
                <span className="text-sm font-normal text-slate-400">
                  · {usersByRealm[selectedRealm.id].length}
                </span>
              </h3>
              {usersByRealm[selectedRealm.id].length === 0 ? (
                <p className="rounded-2xl border border-dashed border-white/15 px-4 py-8 text-center text-sm leading-6 text-slate-400">
                  Одоогийн шүүлтүүрээр энэ бүсэд сурагч алга. XP цуглуулж, энэ
                  бүсийн анхны аялагч болоорой.
                </p>
              ) : (
                <ul className="space-y-2">
                  {usersByRealm[selectedRealm.id].map((user) => (
                    <li key={user.email}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRealm(null);
                          setSelectedUser(user);
                        }}
                        className="flex w-full items-center gap-3 rounded-xl border border-white/10 px-3 py-3 text-left hover:bg-white/5"
                      >
                        <HeroAvatar user={user} />
                        <span className="min-w-0 flex-1">
                          <span className="block break-words text-sm font-semibold text-white">
                            {userName(user)}
                            {session?.email === user.email ? " · Та" : ""}
                          </span>
                          <span className="mt-1 block text-sm leading-6 text-violet-300">
                            {getPersonalizedTitleShort(user)}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-amber-200">
                          {Math.round(user.experience).toLocaleString("en-US")}{" "}
                          XP
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </Modal>
      <Modal
        open={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        title="Аялагчийн мэдээлэл"
        footer={
          selectedUser && (
            <Link
              href={`/profile?user=${encodeURIComponent(selectedUser.email)}`}
              className="mv-button-primary w-full justify-center"
            >
              Профайл харах →
            </Link>
          )
        }
      >
        {selectedUser && (
          <div className="space-y-5 text-center">
            <HeroAvatar user={selectedUser} large />
            <div>
              <h3 className="break-words text-xl font-bold text-white">
                {userName(selectedUser)}
              </h3>
              <p className="mt-2 text-base font-semibold text-amber-200">
                {heroTitle?.emoji} {heroTitle?.title}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {heroTitle?.subtitle}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-4 rounded-2xl border border-white/10 p-4">
              <div>
                <dt className="text-sm text-slate-400">Цуглуулсан XP</dt>
                <dd className="mt-1 text-xl font-bold text-white">
                  {Math.round(selectedUser.experience).toLocaleString("en-US")}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-slate-400">Одоогийн бүс</dt>
                <dd className="mt-1 text-sm font-semibold leading-5 text-violet-200">
                  {getUserRealm(selectedUser.experience).nameMn}
                </dd>
              </div>
            </dl>
          </div>
        )}
      </Modal>
    </section>
  );
}
