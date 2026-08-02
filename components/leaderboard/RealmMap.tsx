"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "../auth/useSession";
import { generatePersonalizedTitle, getPersonalizedTitleShort } from "../../lib/rpgTitleGenerator";

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
    maxXp: 200,
    titles: ["Pixel Wanderer", "Sketch Nomad"],
    skills: ["Дизайны суурь", "Скетч зураг", "Typography"],
    description: "Бүх шинэхэн сурагчдын аялал эндээс эхэлнэ. Энэ бол цагаан цаастай нүүр тулж, хамгийн их алдаа гаргаж, ноорог зурдаг хатуу ширүүн боловч суурь тавигддаг нутаг юм.",
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
    maxXp: 450,
    titles: ["Layout Ranger", "Color Alchemist"],
    skills: ["UI/UX дизайн", "Өнгөний зохицол", "Wireframing"],
    description: "Хэрэглэгчийн сэтгэл зүйг ойлгож, зөв бүтэц гаргах нууцлаг ойн жимээр аялна. Даалгавраа сайн хийсэн сурагчид Өнгөний Боомтоор дамжин дараагийн том хотууд руу аялна.",
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
    maxXp: 750,
    titles: ["Keyframe Knight", "Motion Ninja"],
    skills: ["Motion Graphics", "VFX (After Effects)", "2D Animation"],
    description: "Хамгийн их тэвчээр шаардах газар. Компьютерын хүчин чадал шалгасан хүнд эффектүүд, гацсан төслүүдтэй тулалдах хатуу ширүүн боловч маш хүчирхэг, сонирхолтой бүс.",
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
    maxXp: 1000,
    titles: ["3D Warlord", "Polygon Sensei"],
    skills: ["3D Modeling", "3D Camera Tracking", "Compositing"],
    description: "Маш нарийн чимхлүүр, орон зайн баримжаа шаардсан 3D ертөнц. Зөвхөн цөөн тооны тууштай сурагчид л энэхүү мөсөн оргилд хүрч, хүнд объектуудыг амжилттай байршуулна.",
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
    maxXp: 1500,
    titles: ["Prompt Wizard", "AI Architect"],
    skills: ["Advanced AI Prompting", "Concept Art", "Generative Design"],
    description: "Хиймэл оюун ухааны хүчийг ашиглан нүд ирмэхийн зуур гайхамшгийг бүтээдэг, уламжлалт дүрмээс гадуур орших хөвөгч хот.",
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
    minXp: 500,
    maxXp: 999999,
    titles: ["Mindverse Champion", "Art Director"],
    skills: ["Бүх ур чадварын нэгдэл", "Портфолио", "Агентлагийн төслүүд"],
    description: "Сурагчдын эцсийн зогсоол буюу хамгийн шилдэг бүтээлүүдээ танилцуулдаг, сар бүрийн том уралдаан (Weekly Brief Arena) зохиогддог төв континент.",
    themeColor: "from-amber-400 via-purple-500 to-pink-500",
    accentBorder: "border-purple-500/70",
    badgeBg: "bg-purple-500/20 text-purple-200",
  },
];

/** Classify user into primary Realm by XP */
export function getUserRealm(xp: number): RealmInfo {
  if (xp >= 1000) return REALMS.find((r) => r.id === "ai_cloud") || REALMS[5];
  if (xp >= 750) return REALMS.find((r) => r.id === "peak_polygons") || REALMS[3];
  if (xp >= 450) return REALMS.find((r) => r.id === "render_hell") || REALMS[2];
  if (xp >= 200) return REALMS.find((r) => r.id === "forest_users") || REALMS[1];
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

export function RealmMap({ users }: { users: LeaderboardUser[] }) {
  const { session } = useSession();
  const router = useRouter();
  const [selectedRealm, setSelectedRealm] = useState<RealmInfo | null>(null);
  const [selectedUser, setSelectedUser] = useState<LeaderboardUser | null>(null);
  const [activeTabFilter, setActiveTabFilter] = useState<string>("all");

  // Map users to realms
  const usersByRealm = useMemo(() => {
    const map: Record<string, LeaderboardUser[]> = {};
    REALMS.forEach((r) => (map[r.id] = []));
    users.forEach((u) => {
      const realm = getUserRealm(u.experience || 0);
      map[realm.id].push(u);
    });
    return map;
  }, [users]);

  // Current logged in user object & realm
  const currentUser = useMemo(() => {
    if (!session?.email) return null;
    return users.find((u) => u.email === session.email) || null;
  }, [session?.email, users]);

  const currentUserRealm = currentUser ? getUserRealm(currentUser.experience) : null;

  return (
    <div className="space-y-6">
      {/* Map Header Card */}
      <div className="relative overflow-hidden rounded-3xl border border-purple-500/30 glass-panel p-6 shadow-[0_20px_60px_rgba(139,92,246,0.25)]">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-gradient-to-r from-amber-500 to-purple-600 text-white uppercase tracking-wider shadow-lg">
                ⚔️ RPG World Map
              </span>
              <span className="text-xs text-purple-300 font-semibold">Mindverse Realm</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight bg-gradient-to-r from-amber-200 via-violet-200 to-pink-200 bg-clip-text text-transparent">
              Дизайны Хаант Улс
            </h2>
            <p className="text-xs md:text-sm text-slate-300 max-w-2xl mt-1 leading-relaxed">
              Баатруудын аялал, XP түвшин болон эзэлсэн газар нутаг. Газрын зургийн бүс дээр дарж тухайн нутгийн сурагчид ба цолыг харна уу.
            </p>
          </div>

          {currentUser && currentUserRealm && (
            <div className="glass-card rounded-2xl p-4 border border-amber-400/40 bg-gradient-to-br from-amber-500/10 via-purple-500/10 to-dark-900 flex items-center gap-3 shrink-0 shadow-[0_0_25px_rgba(251,191,36,0.2)]">
              <div className="relative w-12 h-12 rounded-full border-2 border-amber-400 flex items-center justify-center bg-dark-800 overflow-hidden shadow-lg">
                {currentUser.avatarUrl ? (
                  <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg font-bold text-amber-300">
                    {(currentUser.nickname || currentUser.name || currentUser.email)[0]?.toUpperCase()}
                  </span>
                )}
                <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-dark-900 animate-pulse" />
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">🌟 Байршил: {currentUserRealm.icon}</div>
                <div className="text-sm font-bold text-white truncate max-w-[160px]">
                  {currentUser.nickname || currentUser.name || currentUser.email.split("@")[0]}
                </div>
                <div className="text-xs font-semibold text-purple-300">
                  {getPersonalizedTitleShort(currentUser)} ({Math.round(currentUser.experience)} XP)
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 italic">
                  {generatePersonalizedTitle(currentUser).subtitle}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Interactive Map View */}
      <div className="relative rounded-3xl border-2 border-purple-500/30 overflow-hidden bg-slate-950 shadow-[0_25px_80px_rgba(0,0,0,0.8)] aspect-[4/3] md:aspect-[16/10] group">
        {/* Background Map Image */}
        <img
          src="/mindverse-map.jpg"
          alt="Дизайны Хаант Улс Map"
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.01]"
        />

        {/* Dark Vignette Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-slate-950/40 pointer-events-none" />

        {/* Map Realm Pins & Regions */}
        {REALMS.map((realm) => {
          const realmUsers = usersByRealm[realm.id] || [];
          const isSelected = selectedRealm?.id === realm.id;
          const isUserHere = currentUserRealm?.id === realm.id;

          return (
            <div
              key={realm.id}
              style={{ left: `${realm.x}%`, top: `${realm.y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-20 cursor-pointer group/pin"
              onClick={() => setSelectedRealm(realm)}
            >
              {/* Outer Pulsing Aura Ring */}
              <div className={`absolute -inset-4 rounded-full bg-gradient-to-r ${realm.themeColor} opacity-30 blur-md animate-ping pointer-events-none ${isSelected ? 'opacity-70 scale-125' : ''}`} />

              {/* Pin Container Card */}
              <div
                className={`relative flex items-center gap-2 px-3.5 py-2 rounded-2xl glass-panel border-2 backdrop-blur-md shadow-2xl transition-all duration-300 group-hover/pin:scale-110 ${
                  isSelected
                    ? "border-amber-400 bg-dark-900/90 shadow-[0_0_35px_rgba(251,191,36,0.6)] scale-110"
                    : isUserHere
                    ? "border-emerald-400 bg-dark-900/90 shadow-[0_0_30px_rgba(52,211,153,0.5)]"
                    : `${realm.accentBorder} bg-dark-950/85 hover:border-purple-400`
                }`}
              >
                <span className="text-xl md:text-2xl filter drop-shadow-md">{realm.icon}</span>
                <div className="hidden sm:block text-left pr-1">
                  <div className="text-[11px] font-black text-white leading-tight drop-shadow-sm whitespace-nowrap">
                    {realm.nameMn}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`px-1.5 py-0.2 text-[9px] font-bold rounded-full ${realm.badgeBg}`}>
                      {realm.minXp} - {realm.maxXp === 999999 ? "∞" : realm.maxXp} XP
                    </span>
                    <span className="text-[10px] text-slate-300 font-semibold">
                      👥 {realmUsers.length}
                    </span>
                  </div>
                </div>

                {/* Counter Badge for Mobile */}
                <span className="sm:hidden text-[10px] font-bold text-white bg-purple-600/80 px-1.5 py-0.5 rounded-full">
                  {realmUsers.length}
                </span>

                {/* Floating Student Avatars in this Realm */}
                {realmUsers.length > 0 && (
                  <div className="flex -space-x-2 overflow-hidden ml-1">
                    {realmUsers.slice(0, 3).map((u) => (
                      <div
                        key={u.email}
                        title={`${u.nickname || u.name || u.email} (${Math.round(u.experience)} XP)`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedUser(u);
                        }}
                        className={`w-6 h-6 rounded-full border-2 border-dark-900 flex items-center justify-center text-[9px] font-bold text-white overflow-hidden shadow-md cursor-pointer hover:scale-125 transition-transform ${
                          u.email === session?.email ? "ring-2 ring-amber-400" : ""
                        }`}
                        style={{ backgroundColor: u.avatarColor || "#6366f1" }}
                      >
                        {u.avatarUrl ? (
                          <img src={u.avatarUrl} alt={u.name} className="w-full h-full object-cover" />
                        ) : (
                          (u.nickname || u.name || u.email)[0]?.toUpperCase()
                        )}
                      </div>
                    ))}
                    {realmUsers.length > 3 && (
                      <div className="w-6 h-6 rounded-full border-2 border-dark-900 bg-slate-800 text-[8px] font-bold text-slate-300 flex items-center justify-center">
                        +{realmUsers.length - 3}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* User Marker indicator if user is in this realm */}
              {isUserHere && (
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 font-black text-[9px] px-2 py-0.5 rounded-full shadow-lg border border-white animate-bounce whitespace-nowrap">
                  🌟 ТА ЭНД БАЙНА
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Realm Detail Modal Drawer */}
      {selectedRealm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-2xl bg-dark-900 border-2 border-purple-500/40 rounded-3xl p-6 md:p-8 shadow-[0_25px_90px_rgba(139,92,246,0.3)] max-h-[90vh] overflow-y-auto">
            {/* Close Button */}
            <button
              onClick={() => setSelectedRealm(null)}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-dark-800 border border-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
            >
              ✕
            </button>

            {/* Realm Modal Header */}
            <div className="flex items-center gap-4 mb-6">
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${selectedRealm.themeColor} flex items-center justify-center text-3xl shadow-xl border border-white/20`}>
                {selectedRealm.icon}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${selectedRealm.badgeBg}`}>
                    {selectedRealm.minXp} - {selectedRealm.maxXp === 999999 ? "∞" : selectedRealm.maxXp} XP
                  </span>
                  <span className="text-xs text-slate-400">{selectedRealm.nameEn}</span>
                </div>
                <h3 className="text-2xl font-black text-white mt-1">{selectedRealm.nameMn}</h3>
              </div>
            </div>

            {/* Description & Details */}
            <p className="text-sm text-slate-300 leading-relaxed mb-6 bg-dark-800/60 p-4 rounded-2xl border border-white/5">
              {selectedRealm.description}
            </p>

            {/* Skills & Titles Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-dark-800/40 border border-white/5 p-4 rounded-2xl">
                <h4 className="text-xs font-bold uppercase text-purple-400 tracking-wider mb-2">🎯 Эзэмших Ур чадварууд</h4>
                <div className="flex flex-wrap gap-1.5">
                  {selectedRealm.skills.map((skill) => (
                    <span key={skill} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-500/10 text-purple-200 border border-purple-500/20">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              <div className="bg-dark-800/40 border border-white/5 p-4 rounded-2xl">
                <h4 className="text-xs font-bold uppercase text-amber-400 tracking-wider mb-2">🏆 Олгох Баатрын Цолууд</h4>
                <div className="flex flex-wrap gap-1.5">
                  {selectedRealm.titles.map((title) => (
                    <span key={title} className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                      ⚔️ {title}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Students currently in this Realm */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>👥 Энэ бүсэд аялж буй баатрууд</span>
                  <span className="px-2 py-0.5 rounded-full text-xs bg-purple-600/30 text-purple-300">
                    {(usersByRealm[selectedRealm.id] || []).length} сурагч
                  </span>
                </h4>
              </div>

              {(usersByRealm[selectedRealm.id] || []).length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500 border border-dashed border-white/10 rounded-2xl">
                  Одоогоор энэ бүсэд хүрсэн сурагч байхгүй байна. Анхны баатар болоорой! 🚀
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
                  {(usersByRealm[selectedRealm.id] || []).map((u) => {
                    const isMe = session?.email === u.email;
                    return (
                      <div
                        key={u.email}
                        onClick={() => router.push(`/profile?user=${encodeURIComponent(u.email)}`)}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer hover:border-purple-500/50 ${
                          isMe
                            ? "border-amber-400/80 bg-gradient-to-r from-amber-500/15 to-purple-500/15"
                            : "border-white/5 bg-dark-800/60 hover:bg-dark-800"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white overflow-hidden shadow-md shrink-0"
                            style={{ backgroundColor: u.avatarColor || "#6366f1" }}
                          >
                            {u.avatarUrl ? (
                              <img src={u.avatarUrl} alt={u.name} className="w-full h-full object-cover" />
                            ) : (
                              (u.nickname || u.name || u.email)[0]?.toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">
                              {u.nickname || u.name || u.email.split("@")[0]} {isMe && <span className="text-amber-400 text-[10px]">(Та)</span>}
                            </div>
                            <div className="text-[10px] text-amber-300 font-semibold">{getPersonalizedTitleShort(u)}</div>
                            <div className="text-[9px] text-slate-500 italic">{generatePersonalizedTitle(u).subtitle}</div>
                          </div>
                        </div>
                        <div className="text-xs font-extrabold text-amber-300 shrink-0">
                          {Math.round(u.experience)} XP
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Single Student Hero Badge Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-sm bg-dark-900 border-2 border-amber-400/50 rounded-3xl p-6 text-center shadow-[0_20px_70px_rgba(251,191,36,0.3)]">
            <button
              onClick={() => setSelectedUser(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              ✕
            </button>

            <div className="w-20 h-20 mx-auto rounded-full border-4 border-amber-400 flex items-center justify-center bg-dark-800 overflow-hidden shadow-2xl mb-4">
              {selectedUser.avatarUrl ? (
                <img src={selectedUser.avatarUrl} alt={selectedUser.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-amber-300">
                  {(selectedUser.nickname || selectedUser.name || selectedUser.email)[0]?.toUpperCase()}
                </span>
              )}
            </div>

            <h3 className="text-xl font-bold text-white">
              {selectedUser.nickname || selectedUser.name || selectedUser.email.split("@")[0]}
            </h3>
            {(() => {
              const t = generatePersonalizedTitle(selectedUser);
              return (
                <>
                  <p className="text-base font-extrabold text-amber-300 mt-1">{t.emoji} {t.title}</p>
                  <p className="text-[11px] text-slate-400 italic mt-0.5">{t.subtitle}</p>
                </>
              );
            })()}

            <div className="mt-4 p-3 rounded-2xl bg-dark-800 border border-white/5 flex items-center justify-around">
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-bold">XP Оноо</div>
                <div className="text-lg font-black text-white">{Math.round(selectedUser.experience)}</div>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-bold">Байрлал Нутаг</div>
                <div className="text-sm font-bold text-purple-300">
                  {getUserRealm(selectedUser.experience).icon} {getUserRealm(selectedUser.experience).nameEn}
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setSelectedUser(null);
                router.push(`/profile?user=${encodeURIComponent(selectedUser.email)}`);
              }}
              className="mt-5 w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold text-xs hover:shadow-lg transition-all"
            >
              Профайл руу зочлох →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
